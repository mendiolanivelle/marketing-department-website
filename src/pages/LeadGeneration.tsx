import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface LeadFile {
  id: string
  name: string
  columns: string[]
  source: 'csv' | 'spreadsheet'
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

interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontSize?: number
  fontFamily?: string
  textColor?: string
  fillColor?: string
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  wrap?: boolean
  border?: string
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

const colToLetter = (col: number): string => {
  let letter = ''
  let num = col
  do {
    letter = String.fromCharCode(65 + (num % 26)) + letter
    num = Math.floor(num / 26) - 1
  } while (num >= 0)
  return letter
}

const letterToCol = (letter: string): number => {
  let col = 0
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64)
  }
  return col - 1
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
  const [creatingSpreadsheet, setCreatingSpreadsheet] = useState(false)
  const [showNewSpreadsheetModal, setShowNewSpreadsheetModal] = useState(false)
  const [newSpreadsheetName, setNewSpreadsheetName] = useState('')
  const [zoom, setZoom] = useState(100)
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null)
  const [draggedRow, setDraggedRow] = useState<number | null>(null)
  const [currentCellRef, setCurrentCellRef] = useState('A1')
  const [formulaValue, setFormulaValue] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [cellFormats, setCellFormats] = useState<Record<string, CellFormat>>({})
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [leadStats, setLeadStats] = useState({
    totalLeads: 0,
    emailsSent: 0,
    replied: 0,
    noReply: 0,
    meetingsLeft: 0,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      const saved = localStorage.getItem('exodia-lead-files')
      if (saved) { try { setFiles(JSON.parse(saved)) } catch {} }
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase.from('lead_files').select('*').order('created_at', { ascending: false })
      if (error) throw error
      if (data) { setFiles(data); localStorage.setItem('exodia-lead-files', JSON.stringify(data)) }
    } catch (err) { console.error('Error fetching lead files:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchFiles()
    if (!isSupabaseConfigured || !supabase) return
    const fileChannel = supabase
      .channel('lead_files_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_files' }, () => { fetchFiles() })
      .subscribe()
    const rowsChannel = supabase
      .channel('lead_rows_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_rows' }, () => {
        if (selectedFile) fetchRows(selectedFile.id)
      })
      .subscribe()
    return () => {
      try { supabase.removeChannel(fileChannel) } catch {}
      try { supabase.removeChannel(rowsChannel) } catch {}
    }
  }, [fetchFiles, selectedFile, fetchRows])

  // Persist files to localStorage on every change
  useEffect(() => { localStorage.setItem('exodia-lead-files', JSON.stringify(files)) }, [files])

  const fetchLeadStats = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return

    try {
      const { data: files, error: filesError } = await supabase
        .from('lead_files')
        .select('id, name, columns')

      if (filesError) throw filesError
      if (!files || files.length === 0) return

      const nonDuplicateFiles = files.filter(f => f.name !== 'Duplicate Leads')
      const nonDuplicateFileIds = nonDuplicateFiles.map(f => f.id)

      if (nonDuplicateFileIds.length === 0) {
        setLeadStats({ totalLeads: 0, emailsSent: 0, replied: 0, noReply: 0, meetingsLeft: 0 })
        return
      }

      const { data: allRows, error: rowsError } = await supabase
        .from('lead_rows')
        .select('file_id, data')
        .in('file_id', nonDuplicateFileIds)

      if (rowsError) throw rowsError
      if (!allRows) return

      let totalLeads = 0
      let emailsSent = 0
      let replied = 0
      let noReply = 0
      let meetingsLeft = 0

      allRows.forEach((row) => {
        const data = row.data as Record<string, string>
        const file = nonDuplicateFiles.find(f => f.id === row.file_id)
        if (!file) return

        const columns = file.columns as string[]
        const companyCol = columns.find(col => col.toLowerCase().includes('company'))
        const emailStatusCol = columns.find(col => col.toLowerCase().includes('email status'))
        const leadStatusCol = columns.find(col => col.toLowerCase().includes('lead status'))

        if (companyCol && data[companyCol]?.trim()) {
          totalLeads++
        }

        if (emailStatusCol && data[emailStatusCol]?.trim()) {
          emailsSent++
        }

        if (leadStatusCol && data[leadStatusCol]) {
          const status = data[leadStatusCol].toLowerCase()
          if (status.includes('replied')) replied++
          if (status.includes('no reply')) noReply++
          if (status.includes('meeting booked')) meetingsLeft++
        }
      })

      setLeadStats({ totalLeads, emailsSent, replied, noReply, meetingsLeft })
    } catch (err) {
      console.error('Error fetching lead stats:', err)
    }
  }, [])

  useEffect(() => {
    fetchLeadStats()
    if (!isSupabaseConfigured || !supabase) return

    const filesChannel = supabase
      .channel('lead_files_leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_files' }, () => { fetchLeadStats() })
      .subscribe()

    const rowsChannel = supabase
      .channel('lead_rows_leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_rows' }, () => { fetchLeadStats() })
      .subscribe()

    return () => {
      try { supabase.removeChannel(filesChannel) } catch {}
      try { supabase.removeChannel(rowsChannel) } catch {}
    }
  }, [fetchLeadStats])

  const fetchRows = useCallback(async (fileId: string) => {
    if (!isSupabaseConfigured || !supabase) {
      const saved = localStorage.getItem(`exodia-lead-rows-${fileId}`)
      if (saved) { try { setRows(JSON.parse(saved)) } catch {} }
      setRowsLoading(false)
      return
    }
    setRowsLoading(true)
    try {
      const { data, error } = await supabase
        .from('lead_rows')
        .select('*')
        .eq('file_id', fileId)
        .order('row_index', { ascending: true })
      if (error) throw error
      if (data) { setRows(data); localStorage.setItem(`exodia-lead-rows-${fileId}`, JSON.stringify(data)) }
    } catch (err) { console.error('Error fetching rows:', err) }
    finally { setRowsLoading(false) }
  }, [])

  // Persist rows to localStorage on every change
  useEffect(() => {
    if (selectedFile) localStorage.setItem(`exodia-lead-rows-${selectedFile.id}`, JSON.stringify(rows))
  }, [rows, selectedFile])

  const checkAndRouteDuplicates = async (
    rowsToCheck: Record<string, string>[],
    sourceFileId: string,
    sourceFileName: string,
    columns: string[]
  ): Promise<number> => {
    if (!isSupabaseConfigured || !supabase || rowsToCheck.length === 0) return 0

    const emailCol = columns.find(h => h.toLowerCase().includes('email'))
    if (!emailCol) return 0

    const { data: allRows } = await supabase
      .from('lead_rows')
      .select('file_id, data')
      .neq('file_id', sourceFileId)

    const existingEmails = new Set<string>()
    if (allRows) {
      allRows.forEach(r => {
        const data = r.data as Record<string, string>
        if (data[emailCol]) {
          existingEmails.add(data[emailCol].toLowerCase().trim())
        }
      })
    }

    const duplicateRows: Record<string, string>[] = []
    rowsToCheck.forEach(row => {
      if (row[emailCol]) {
        const email = row[emailCol].toLowerCase().trim()
        if (existingEmails.has(email)) {
          duplicateRows.push(row)
        } else {
          existingEmails.add(email)
        }
      }
    })

    if (duplicateRows.length === 0) return 0

    let { data: dupFile } = await supabase
      .from('lead_files')
      .select('*')
      .eq('name', 'Duplicate Leads')
      .single()

    if (!dupFile) {
      const { data: newDupFile, error: dupFileError } = await supabase
        .from('lead_files')
        .insert([{ name: 'Duplicate Leads', columns: [...columns, 'Source File'], source: 'spreadsheet' }])
        .select()
        .single()
      if (dupFileError) throw dupFileError
      dupFile = newDupFile
    }

    const { data: existingDupRows } = await supabase
      .from('lead_rows')
      .select('row_index')
      .eq('file_id', dupFile.id)
      .order('row_index', { ascending: false })
      .limit(1)

    const startIdx = existingDupRows && existingDupRows.length > 0 ? existingDupRows[0].row_index + 1 : 0

    const dupInserts = duplicateRows.map((row, idx) => ({
      file_id: dupFile.id,
      row_index: startIdx + idx,
      data: { ...row, 'Source File': sourceFileName },
    }))

    const { error: dupRowsError } = await supabase.from('lead_rows').insert(dupInserts)
    if (dupRowsError) throw dupRowsError

    await fetchFiles()
    return duplicateRows.length
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const text = await file.text()
      const { headers, rows: parsedRows } = parseCSV(text)
      if (headers.length === 0) { alert('CSV file is empty or invalid'); return }

      const now = new Date().toISOString()
      const fileId = crypto.randomUUID()
      const newFile: LeadFile = { id: fileId, name: file.name.replace(/\.csv$/i, ''), columns: headers, source: 'csv', created_at: now, updated_at: now }

      if (isSupabaseConfigured && supabase) {
        const { data: fileData, error: fileError } = await supabase
          .from('lead_files')
          .insert([{ name: newFile.name, columns: headers, source: 'csv' }])
          .select()
          .single()
        if (fileError) throw fileError
        newFile.id = fileData.id
      }

      if (parsedRows.length > 0) {
        const emailCol = headers.find(h => h.toLowerCase().includes('email'))
        let existingEmails = new Set<string>()

        if (emailCol && supabase) {
          const { data: allRows } = await supabase
            .from('lead_rows')
            .select('data')
          if (allRows) {
            allRows.forEach(r => {
              const data = r.data as Record<string, string>
              if (data[emailCol]) existingEmails.add(data[emailCol].toLowerCase().trim())
            })
          }
        }

        const uniqueRows: Record<string, string>[] = []
        parsedRows.forEach(row => {
          if (emailCol && row[emailCol]) {
            const email = row[emailCol].toLowerCase().trim()
            if (!existingEmails.has(email)) { uniqueRows.push(row); existingEmails.add(email) }
          } else { uniqueRows.push(row) }
        })

        if (uniqueRows.length > 0) {
          const rowInserts = uniqueRows.map((row, idx) => ({
            file_id: newFile.id,
            row_index: idx,
            data: row,
          }))
          if (supabase) {
            const { error: rowsError } = await supabase.from('lead_rows').insert(rowInserts)
            if (rowsError) throw rowsError
          }
        }

        if (supabase) {
          const duplicateCount = await checkAndRouteDuplicates(parsedRows, newFile.id, newFile.name, headers)
          if (duplicateCount > 0) alert(`${duplicateCount} duplicate lead(s) detected and moved to "Duplicate Leads" file.`)
        }
      }

      setFiles(prev => [newFile, ...prev])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Error uploading CSV:', err)
      alert('Failed to upload CSV file')
    } finally { setUploading(false) }
  }

  const createSpreadsheet = async () => {
    const name = newSpreadsheetName.trim()
    if (!name) return

    setCreatingSpreadsheet(true)
    try {
      const columns: string[] = []
      for (let i = 0; i < 50; i++) columns.push(colToLetter(i))

      const now = new Date().toISOString()
      const fileId = crypto.randomUUID()
      const newFile: LeadFile = { id: fileId, name, columns, source: 'spreadsheet', created_at: now, updated_at: now }
      const emptyRowData = columns.reduce((acc, col) => { acc[col] = ''; return acc }, {} as Record<string, string>)
      const emptyRows: LeadRow[] = Array.from({ length: 50 }, (_, idx) => ({
        id: crypto.randomUUID(), file_id: fileId, row_index: idx, data: { ...emptyRowData }, created_at: now, updated_at: now,
      }))

      if (isSupabaseConfigured && supabase) {
        const { data: fileData, error: fileError } = await supabase
          .from('lead_files')
          .insert([{ name, columns, source: 'spreadsheet' }])
          .select()
          .single()
        if (fileError) throw fileError
        newFile.id = fileData.id

        const dbRows = emptyRows.map(r => ({ file_id: r.file_id, row_index: r.row_index, data: r.data }))
        const { error: rowsError } = await supabase.from('lead_rows').insert(dbRows)
        if (rowsError) throw rowsError
      }

      setFiles(prev => [newFile, ...prev])
      setShowNewSpreadsheetModal(false)
      setNewSpreadsheetName('')
    } catch (err) {
      console.error('Error creating spreadsheet:', err)
      alert('Failed to create spreadsheet')
    } finally { setCreatingSpreadsheet(false) }
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
    setCurrentCellRef('A1')
    setFormulaValue('')
  }

  const handleCellClick = (row: LeadRow, col: string, rowIdx: number, colIdx: number) => {
    const cellRef = `${col}${rowIdx + 1}`
    setCurrentCellRef(cellRef)
    setFormulaValue(row.data[col] || '')
    setEditingCell({ rowId: row.id, col })
    setEditValue(row.data[col] || '')
  }

  const saveCellEdit = async () => {
    if (!editingCell || !selectedFile) return
    const row = rows.find(r => r.id === editingCell.rowId)
    if (!row) return

    const newData = { ...row.data, [editingCell.col]: editValue }
    const now = new Date().toISOString()
    setRows(prev => prev.map(r => r.id === editingCell.rowId ? { ...r, data: newData, updated_at: now } : r))
    setEditingCell(null)

    if (supabase) {
      try {
        await supabase.from('lead_rows').update({ data: newData, updated_at: now }).eq('id', editingCell.rowId)
      } catch (err) { console.error('Error saving cell:', err) }
    }
  }

  const handleHeaderEdit = (index: number) => {
    setEditingHeader(index)
    setHeaderValue(selectedFile!.columns[index])
  }

  const saveHeaderEdit = async () => {
    if (editingHeader === null || !selectedFile) return
    const oldName = selectedFile.columns[editingHeader]
    const newColumns = [...selectedFile.columns]
    newColumns[editingHeader] = headerValue.trim() || oldName
    const updatedRows = rows.map(r => {
      const newData: Record<string, string> = {}
      newColumns.forEach(col => { newData[col] = col === newColumns[editingHeader] ? r.data[oldName] || '' : r.data[col] || '' })
      return { ...r, data: newData }
    })
    setRows(updatedRows)
    setSelectedFile({ ...selectedFile, columns: newColumns })
    setEditingHeader(null)
    if (supabase) {
      try { await supabase.from('lead_files').update({ columns: newColumns }).eq('id', selectedFile.id) } catch (err) {}
    }
  }

  const addRow = async () => {
    if (!selectedFile) return
    const tempId = `temp-${Date.now()}`
    const newRowData: Record<string, string> = {}
    selectedFile.columns.forEach(col => { newRowData[col] = '' })
    const newIndex = rows.length > 0 ? Math.max(...rows.map(r => r.row_index)) + 1 : 0
    const tempRow: LeadRow = { id: tempId, file_id: selectedFile.id, row_index: newIndex, data: newRowData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    setRows(prev => [...prev, tempRow])
    if (supabase) {
      try {
        const { data } = await supabase.from('lead_rows').insert([{ file_id: selectedFile.id, row_index: newIndex, data: newRowData }]).select().single()
        if (data) setRows(prev => prev.map(r => r.id === tempId ? data : r))
      } catch (err) { console.error('Error adding row:', err) }
    }
  }

  const deleteRow = async (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId))
    if (supabase) {
      try { await supabase.from('lead_rows').delete().eq('id', rowId) } catch (err) {}
    }
  }

  const addColumn = async () => {
    if (!selectedFile) return
    const newName = colToLetter(selectedFile.columns.length)
    const newColumns = [...selectedFile.columns, newName]
    setSelectedFile({ ...selectedFile, columns: newColumns })
    setRows(prev => prev.map(r => ({ ...r, data: { ...r.data, [newName]: '' } })))
    if (supabase) {
      try { await supabase.from('lead_files').update({ columns: newColumns }).eq('id', selectedFile.id) } catch (err) {}
    }
  }

  const deleteColumn = async (colIndex: number) => {
    if (!selectedFile || selectedFile.columns.length <= 1) return
    const colName = selectedFile.columns[colIndex]
    const newColumns = selectedFile.columns.filter((_, i) => i !== colIndex)
    setSelectedFile({ ...selectedFile, columns: newColumns })
    setRows(prev => prev.map(r => { const d = { ...r.data }; delete d[colName]; return { ...r, data: d } }))
    if (supabase) {
      try { await supabase.from('lead_files').update({ columns: newColumns }).eq('id', selectedFile.id) } catch (err) {}
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

  const handleColumnDragStart = (colIdx: number) => {
    setDraggedColumn(colIdx)
  }

  const handleColumnDrop = async (targetIdx: number) => {
    if (draggedColumn === null || draggedColumn === targetIdx || !selectedFile || !supabase) return

    const newColumns = [...selectedFile.columns]
    const [movedCol] = newColumns.splice(draggedColumn, 1)
    newColumns.splice(targetIdx, 0, movedCol)

    const { error } = await supabase
      .from('lead_files')
      .update({ columns: newColumns })
      .eq('id', selectedFile.id)

    if (!error) {
      setSelectedFile({ ...selectedFile, columns: newColumns })
    }
    setDraggedColumn(null)
  }

  const handleRowDragStart = (rowIdx: number) => {
    setDraggedRow(rowIdx)
  }

  const handleRowDrop = async (targetIdx: number) => {
    if (draggedRow === null || draggedRow === targetIdx || !selectedFile || !supabase) return

    const newRows = [...rows]
    const [movedRow] = newRows.splice(draggedRow, 1)
    newRows.splice(targetIdx, 0, movedRow)

    const updates = newRows.map((row, idx) => ({
      id: row.id,
      row_index: idx,
    }))

    for (const update of updates) {
      await supabase
        .from('lead_rows')
        .update({ row_index: update.row_index })
        .eq('id', update.id)
    }

    setRows(newRows)
    setDraggedRow(null)
  }

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200))
  }

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50))
  }

  const applyFormat = (format: Partial<CellFormat>) => {
    if (!editingCell) return
    const cellKey = `${editingCell.rowId}-${editingCell.col}`
    setCellFormats(prev => ({
      ...prev,
      [cellKey]: { ...prev[cellKey], ...format }
    }))
  }

  const getCurrentCellFormat = (): CellFormat => {
    if (!editingCell) return {}
    const cellKey = `${editingCell.rowId}-${editingCell.col}`
    return cellFormats[cellKey] || {}
  }

  const menus = {
    File: ['New', 'Open', 'Make a copy', 'Share', 'Download', 'Print'],
    Edit: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Delete', 'Select all'],
    View: ['Zoom', 'Show gridlines', 'Show formula bar', 'Freeze', 'Hidden columns'],
    Insert: ['Rows', 'Columns', 'Chart', 'Image', 'Drawing', 'Comment'],
    Format: ['Text', 'Number', 'Conditional formatting', 'Alternating colors', 'Clear formatting'],
    Data: ['Sort sheet', 'Sort range', 'Create a filter', 'Data validation', 'Group rows'],
    Tools: ['Spelling', 'Macros', 'Notifications', 'Script editor'],
    Extensions: ['Add-ons', 'Get add-ons'],
    Help: ['Search menus', 'Help', 'Updates', 'Report a problem']
  }

  if (selectedFile) {
    const currentFormat = getCurrentCellFormat()

    return (
      <div className="h-screen flex flex-col bg-white">
        {/* Menu Bar */}
        <div className="flex items-center px-2 py-1 border-b border-[#CACDD7] bg-white">
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => { setSelectedFile(null); setRows([]); setEditingCell(null); setEditingHeader(null) }}
              className="p-1.5 rounded-lg hover:bg-[rgba(202,205,215,0.3)] transition"
              style={{ color: 'var(--text-secondary)' }}
              title="Back to files"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-sm font-medium text-[#1B1A1C]">{selectedFile.name}</h1>
          </div>
          <div className="flex items-center gap-1">
            {Object.keys(menus).map(menu => (
              <div key={menu} className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === menu ? null : menu)}
                  className="px-3 py-1 text-sm text-[#3E4048] hover:bg-[rgba(202,205,215,0.2)] rounded"
                >
                  {menu}
                </button>
                {activeMenu === menu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-[#CACDD7] rounded-lg shadow-lg py-1 z-50">
                    {menus[menu as keyof typeof menus].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveMenu(null)
                          if (item === 'Download') exportCSV()
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#3E4048] hover:bg-[rgba(202,205,215,0.2)]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[#CACDD7] bg-[rgba(202,205,215,0.15)] flex-wrap">
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Undo">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Redo">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Print">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <div className="flex items-center gap-1 border border-[#CACDD7] rounded px-2 py-1 bg-white">
            <button onClick={zoomOut} className="text-[#3E4048] hover:text-[#1B1A1C]">-</button>
            <span className="text-xs text-[#3E4048] min-w-[40px] text-center">{zoom}%</span>
            <button onClick={zoomIn} className="text-[#3E4048] hover:text-[#1B1A1C]">+</button>
          </div>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Currency">
            <span className="text-sm text-[#3E4048]">$</span>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Percent">
            <span className="text-sm text-[#3E4048]">%</span>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Decimal">
            <span className="text-xs text-[#3E4048]">.0</span>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Decimal">
            <span className="text-xs text-[#3E4048]">.00</span>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Number format">
            <span className="text-xs text-[#3E4048]">123</span>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <select className="text-xs border border-[#CACDD7] rounded px-2 py-1 bg-white">
            <option>Default</option>
            <option>Arial</option>
            <option>Times New Roman</option>
            <option>Courier New</option>
            <option>Georgia</option>
          </select>
          <div className="flex items-center gap-1 border border-[#CACDD7] rounded px-2 py-1 bg-white">
            <button className="text-[#3E4048] hover:text-[#1B1A1C]">-</button>
            <span className="text-xs text-[#3E4048] min-w-[30px] text-center">{currentFormat.fontSize || 10}</span>
            <button className="text-[#3E4048] hover:text-[#1B1A1C]">+</button>
          </div>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <button
            onClick={() => applyFormat({ bold: !currentFormat.bold })}
            className={`p-1.5 rounded font-bold ${currentFormat.bold ? 'bg-gray-300' : 'hover:bg-[rgba(202,205,215,0.3)]'}`}
            title="Bold"
          >
            <span className="text-sm">B</span>
          </button>
          <button
            onClick={() => applyFormat({ italic: !currentFormat.italic })}
            className={`p-1.5 rounded italic ${currentFormat.italic ? 'bg-gray-300' : 'hover:bg-[rgba(202,205,215,0.3)]'}`}
            title="Italic"
          >
            <span className="text-sm">I</span>
          </button>
          <button
            onClick={() => applyFormat({ strikethrough: !currentFormat.strikethrough })}
            className={`p-1.5 rounded ${currentFormat.strikethrough ? 'bg-gray-300' : 'hover:bg-[rgba(202,205,215,0.3)]'}`}
            title="Strikethrough"
          >
            <span className="text-sm line-through">S</span>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Text color">
            <span className="text-sm text-[#3E4048] border-b-2 border-red-500">A</span>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Fill color">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Borders">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Align left">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Align center">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Align right">
            <svg className="w-4 h-4 text-[#3E4048]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <button onClick={exportCSV} className="px-3 py-1.5 text-sm font-medium text-[#3E4048] border border-[#CACDD7] rounded hover:bg-[rgba(202,205,215,0.2)] flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button onClick={addRow} className="px-3 py-1.5 text-sm font-medium text-white rounded flex items-center gap-1.5" style={{ backgroundColor: 'var(--accent)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </button>
          <button onClick={addColumn} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Column
          </button>
        </div>

        {/* Formula Bar */}
        <div className="flex items-center gap-2 px-2 py-1 border-b border-[#CACDD7] bg-white">
          <div className="flex items-center gap-2 border border-[#CACDD7] rounded px-3 py-1 min-w-[80px]">
            <span className="text-sm text-[#3E4048] font-medium">{currentCellRef}</span>
          </div>
          <div className="flex-1 flex items-center border border-[#CACDD7] rounded px-3 py-1">
            <span className="text-[#CACDD7] mr-2">fx</span>
            <input
              type="text"
              value={formulaValue}
              onChange={(e) => setFormulaValue(e.target.value)}
              className="flex-1 text-sm outline-none"
              placeholder="Enter value or formula"
            />
          </div>
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto">
          {rowsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
            </div>
          ) : (
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${10000 / zoom}%` }}>
              <table className="w-full border-collapse min-w-max">
                <thead>
                  <tr>
                    <th className="w-12 border-b border-r border-[#CACDD7] px-2 py-1 text-xs font-medium text-[#3E4048] text-center bg-[rgba(202,205,215,0.2)] sticky left-0 z-20">#</th>
                    {selectedFile.columns.map((col, colIdx) => (
                      <th
                        key={colIdx}
                        className="border-b border-r border-[#CACDD7] px-1 py-1 min-w-[100px] bg-[#e8f0fe] group relative sticky top-0 z-10"
                        draggable
                        onDragStart={() => handleColumnDragStart(colIdx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleColumnDrop(colIdx)}
                      >
                        <div className="flex items-center justify-between cursor-move">
                          {editingHeader === colIdx ? (
                            <input
                              type="text"
                              value={headerValue}
                              onChange={(e) => setHeaderValue(e.target.value)}
                              onBlur={saveHeaderEdit}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveHeaderEdit(); if (e.key === 'Escape') setEditingHeader(null) }}
                              className="w-full px-2 py-1 text-xs font-semibold text-[#3E4048] bg-white border rounded outline-none"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => handleHeaderEdit(colIdx)}
                              className="flex-1 px-2 py-1 text-xs font-semibold text-[#3E4048] cursor-text hover:bg-blue-100 rounded truncate"
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
                    <th className="w-10 border-b border-[#CACDD7] bg-[#e8f0fe] sticky top-0 z-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr
                      key={row.id}
                      className="group hover:bg-blue-50"
                      draggable
                      onDragStart={() => handleRowDragStart(rowIdx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleRowDrop(rowIdx)}
                    >
                      <td className="border-b border-r border-[#CACDD7] px-2 py-1 text-xs text-[#3E4048] text-center bg-[rgba(202,205,215,0.2)] cursor-move sticky left-0 z-10">
                        {rowIdx + 1}
                      </td>
                      {selectedFile.columns.map((col) => {
                        const cellKey = `${row.id}-${col}`
                        const format = cellFormats[cellKey] || {}
                        return (
                          <td
                            key={col}
                            className="border-b border-r border-[#CACDD7] px-1 py-0.5 cursor-cell"
                            onClick={() => handleCellClick(row, col, rowIdx, selectedFile.columns.indexOf(col))}
                            style={{
                              fontWeight: format.bold ? 'bold' : 'normal',
                              fontStyle: format.italic ? 'italic' : 'normal',
                              textDecoration: format.strikethrough ? 'line-through' : 'none',
                              fontSize: `${format.fontSize || 10}px`,
                              color: format.textColor || 'inherit',
                              backgroundColor: format.fillColor || 'inherit',
                              textAlign: format.align || 'left',
                            }}
                          >
                            {editingCell?.rowId === row.id && editingCell?.col === col ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveCellEdit}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveCellEdit(); if (e.key === 'Escape') setEditingCell(null); if (e.key === 'Tab') { saveCellEdit() } }}
                                className="w-full px-2 py-1 text-sm bg-white border-2 rounded outline-none"
                                style={{ borderColor: 'var(--accent)' }}
                                autoFocus
                              />
                            ) : (
                              <div className="px-2 py-1 text-sm text-[#3E4048] min-h-[28px] hover:bg-white hover:border hover:border-[#CACDD7] rounded">
                                {row.data[col] || ''}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="border-b border-[#CACDD7] px-1">
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
            </div>
          )}
        </div>

        {/* Sheet Tabs */}
        <div className="flex items-center gap-1 px-2 py-1 border-t border-[#CACDD7] bg-[rgba(202,205,215,0.2)]">
          <button className="px-3 py-1 text-sm font-medium bg-white border border-[#CACDD7] rounded-t text-[#1B1A1C]">
            Sheet1
          </button>
          <button className="px-3 py-1 text-sm text-[#3E4048] hover:bg-[rgba(202,205,215,0.3)] rounded">
            + Add sheet
          </button>
        </div>

        {/* Status Bar */}
        <div className="border-t border-[#CACDD7] px-4 py-1 bg-[rgba(202,205,215,0.15)] flex items-center justify-between text-xs text-[#3E4048]">
          <span>{rows.length} rows x {selectedFile.columns.length} columns</span>
          <div className="flex items-center gap-2">
            <span>Click cell to edit</span>
            <div className="flex items-center gap-1 border-l border-[#CACDD7] pl-3 ml-1">
              <button onClick={zoomOut} className="px-1.5 py-0.5 rounded hover:bg-[rgba(202,205,215,0.3)] transition" style={{ color: 'var(--text-muted)' }} title="Zoom out">-</button>
              <span className="min-w-[40px] text-center">{zoom}%</span>
              <button onClick={zoomIn} className="px-1.5 py-0.5 rounded hover:bg-[rgba(202,205,215,0.3)] transition" style={{ color: 'var(--text-muted)' }} title="Zoom in">+</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[rgba(202,205,215,0.15)]">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Lead Generation</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Upload CSV files or create spreadsheets to manage your leads</p>
        </div>

        {/* Lead Pipeline Dashboard */}
        <div
          className="block rounded-2xl border p-4 sm:p-8 mb-6 sm:mb-8 hover:shadow-md transition-all theme-transition"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-lg sm:text-xl mb-4 sm:mb-6 text-left" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lead Pipeline</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            {[
              { label: 'Total Leads', value: leadStats.totalLeads, sub: 'From all sources', color: 'var(--text-primary)' },
              { label: 'Emails Sent', value: leadStats.emailsSent, sub: `${leadStats.totalLeads > 0 ? Math.round((leadStats.emailsSent / leadStats.totalLeads) * 100) : 0}% of total`, color: 'var(--text-primary)' },
              { label: 'Replied', value: leadStats.replied, sub: `${leadStats.emailsSent > 0 ? Math.round((leadStats.replied / leadStats.emailsSent) * 100) : 0}% response rate`, color: 'var(--accent)' },
              { label: 'No Reply', value: leadStats.noReply, sub: 'Follow-up needed', color: 'var(--text-primary)' },
              { label: 'Meetings', value: leadStats.meetingsLeft, sub: 'Scheduled', color: 'var(--accent)' },
            ].map((stat, i) => (
              <div key={i} className="p-3 sm:p-5 rounded-xl border theme-transition" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                <div className="text-xs sm:text-sm mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{stat.label}</div>
                <div className="text-2xl sm:text-3xl" style={{ color: stat.color, fontWeight: 700 }}>{stat.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all"
            style={{
              borderColor: uploading ? 'var(--accent)' : 'var(--border-primary)',
              backgroundColor: uploading ? 'var(--accent-light)' : 'var(--bg-card)',
            }}
          >
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
                <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Uploading and parsing CSV...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-7 h-7" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload CSV File</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Import existing data</p>
                </div>
              </div>
            )}
          </div>

          <div
            onClick={() => setShowNewSpreadsheetModal(true)}
            className="border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                <svg className="w-7 h-7" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Create Spreadsheet</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Start from scratch</p>
              </div>
            </div>
          </div>
        </div>

        {showNewSpreadsheetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowNewSpreadsheetModal(false); setNewSpreadsheetName('') }} />
            <div className="relative rounded-2xl border w-full max-w-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create New Spreadsheet</h2>
                <button onClick={() => { setShowNewSpreadsheetModal(false); setNewSpreadsheetName('') }} className="p-1 rounded-full transition" style={{ color: 'var(--text-secondary)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-6 py-5">
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Spreadsheet Name</label>
                <input
                  type="text"
                  value={newSpreadsheetName}
                  onChange={(e) => setNewSpreadsheetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createSpreadsheet() }}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
                  placeholder="e.g., Q3 Lead List"
                  autoFocus
                />
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-primary)' }}>
                <button onClick={() => { setShowNewSpreadsheetModal(false); setNewSpreadsheetName('') }} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                <button onClick={createSpreadsheet} disabled={!newSpreadsheetName.trim() || creatingSpreadsheet} className="px-5 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>
                  {creatingSpreadsheet && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>CSV Files</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 500 }}>{files.filter(f => f.source === 'csv').length}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--text-primary)' }}></div></div>
            ) : files.filter(f => f.source === 'csv').length === 0 ? (
              <div className="text-center py-12 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No CSV files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {files.filter(f => f.source === 'csv').map((file) => (
                  <div key={file.id} className="group rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={() => openFile(file)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)' }}>
                          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</h3>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{file.columns.length} columns · {new Date(file.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id) }} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-red-50 flex-shrink-0" title="Delete" style={{ color: 'var(--text-muted)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Spreadsheets</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 500 }}>{files.filter(f => f.source === 'spreadsheet').length}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--text-primary)' }}></div></div>
            ) : files.filter(f => f.source === 'spreadsheet').length === 0 ? (
              <div className="text-center py-12 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No spreadsheets created yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {files.filter(f => f.source === 'spreadsheet').map((file) => (
                  <div key={file.id} className="group rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={() => openFile(file)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)' }}>
                          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</h3>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{file.columns.length} columns · {new Date(file.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id) }} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-red-50 flex-shrink-0" title="Delete" style={{ color: 'var(--text-muted)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
