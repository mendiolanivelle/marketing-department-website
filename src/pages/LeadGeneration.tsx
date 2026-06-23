import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface LeadFile {
  id: string
  name: string
  columns: string[]
  created_at: string
  updated_at: string
}

interface LeadRow {
  id: string
  file_id: string
  row_index: number
  data: Record<string, string>
  created_at: string
  updated_at: string
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })

  return { headers, rows }
}

export default function LeadGeneration() {
  const [files, setFiles] = useState<LeadFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<LeadFile | null>(null)
  const [rows, setRows] = useState<LeadRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingHeader, setEditingHeader] = useState<number | null>(null)
  const [headerValue, setHeaderValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return }
    try {
      const { data, error } = await supabase.from('lead_files').select('*').order('created_at', { ascending: false })
      if (error) throw error
      if (data) setFiles(data)
    } catch (err) { console.error('Error fetching lead files:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchFiles()
    if (!isSupabaseConfigured || !supabase) return
    const channel = supabase
      .channel('lead_files_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_files' }, () => { fetchFiles() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchFiles])

  const fetchRows = useCallback(async (fileId: string) => {
    if (!isSupabaseConfigured || !supabase) return
    setRowsLoading(true)
    try {
      const { data, error } = await supabase
        .from('lead_rows')
        .select('*')
        .eq('file_id', fileId)
        .order('row_index', { ascending: true })
      if (error) throw error
      if (data) setRows(data)
    } catch (err) { console.error('Error fetching rows:', err) }
    finally { setRowsLoading(false) }
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isSupabaseConfigured || !supabase) return

    setUploading(true)
    try {
      const text = await file.text()
      const { headers, rows: parsedRows } = parseCSV(text)

      if (headers.length === 0) { alert('CSV file is empty or invalid'); return }

      const { data: fileData, error: fileError } = await supabase
        .from('lead_files')
        .insert([{ name: file.name.replace(/\.csv$/i, ''), columns: headers }])
        .select()
        .single()

      if (fileError) throw fileError

      if (parsedRows.length > 0) {
        const rowInserts = parsedRows.map((row, idx) => ({
          file_id: fileData.id,
          row_index: idx,
          data: row,
        }))
        const { error: rowsError } = await supabase.from('lead_rows').insert(rowInserts)
        if (rowsError) throw rowsError
      }

      await fetchFiles()
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Error uploading CSV:', err)
      alert('Failed to upload CSV file')
    } finally { setUploading(false) }
  }

  const openFile = async (file: LeadFile) => {
    setSelectedFile(file)
    await fetchRows(file.id)
  }

  const closeFile = () => {
    setSelectedFile(null)
    setRows([])
    setEditingCell(null)
    setEditingHeader(null)
  }

  const handleCellEdit = (row: LeadRow, col: string) => {
    setEditingCell({ rowId: row.id, col })
    setEditValue(row.data[col] || '')
  }

  const saveCellEdit = async () => {
    if (!editingCell || !supabase) return
    const row = rows.find(r => r.id === editingCell.rowId)
    if (!row) return

    const newData = { ...row.data, [editingCell.col]: editValue }
    const { error } = await supabase
      .from('lead_rows')
      .update({ data: newData })
      .eq('id', editingCell.rowId)

    if (!error) {
      setRows(prev => prev.map(r => r.id === editingCell.rowId ? { ...r, data: newData } : r))
    }
    setEditingCell(null)
  }

  const handleHeaderEdit = (index: number) => {
    setEditingHeader(index)
    setHeaderValue(selectedFile!.columns[index])
  }

  const saveHeaderEdit = async () => {
    if (editingHeader === null || !selectedFile || !supabase) return
    const oldName = selectedFile.columns[editingHeader]
    const newColumns = [...selectedFile.columns]
    newColumns[editingHeader] = headerValue
    newColumns[editingHeader] = newColumns[editingHeader].trim() || oldName

    const { error } = await supabase
      .from('lead_files')
      .update({ columns: newColumns })
      .eq('id', selectedFile.id)

    if (!error) {
      const updatedRows = rows.map(r => {
        const newData: Record<string, string> = {}
        newColumns.forEach(col => {
          if (col === newColumns[editingHeader]) {
            newData[col] = r.data[oldName] || ''
          } else {
            newData[col] = r.data[col] || ''
          }
        })
        return { ...r, data: newData }
      })
      setRows(updatedRows)
      setSelectedFile({ ...selectedFile, columns: newColumns })
    }
    setEditingHeader(null)
  }

  const addRow = async () => {
    if (!selectedFile || !supabase) return
    const newRowData: Record<string, string> = {}
    selectedFile.columns.forEach(col => { newRowData[col] = '' })
    const newIndex = rows.length > 0 ? Math.max(...rows.map(r => r.row_index)) + 1 : 0

    const { data, error } = await supabase
      .from('lead_rows')
      .insert([{ file_id: selectedFile.id, row_index: newIndex, data: newRowData }])
      .select()
      .single()

    if (!error && data) {
      setRows(prev => [...prev, data])
    }
  }

  const deleteRow = async (rowId: string) => {
    if (!supabase) return
    const { error } = await supabase.from('lead_rows').delete().eq('id', rowId)
    if (!error) {
      setRows(prev => prev.filter(r => r.id !== rowId))
    }
  }

  const addColumn = async () => {
    if (!selectedFile || !supabase) return
    const newName = `Column ${selectedFile.columns.length + 1}`
    const newColumns = [...selectedFile.columns, newName]

    const { error } = await supabase
      .from('lead_files')
      .update({ columns: newColumns })
      .eq('id', selectedFile.id)

    if (!error) {
      setSelectedFile({ ...selectedFile, columns: newColumns })
      const updatedRows = rows.map(r => ({
        ...r,
        data: { ...r.data, [newName]: '' },
      }))
      setRows(updatedRows)
    }
  }

  const deleteColumn = async (colIndex: number) => {
    if (!selectedFile || !supabase || selectedFile.columns.length <= 1) return
    const colName = selectedFile.columns[colIndex]
    const newColumns = selectedFile.columns.filter((_, i) => i !== colIndex)

    const { error } = await supabase
      .from('lead_files')
      .update({ columns: newColumns })
      .eq('id', selectedFile.id)

    if (!error) {
      setSelectedFile({ ...selectedFile, columns: newColumns })
      const updatedRows = rows.map(r => {
        const newData = { ...r.data }
        delete newData[colName]
        return { ...r, data: newData }
      })
      setRows(updatedRows)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Delete this file and all its data?') || !supabase) return
    const { error } = await supabase.from('lead_files').delete().eq('id', fileId)
    if (!error) {
      setFiles(prev => prev.filter(f => f.id !== fileId))
      if (selectedFile?.id === fileId) closeFile()
    }
  }

  const exportCSV = () => {
    if (!selectedFile) return
    const headers = selectedFile.columns.join(',')
    const csvRows = rows.map(r =>
      selectedFile.columns.map(col => {
        const val = r.data[col] || ''
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"` : val
      }).join(',')
    )
    const csv = [headers, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedFile.name}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (selectedFile) {
    return (
      <div className="h-[calc(100vh-0px)] flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button onClick={closeFile} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-gray-900">{selectedFile.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button onClick={addRow} className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Row
            </button>
            <button onClick={addColumn} className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Column
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {rowsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <table className="w-full border-collapse min-w-max">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  <th className="w-12 border-b border-r border-gray-200 px-2 py-2 text-xs font-medium text-gray-400 text-center bg-gray-50">#</th>
                  {selectedFile.columns.map((col, colIdx) => (
                    <th key={colIdx} className="border-b border-r border-gray-200 px-1 py-1 min-w-[150px] bg-gray-50 group relative">
                      <div className="flex items-center justify-between">
                        {editingHeader === colIdx ? (
                          <input
                            type="text"
                            value={headerValue}
                            onChange={(e) => setHeaderValue(e.target.value)}
                            onBlur={saveHeaderEdit}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveHeaderEdit(); if (e.key === 'Escape') setEditingHeader(null) }}
                            className="w-full px-2 py-1 text-xs font-semibold text-gray-700 bg-white border border-green-500 rounded outline-none"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => handleHeaderEdit(colIdx)}
                            className="flex-1 px-2 py-1 text-xs font-semibold text-gray-700 cursor-text hover:bg-gray-100 rounded truncate"
                          >
                            {col}
                          </span>
                        )}
                        <button
                          onClick={() => deleteColumn(colIdx)}
                          className="p-0.5 rounded hover:bg-red-100 opacity-0 group-hover:opacity-100 transition mr-1"
                          title="Delete column"
                        >
                          <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-10 border-b border-gray-200 bg-gray-50"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={row.id} className="group hover:bg-green-50/30">
                    <td className="border-b border-r border-gray-200 px-2 py-1 text-xs text-gray-400 text-center bg-gray-50/50">
                      {rowIdx + 1}
                    </td>
                    {selectedFile.columns.map((col) => (
                      <td
                        key={col}
                        className="border-b border-r border-gray-200 px-1 py-0.5 cursor-cell"
                        onClick={() => handleCellEdit(row, col)}
                      >
                        {editingCell?.rowId === row.id && editingCell?.col === col ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveCellEdit}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveCellEdit(); if (e.key === 'Escape') setEditingCell(null); if (e.key === 'Tab') { saveCellEdit() } }}
                            className="w-full px-2 py-1 text-sm bg-white border-2 border-green-500 rounded outline-none"
                            autoFocus
                          />
                        ) : (
                          <div className="px-2 py-1 text-sm text-gray-700 min-h-[28px] hover:bg-white hover:border hover:border-gray-200 rounded">
                            {row.data[col] || ''}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="border-b border-gray-200 px-1">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="p-1 rounded hover:bg-red-100 opacity-0 group-hover:opacity-100 transition"
                        title="Delete row"
                      >
                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>{rows.length} rows &middot; {selectedFile.columns.length} columns</span>
          <span>Click any cell to edit</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Lead Generation</h1>
          <p className="text-sm sm:text-base text-gray-500">Upload CSV files, manage leads, and track your outreach pipeline</p>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all
            ${uploading
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50/30'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
              <p className="text-sm font-medium text-green-700">Uploading and parsing CSV...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 mb-1">Drop your CSV file here or click to upload</p>
                <p className="text-sm text-gray-500">Supports .csv files. Headers in first row.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your Files</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No files uploaded yet</p>
              <p className="text-gray-400 text-xs mt-1">Upload a CSV file to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group bg-white rounded-xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => openFile(file)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFile(file.id) }}
                      className="p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4 text-gray-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm truncate mb-1">{file.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{file.columns.length} columns</span>
                    <span>&middot;</span>
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
