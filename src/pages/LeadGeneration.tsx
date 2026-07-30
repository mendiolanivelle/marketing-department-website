import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'

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

const CALLING_CARD_COLUMNS = ['Name', 'Company', 'Role / Position', 'Email', 'Contact Number', 'Address', 'Notes', 'Raw OCR Text']

const emitUploadStatus = (id: string, label: string, status: 'queued' | 'uploading' | 'done' | 'error', progress: number) => {
  window.dispatchEvent(new CustomEvent('upload-status', { detail: { id, label, status, progress } }))
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

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const prepareImageForAi = async (file: File): Promise<string> => {
  const originalDataUrl = await fileToDataUrl(file)
  const image = new Image()
  image.src = originalDataUrl
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Unable to read image'))
  })

  const maxDimension = 1280
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx || !image.width || !image.height) throw new Error('Unable to prepare image for AI extraction')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

const fetchJsonWithTimeout = async (url: string, options: RequestInit, timeoutMs = 60000) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    const data = text && response.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(text)
      : { error: `Request failed with status ${response.status}` }
    return { response, data }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw Object.assign(new Error(`AI extraction timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try a clearer photo or a smaller image.`), { cause: err })
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}

const formatExtractionError = (data: Record<string, string>) => {
  const details = [data.param && `param: ${data.param}`, data.code && `code: ${data.code}`, data.type && `type: ${data.type}`, data.model && `model: ${data.model}`, data.imageUrl && `image: ${data.imageUrl}`].filter(Boolean)
  return `${data.error || 'AI extraction failed'}${details.length ? ` (${details.join(', ')})` : ''}`
}

const mapAiLeadToRow = (lead: Record<string, string>): Record<string, string> => ({
  Name: lead.name || '',
  Company: lead.company || '',
  'Role / Position': lead.role || '',
  Email: lead.email || '',
  'Contact Number': lead.contact_number || '',
  Address: lead.address || '',
  Notes: lead.notes || '',
  'Raw OCR Text': lead.raw_text || '',
})

export default function LeadGeneration() {
  const [files, setFiles] = useState<LeadFile[]>([])
  const [loading, setLoading] = useState(true)
  const [canonicalFilesReady, setCanonicalFilesReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selectedFile, setSelectedFile] = useState<LeadFile | null>(null)
  const [rows, setRows] = useState<LeadRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [creatingSpreadsheet, setCreatingSpreadsheet] = useState(false)
  const [showNewSpreadsheetModal, setShowNewSpreadsheetModal] = useState(false)
  const [newSpreadsheetName, setNewSpreadsheetName] = useState('')
  const [zoom, setZoom] = useState(100)
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null)
  const [draggedRow, setDraggedRow] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const callingCardInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<LeadFile[]>([])
  const filesHydratedRef = useRef(false)
  const rowsHydratedFileIdRef = useRef<string | null>(null)
  const localFileIdsRef = useRef(new Set<string>())
  const remoteFileIdsRef = useRef(new Set<string>())
  const localRowIdsRef = useRef(new Set<string>())
  const remoteRowIdsRef = useRef(new Set<string>())
  const callingCardQueueRef = useRef<{ file: File; sourceLabel: 'upload' | 'camera' }[]>([])
  const callingCardUploadIdRef = useRef(`calling-card-${crypto.randomUUID()}`)
  const callingCardTotalRef = useRef(0)
  const callingCardDoneRef = useRef(0)
  const processingCallingCardQueueRef = useRef(false)
  const [duplicateModal, setDuplicateModal] = useState<{
    type: 'upload' | 'cell-edit' | 'in-file'
    count?: number
    email?: string
    rowId?: string
    fileId?: string
    rowData?: Record<string, string>
    sourceFileName?: string
    dupes?: { email: string; rows: LeadRow[] }[]
  } | null>(null)
  const canonicalActionsEnabled = isSupabaseConfigured && Boolean(supabase) && canonicalFilesReady && !loading

  useEffect(() => { filesRef.current = files }, [files])

  const fetchFiles = useCallback(async () => {
    remoteFileIdsRef.current = new Set()
    if (isSupabaseConfigured) setCanonicalFilesReady(false)

    if (!isSupabaseConfigured) {
      let localFiles: LeadFile[] = []
      const saved = localStorage.getItem('exodia-lead-files')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) localFiles = parsed
        } catch {}
      }
      localFileIdsRef.current = new Set(localFiles.map(file => file.id))
      setFiles(localFiles)
      setCanonicalFilesReady(false)
      setLoadError('Canonical lead storage is unavailable. Preserved browser-only spreadsheets are shown read-only.')
      filesHydratedRef.current = true
      setLoading(false)
      return
    }
    if (!supabase) {
      localFileIdsRef.current = new Set()
      setFiles([])
      setSelectedFile(null)
      setRows([])
      setLoadError('Canonical lead storage is configured but unavailable. Changes are disabled to prevent duplicates.')
      filesHydratedRef.current = true
      setLoading(false)
      return
    }
    localFileIdsRef.current = new Set()
    try {
      const { data, error } = await supabase.from('lead_files').select('*').order('created_at', { ascending: false })
      if (error) throw error
      const canonicalFiles = data || []
      remoteFileIdsRef.current = new Set(canonicalFiles.map((file: LeadFile) => file.id))
      filesHydratedRef.current = true
      setFiles(canonicalFiles)
      setCanonicalFilesReady(true)
      setLoadError('')
    } catch (err) {
      console.error('Error fetching lead files:', err)
      setFiles([])
      setSelectedFile(null)
      setRows([])
      setCanonicalFilesReady(false)
      setLoadError('Canonical lead spreadsheets could not be loaded. Changes are disabled to prevent duplicates.')
      filesHydratedRef.current = true
    }
    finally { setLoading(false) }
  }, [])

  const fetchRows = useCallback(async (fileId: string): Promise<LeadRow[]> => {
    setRowsLoading(true)
    remoteRowIdsRef.current = new Set()
    try {
      if (!isSupabaseConfigured) {
        let localRows: LeadRow[] = []
        const saved = localStorage.getItem(`exodia-lead-rows-${fileId}`)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed)) localRows = parsed
          } catch {}
        }
        localRowIdsRef.current = new Set(localRows.map(row => row.id))
        rowsHydratedFileIdRef.current = fileId
        setRows(localRows)
        return localRows
      }
      if (!supabase) throw new Error('Canonical lead storage is configured but unavailable.')
      localRowIdsRef.current = new Set()
      const { data, error } = await supabase
        .from('lead_rows')
        .select('*')
        .eq('file_id', fileId)
        .order('row_index', { ascending: true })
      if (error) throw error
      if (data) {
        remoteRowIdsRef.current = new Set(data.map((row: LeadRow) => row.id))
        rowsHydratedFileIdRef.current = fileId
        setRows(data)
        return data
      }
      return []
    } catch (err) {
      console.error('Error fetching rows:', err)
      rowsHydratedFileIdRef.current = null
      setRows([])
      setSelectedFile(current => current?.id === fileId ? null : current)
      alert('Canonical spreadsheet rows could not be loaded. The spreadsheet was closed to prevent unsafe changes.')
      return []
    }
    finally { setRowsLoading(false) }
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
      try { supabase?.removeChannel(fileChannel) } catch {}
      try { supabase?.removeChannel(rowsChannel) } catch {}
    }
  }, [fetchFiles, selectedFile, fetchRows])

  // Listen for cross-tab localStorage changes and custom events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'exodia-lead-files') {
        fetchFiles()
      } else if (e.key?.startsWith('exodia-lead-rows-')) {
        if (selectedFile && e.key === `exodia-lead-rows-${selectedFile.id}`) {
          fetchRows(selectedFile.id)
        }
      }
    }
    const handleDataChanged = () => {
      fetchFiles()
      if (selectedFile) fetchRows(selectedFile.id)
    }
    const handleLeadGenerationDataChanged = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source
      if (source === 'lead-generation') return
      handleDataChanged()
    }
    if (!isSupabaseConfigured) window.addEventListener('storage', handleStorage)
    window.addEventListener('lead-data-changed', handleLeadGenerationDataChanged)
    return () => {
      if (!isSupabaseConfigured) window.removeEventListener('storage', handleStorage)
      window.removeEventListener('lead-data-changed', handleLeadGenerationDataChanged)
    }
  }, [fetchFiles, selectedFile, fetchRows])

  // Notify other components when files or rows change
  useEffect(() => { window.dispatchEvent(new CustomEvent('lead-data-changed', { detail: { source: 'lead-generation' } })) }, [files])
  useEffect(() => {
    if (selectedFile) window.dispatchEvent(new CustomEvent('lead-data-changed', { detail: { source: 'lead-generation' } }))
  }, [rows, selectedFile])

  // Persist files to localStorage on every change
  useEffect(() => {
    if (isSupabaseConfigured) return
    if (!loading && filesHydratedRef.current) {
      const localFiles = files.filter(file =>
        localFileIdsRef.current.has(file.id) || !remoteFileIdsRef.current.has(file.id)
      )
      localFiles.forEach(file => localFileIdsRef.current.add(file.id))
      localStorage.setItem('exodia-lead-files', JSON.stringify(localFiles))
    }
  }, [files, loading])

  // Persist rows to localStorage on every change
  useEffect(() => {
    if (isSupabaseConfigured) return
    if (selectedFile && rowsHydratedFileIdRef.current === selectedFile.id) {
      const localRows = rows.filter(row =>
        localRowIdsRef.current.has(row.id) || !remoteRowIdsRef.current.has(row.id)
      )
      localRows.forEach(row => localRowIdsRef.current.add(row.id))
      localStorage.setItem(`exodia-lead-rows-${selectedFile.id}`, JSON.stringify(localRows))
    }
  }, [rows, selectedFile])

  const routeDuplicateRows = async (rowIds: string[]) => {
    if (rowIds.length === 0) return
    if (!isSupabaseConfigured || !supabase || !canonicalFilesReady) {
      throw new Error('Canonical lead storage must load successfully before routing duplicates.')
    }
    const { data: movedCount, error } = await supabase.rpc('route_lead_rows_to_duplicates', { p_row_ids: rowIds })
    if (error) throw error
    if (movedCount !== rowIds.length) throw new Error('Not every duplicate row was moved.')
    await fetchFiles()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!isSupabaseConfigured || !supabase || !canonicalFilesReady) {
      e.target.value = ''
      alert('Canonical lead storage has not loaded successfully. No CSV was imported.')
      return
    }

    const uploadId = `csv-${crypto.randomUUID()}`
    emitUploadStatus(uploadId, `Uploading ${file.name}`, 'uploading', 10)
    try {
      const text = await file.text()
      const { headers, rows: parsedRows } = parseCSV(text)
      if (headers.length === 0) {
        emitUploadStatus(uploadId, `Uploading ${file.name}`, 'error', 100)
        alert('CSV file is empty or invalid')
        return
      }
      emitUploadStatus(uploadId, `Uploading ${file.name}`, 'uploading', 35)

      const fileName = file.name.replace(/\.csv$/i, '')
      const { data: importResult, error: importError } = await supabase.rpc('import_lead_file', {
        p_name: fileName,
        p_columns: headers,
        p_source: 'csv',
        p_rows: parsedRows,
      })
      if (importError) throw importError
      const imported = importResult?.[0]
      if (!imported?.file_id) throw new Error('The atomic lead import did not return a canonical spreadsheet.')
      emitUploadStatus(uploadId, `Uploading ${file.name}`, 'uploading', 55)
      await fetchFiles()
      if (imported.duplicate_count > 0) {
        setDuplicateModal({ type: 'upload', count: imported.duplicate_count, sourceFileName: fileName })
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
      emitUploadStatus(uploadId, `Uploaded ${file.name}`, 'done', 100)
      logActivity('LeadGen', `Uploaded "${fileName}" (${parsedRows.length} rows)`)
    } catch (err) {
      console.error('Error uploading CSV:', err)
      emitUploadStatus(uploadId, `Upload failed: ${file.name}`, 'error', 100)
      alert('Failed to upload CSV file')
    }
  }

  const appendCallingCardLead = async (file: File, sourceLabel: 'upload' | 'camera') => {
    if (!file.type.startsWith('image/')) {
      emitUploadStatus(callingCardUploadIdRef.current, 'Please choose an image file', 'error', 100)
      return
    }
    if (!isSupabaseConfigured || !supabase || !canonicalFilesReady) {
      throw new Error('Canonical lead storage must load successfully before scanning a calling card.')
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token) throw new Error('Your session expired. Sign in again before scanning a calling card.')

    const aiImageDataUrl = await prepareImageForAi(file)
    const { response, data } = await fetchJsonWithTimeout('/api/extract-calling-card', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: aiImageDataUrl }),
    })
    if (!response.ok || data?.error) throw new Error(formatExtractionError(data))
    const parsedLead = mapAiLeadToRow(data.lead || {})
    const usefulFields = ['Name', 'Company', 'Role / Position', 'Email', 'Contact Number', 'Address']
    if (!usefulFields.some(field => parsedLead[field]?.trim())) {
      throw new Error('AI could not read usable lead details from this calling card. Please try a clearer, closer photo.')
    }

    const rowData = CALLING_CARD_COLUMNS.reduce((acc, col) => {
      acc[col] = parsedLead[col] || ''
      return acc
    }, {} as Record<string, string>)
    const { data: appendResult, error: appendError } = await supabase.rpc('append_calling_card_lead', { p_data: rowData })
    if (appendError) throw appendError
    const appended = appendResult?.[0]
    if (!appended?.file_id || !appended?.row_id) {
      throw new Error('The atomic calling-card import did not return a canonical row.')
    }
    const { data: targetFile, error: fileError } = await supabase
      .from('lead_files')
      .select('*')
      .eq('id', appended.file_id)
      .single()
    if (fileError || !targetFile) throw fileError || new Error('Could not load the calling-card spreadsheet.')
    await fetchFiles()
    setSelectedFile(targetFile)
    await fetchRows(targetFile.id)
    setEditingCell(null)
    logActivity('LeadGen', `${sourceLabel === 'camera' ? 'Captured' : 'Uploaded'} calling card lead`)
  }

  const processCallingCardQueue = async () => {
    if (processingCallingCardQueueRef.current) return
    processingCallingCardQueueRef.current = true
    try {
      while (callingCardQueueRef.current.length > 0) {
        const next = callingCardQueueRef.current.shift()!
        const total = Math.max(callingCardTotalRef.current, 1)
        emitUploadStatus(callingCardUploadIdRef.current, `Extracting calling cards (${callingCardDoneRef.current + 1}/${total})`, 'uploading', Math.max(5, Math.round((callingCardDoneRef.current / total) * 100)))
        await appendCallingCardLead(next.file, next.sourceLabel)
        callingCardDoneRef.current += 1
        emitUploadStatus(callingCardUploadIdRef.current, `Extracting calling cards (${callingCardDoneRef.current}/${total})`, 'uploading', Math.round((callingCardDoneRef.current / total) * 100))
      }
      emitUploadStatus(callingCardUploadIdRef.current, 'Calling card upload complete', 'done', 100)
      callingCardDoneRef.current = 0
      callingCardTotalRef.current = 0
    } catch (err) {
      console.error('Error adding calling card photo:', err)
      emitUploadStatus(callingCardUploadIdRef.current, 'Calling card upload failed', 'error', 100)
      callingCardDoneRef.current = 0
      callingCardTotalRef.current = 0
    } finally {
      processingCallingCardQueueRef.current = false
    }
  }

  const handleCallingCardPhoto = (e: React.ChangeEvent<HTMLInputElement>, sourceLabel: 'upload' | 'camera') => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return
    if (!isSupabaseConfigured || !supabase || !canonicalFilesReady) {
      e.target.value = ''
      alert('Canonical lead storage has not loaded successfully. No calling card was queued.')
      return
    }
    callingCardQueueRef.current.push(...selectedFiles.map(file => ({ file, sourceLabel })))
    callingCardTotalRef.current += selectedFiles.length
    emitUploadStatus(callingCardUploadIdRef.current, `${callingCardTotalRef.current - callingCardDoneRef.current} calling card photo${callingCardTotalRef.current - callingCardDoneRef.current === 1 ? '' : 's'} queued`, 'queued', Math.round((callingCardDoneRef.current / Math.max(callingCardTotalRef.current, 1)) * 100))
    e.target.value = ''
    processCallingCardQueue()
  }

  const createSpreadsheet = async () => {
    const name = newSpreadsheetName.trim()
    if (!name) return
    if (!isSupabaseConfigured || !supabase || !canonicalFilesReady) {
      alert('Canonical lead storage has not loaded successfully. No spreadsheet was created.')
      return
    }

    setCreatingSpreadsheet(true)
    try {
      const columns: string[] = []
      for (let i = 0; i < 50; i++) columns.push(colToLetter(i))

      const emptyRowData = columns.reduce((acc, col) => { acc[col] = ''; return acc }, {} as Record<string, string>)
      const emptyRows = Array.from({ length: 50 }, () => ({ ...emptyRowData }))
      const { data: importResult, error: importError } = await supabase.rpc('import_lead_file', {
        p_name: name,
        p_columns: columns,
        p_source: 'spreadsheet',
        p_rows: emptyRows,
      })
      if (importError) throw importError
      if (!importResult?.[0]?.file_id) throw new Error('The atomic spreadsheet creation did not return a canonical record.')
      await fetchFiles()
      setShowNewSpreadsheetModal(false)
      setNewSpreadsheetName('')
      logActivity('LeadGen', `Created spreadsheet "${name}"`)
    } catch (err) {
      console.error('Error creating spreadsheet:', err)
      alert('Failed to create spreadsheet')
    } finally { setCreatingSpreadsheet(false) }
  }

  const openFile = async (file: LeadFile) => {
    rowsHydratedFileIdRef.current = null
    setSelectedFile(file)
    const fileRows = await fetchRows(file.id)
    // Scan the returned rows directly (not state — avoids timing issues with renders)
    const emailCol = file.columns.find(h => h.toLowerCase().includes('email'))
    if (emailCol && fileRows.length > 0) {
      const seen = new Map<string, LeadRow[]>()
      for (const row of fileRows) {
        const val = row.data[emailCol]
        if (!val || !val.trim()) continue
        const key = val.trim().toLowerCase()
        if (!seen.has(key)) seen.set(key, [])
        seen.get(key)!.push(row)
      }
      const dupes: { email: string; rows: LeadRow[] }[] = []
      for (const [email, matchingRows] of seen) {
        if (matchingRows.length > 1) dupes.push({ email, rows: matchingRows })
      }
      if (dupes.length > 0) {
        setDuplicateModal({
          type: 'in-file',
          count: dupes.reduce((sum, d) => sum + d.rows.length - 1, 0),
          email: dupes[0].email,
          dupes,
        })
      }
    }
  }

  const closeFile = () => {
    rowsHydratedFileIdRef.current = null
    setSelectedFile(null)
    setRows([])
    setEditingCell(null)
  }

  const canMutateRemoteFile = (fileId: string) => {
    if (!isSupabaseConfigured || !supabase) {
      alert('Canonical storage is unavailable. This spreadsheet remains read-only and no browser data was changed.')
      return false
    }
    if (!canonicalFilesReady) {
      alert('Canonical lead storage has not loaded successfully. No changes were made.')
      return false
    }
    if (!remoteFileIdsRef.current.has(fileId) || localFileIdsRef.current.has(fileId)) {
      alert('This browser-only spreadsheet is preserved as read-only because it has no unambiguous canonical Supabase record.')
      return false
    }
    return true
  }

  const canMutateRemoteRow = (rowId: string, fileId: string) => {
    if (!canMutateRemoteFile(fileId)) return false
    if (!remoteRowIdsRef.current.has(rowId) || localRowIdsRef.current.has(rowId)) {
      alert('This browser-only row is preserved as read-only because it has no unambiguous canonical Supabase record.')
      return false
    }
    return true
  }

  const hasBrowserOnlyRows = () =>
    rows.some(row => !remoteRowIdsRef.current.has(row.id) || localRowIdsRef.current.has(row.id))

  const handleCellClick = (row: LeadRow, col: string) => {
    if (!selectedFile || !canMutateRemoteRow(row.id, selectedFile.id)) return
    setEditingCell({ rowId: row.id, col })
    setEditValue(row.data[col] || '')
  }

  const isEmailDuplicateAcrossFiles = async (email: string, excludeFileId: string, excludeRowId?: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase || !canonicalFilesReady) {
      throw new Error('Canonical lead storage must load successfully before checking duplicates.')
    }
    const normalized = email.toLowerCase().trim()
    const { data: allRows, error } = await supabase
      .from('lead_rows')
      .select('id, file_id, data')
    if (error) throw error
    if (allRows) {
      for (const r of allRows) {
        if (r.file_id === excludeFileId && excludeRowId && r.id === excludeRowId) continue
        const file = files.find(f => f.id === r.file_id)
        if (!file) continue
        const emailCol = file.columns.find((h: string) => h.toLowerCase().includes('email'))
        if (!emailCol) continue
        const val = (r.data as Record<string, string>)[emailCol]
        if (val && val.toLowerCase().trim() === normalized) return true
      }
    }
    return false
  }

  const saveCellEdit = async () => {
    if (!editingCell || !selectedFile) return
    const row = rows.find(r => r.id === editingCell.rowId)
    if (!row) return
    if (!canMutateRemoteRow(row.id, selectedFile.id) || !supabase) return

    try {
      const emailCol = selectedFile.columns.find(h => h.toLowerCase().includes('email'))
      const isEmailColumn = emailCol && editingCell.col.toLowerCase() === emailCol.toLowerCase()
      const newVal = editValue.trim()

      if (isEmailColumn && newVal) {
        const isDup = await isEmailDuplicateAcrossFiles(newVal, selectedFile.id, editingCell.rowId)
        if (isDup) {
          setDuplicateModal({
            type: 'cell-edit',
            email: newVal,
            rowId: editingCell.rowId,
            fileId: selectedFile.id,
            rowData: row.data,
          })
          setEditingCell(null)
          return
        }
      }

      const newData = { ...row.data, [editingCell.col]: editValue }
      const now = new Date().toISOString()
      const { data: updatedRow, error } = await supabase
        .from('lead_rows')
        .update({ data: newData, updated_at: now })
        .eq('id', editingCell.rowId)
        .eq('file_id', selectedFile.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!updatedRow) throw new Error('The canonical row no longer exists.')

      setRows(prev => prev.map(r => r.id === editingCell.rowId ? { ...r, data: newData, updated_at: now } : r))
      setEditingCell(null)
      logActivity('LeadGen', `Edited cell in "${selectedFile.name}"`)
    } catch (err) {
      console.error('Error saving cell:', err)
      alert('The cell could not be saved to canonical storage. Your visible data was not changed.')
    }
  }

  const addRow = async () => {
    if (!selectedFile) return
    if (!canMutateRemoteFile(selectedFile.id) || !supabase) return
    if (rowsHydratedFileIdRef.current !== selectedFile.id) {
      alert('Canonical spreadsheet rows have not loaded successfully. No row was created.')
      return
    }
    const newRowData: Record<string, string> = {}
    selectedFile.columns.forEach(col => { newRowData[col] = '' })
    const remoteRows = rows.filter(row => remoteRowIdsRef.current.has(row.id) && !localRowIdsRef.current.has(row.id))
    const newIndex = remoteRows.length > 0 ? Math.max(...remoteRows.map(r => r.row_index)) + 1 : 0
    try {
      const { data, error } = await supabase
        .from('lead_rows')
        .insert([{ file_id: selectedFile.id, row_index: newIndex, data: newRowData }])
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('The canonical row was not returned after creation.')
      remoteRowIdsRef.current.add(data.id)
      setRows(prev => [...prev, data])
    } catch (err) {
      console.error('Error adding row:', err)
      alert('The row could not be created in canonical storage. Your visible data was not changed.')
    }
  }

  const deleteRow = async (rowId: string) => {
    if (!selectedFile || !canMutateRemoteRow(rowId, selectedFile.id) || !supabase) return
    if (!window.confirm('Delete this row?')) return
    try {
      const { data, error } = await supabase
        .from('lead_rows')
        .delete()
        .eq('id', rowId)
        .eq('file_id', selectedFile.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('The canonical row no longer exists.')
      remoteRowIdsRef.current.delete(rowId)
      setRows(prev => prev.filter(r => r.id !== rowId))
    } catch (err) {
      console.error('Error deleting row:', err)
      alert('The row could not be deleted from canonical storage. Your visible data was not changed.')
    }
  }

  const addColumn = async () => {
    if (!selectedFile) return
    if (!canMutateRemoteFile(selectedFile.id) || !supabase) return
    if (hasBrowserOnlyRows()) {
      alert('This spreadsheet contains browser-only rows. They are preserved as read-only, so its columns cannot be changed.')
      return
    }
    const newName = colToLetter(selectedFile.columns.length)
    const newColumns = [...selectedFile.columns, newName]
    try {
      const { data, error } = await supabase
        .from('lead_files')
        .update({ columns: newColumns })
        .eq('id', selectedFile.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('The canonical spreadsheet no longer exists.')
      setSelectedFile({ ...selectedFile, columns: newColumns })
      setFiles(prev => prev.map(file => file.id === selectedFile.id ? { ...file, columns: newColumns } : file))
      setRows(prev => prev.map(row => ({ ...row, data: { ...row.data, [newName]: '' } })))
    } catch (err) {
      console.error('Error adding column:', err)
      alert('The column could not be added to canonical storage. Your visible data was not changed.')
    }
  }

  const deleteColumn = async (colIndex: number) => {
    if (!selectedFile || selectedFile.columns.length <= 1) return
    if (!canMutateRemoteFile(selectedFile.id) || !supabase) return
    if (hasBrowserOnlyRows()) {
      alert('This spreadsheet contains browser-only rows. They are preserved as read-only, so its columns cannot be changed.')
      return
    }
    const colName = selectedFile.columns[colIndex]
    const newColumns = selectedFile.columns.filter((_, i) => i !== colIndex)
    try {
      const { data, error } = await supabase
        .from('lead_files')
        .update({ columns: newColumns })
        .eq('id', selectedFile.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('The canonical spreadsheet no longer exists.')
      setSelectedFile({ ...selectedFile, columns: newColumns })
      setFiles(prev => prev.map(file => file.id === selectedFile.id ? { ...file, columns: newColumns } : file))
      setRows(prev => prev.map(row => {
        const data = { ...row.data }
        delete data[colName]
        return { ...row, data }
      }))
    } catch (err) {
      console.error('Error deleting column:', err)
      alert('The column could not be deleted from canonical storage. Your visible data was not changed.')
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!canMutateRemoteFile(fileId) || !supabase) return
    if (!window.confirm('Delete this file and all its data?')) return
    const file = files.find(f => f.id === fileId)
    try {
      const { data, error } = await supabase
        .from('lead_files')
        .delete()
        .eq('id', fileId)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('The canonical spreadsheet no longer exists.')

      remoteFileIdsRef.current.delete(fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
      if (selectedFile?.id === fileId) closeFile()
      if (file) logActivity('LeadGen', `Deleted "${file.name}"`)
      window.dispatchEvent(new CustomEvent('lead-file-deleted', { detail: fileId }))
    } catch (err) {
      console.error('Error deleting file:', err)
      alert('The spreadsheet could not be deleted from canonical storage. No browser data was removed.')
    }
  }

  const removeInFileDuplicates = async () => {
    if (duplicateModal?.type !== 'in-file') return
    const rowsToRemove = (duplicateModal.dupes || []).flatMap(duplicate =>
      duplicate.rows.length > 1 ? duplicate.rows.slice(1) : []
    )
    if (rowsToRemove.length === 0) return
    const activeFile = filesRef.current.find(file => file.id === rowsToRemove[0].file_id)
    if (!activeFile || !canMutateRemoteFile(activeFile.id) || !supabase) return
    if (rowsToRemove.some(row => !remoteRowIdsRef.current.has(row.id) || localRowIdsRef.current.has(row.id))) {
      alert('Browser-only duplicate rows were preserved. Only unambiguous canonical rows can be removed.')
      return
    }

    try {
      await routeDuplicateRows(rowsToRemove.map(row => row.id))
      await fetchRows(activeFile.id)
      setDuplicateModal(null)
    } catch (err) {
      console.error('Error removing duplicate rows:', err)
      await fetchRows(activeFile.id)
      alert('Duplicate removal stopped at the first server error. The current canonical rows have been reloaded.')
    }
  }

  const removeDuplicateCellRow = async () => {
    if (duplicateModal?.type !== 'cell-edit' || !duplicateModal.rowId || !duplicateModal.fileId || !selectedFile) return
    const row = rows.find(item => item.id === duplicateModal.rowId)
    if (!row || !canMutateRemoteRow(row.id, duplicateModal.fileId) || !supabase) return

    try {
      await routeDuplicateRows([row.id])
      await fetchRows(duplicateModal.fileId)
      setDuplicateModal(null)
    } catch (err) {
      console.error('Error removing duplicate row:', err)
      await fetchRows(duplicateModal.fileId)
      alert('The duplicate row could not be removed completely. The current canonical rows have been reloaded.')
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
    if (draggedColumn === null || !selectedFile) return
    if (draggedColumn === targetIdx) {
      setDraggedColumn(null)
      return
    }
    if (!canMutateRemoteFile(selectedFile.id) || !supabase) {
      setDraggedColumn(null)
      return
    }
    if (hasBrowserOnlyRows()) {
      alert('This spreadsheet contains browser-only rows. They are preserved as read-only, so its columns cannot be reordered.')
      setDraggedColumn(null)
      return
    }

    const newColumns = [...selectedFile.columns]
    const [movedCol] = newColumns.splice(draggedColumn, 1)
    newColumns.splice(targetIdx, 0, movedCol)

    try {
      const { data, error } = await supabase
        .from('lead_files')
        .update({ columns: newColumns })
        .eq('id', selectedFile.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('The canonical spreadsheet no longer exists.')
      setSelectedFile({ ...selectedFile, columns: newColumns })
      setFiles(prev => prev.map(file => file.id === selectedFile.id ? { ...file, columns: newColumns } : file))
    } catch (err) {
      console.error('Error reordering columns:', err)
      await fetchFiles()
      alert('The columns could not be reordered. The previous canonical order was retained.')
    } finally {
      setDraggedColumn(null)
    }
  }

  const handleRowDragStart = (rowIdx: number) => {
    setDraggedRow(rowIdx)
  }

  const handleRowDrop = async (targetIdx: number) => {
    if (draggedRow === null || !selectedFile) return
    if (draggedRow === targetIdx) {
      setDraggedRow(null)
      return
    }
    if (!canMutateRemoteFile(selectedFile.id) || !supabase) {
      setDraggedRow(null)
      return
    }
    if (hasBrowserOnlyRows()) {
      alert('This spreadsheet contains browser-only rows. They are preserved as read-only, so its rows cannot be reordered.')
      setDraggedRow(null)
      return
    }

    const newRows = [...rows]
    const [movedRow] = newRows.splice(draggedRow, 1)
    newRows.splice(targetIdx, 0, movedRow)
    const orderedRows = newRows.map((row, rowIndex) => ({ ...row, row_index: rowIndex }))

    try {
      for (const row of orderedRows) {
        const { data, error } = await supabase
          .from('lead_rows')
          .update({ row_index: row.row_index })
          .eq('id', row.id)
          .eq('file_id', selectedFile.id)
          .select('id')
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error(`Canonical row ${row.id} no longer exists.`)
      }
      setRows(orderedRows)
    } catch (err) {
      console.error('Error reordering rows:', err)
      await fetchRows(selectedFile.id)
      alert('The row reorder stopped at the first server error. The current canonical order has been reloaded.')
    } finally {
      setDraggedRow(null)
    }
  }

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200))
  }

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50))
  }

  if (selectedFile) {
    return (
      <div className="h-screen flex flex-col bg-white">
        {/* Menu Bar */}
        <div className="flex items-center px-2 py-1 border-b border-[#CACDD7] bg-white">
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => { setSelectedFile(null); setRows([]); setEditingCell(null) }}
              className="p-1.5 rounded-lg hover:bg-[rgba(202,205,215,0.3)] transition"
              style={{ color: 'var(--accent)' }}
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
          <button
            onClick={exportCSV}
            className="px-3 py-1 text-sm text-[#3E4048] hover:bg-[rgba(202,205,215,0.2)] rounded"
          >
            Download CSV
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[#CACDD7] bg-[rgba(202,205,215,0.15)] flex-wrap">
          <div className="flex items-center gap-1 border border-[#CACDD7] rounded px-2 py-1 bg-white">
            <button onClick={zoomOut} className="text-[#3E4048] hover:text-[#1B1A1C]">-</button>
            <span className="text-xs text-[#3E4048] min-w-[40px] text-center">{zoom}%</span>
            <button onClick={zoomIn} className="text-[#3E4048] hover:text-[#1B1A1C]">+</button>
          </div>
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
                          <span className="flex-1 px-2 py-1 text-xs font-semibold text-[#3E4048] rounded truncate" title="Column names are read-only until transactional rename support is available">
                            {col}
                          </span>
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
                        return (
                          <td
                            key={col}
                            className="border-b border-r border-[#CACDD7] px-1 py-0.5 text-[10px] cursor-cell"
                            onClick={() => handleCellClick(row, col)}
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
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
        <div className="p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lead Generation</h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Upload CSV files, create sheets, or extract calling cards with AI</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(loadError || (isSupabaseConfigured && !canonicalFilesReady)) && (
        <div
          role={loadError ? 'alert' : 'status'}
          className="rounded-xl px-4 py-3 mb-6 text-sm"
          style={{ backgroundColor: 'rgba(180,83,9,0.1)', border: '1px solid rgba(180,83,9,0.25)', color: 'var(--text-primary)' }}
        >
          {loadError || 'Loading canonical lead storage. Create and upload actions are temporarily disabled.'}
        </div>
      )}

      {/* Upload / Create */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-6 sm:mb-8">
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} disabled={!canonicalActionsEnabled} className="hidden" />
        <button
          type="button"
          disabled={!canonicalActionsEnabled}
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 enabled:cursor-pointer enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 theme-transition"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}
        >
          <span className="flex flex-col items-center gap-4">
            <span className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-8 h-8" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </span>
            <span>
              <span className="block text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload CSV File</span>
              <span className="block text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Import existing data</span>
            </span>
          </span>
        </button>

        <div
          aria-disabled={!canonicalActionsEnabled}
          className={`rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 theme-transition ${canonicalActionsEnabled ? 'hover:-translate-y-0.5' : 'cursor-not-allowed opacity-60'}`}
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}
        >
          <input ref={callingCardInputRef} type="file" accept="image/*" multiple onChange={(e) => handleCallingCardPhoto(e, 'upload')} disabled={!canonicalActionsEnabled} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleCallingCardPhoto(e, 'camera')} disabled={!canonicalActionsEnabled} className="hidden" />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300" style={{ backgroundColor: 'rgba(11,128,67,0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#0B8043' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25A2.25 2.25 0 015.25 6h13.5A2.25 2.25 0 0121 8.25v7.5A2.25 2.25 0 0118.75 18H5.25A2.25 2.25 0 013 15.75v-7.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5h4.5M7.5 13.5h7.5M17.25 10.5h.01" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>AI Calling Card</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Extract lead details from a picture</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                disabled={!canonicalActionsEnabled}
                onClick={() => callingCardInputRef.current?.click()}
                className="px-3 py-2 text-sm rounded-lg transition disabled:cursor-not-allowed"
                style={{ backgroundColor: 'rgba(11,128,67,0.1)', color: '#0B8043', fontWeight: 600 }}
              >
                Upload
              </button>
              <button
                type="button"
                disabled={!canonicalActionsEnabled}
                onClick={() => cameraInputRef.current?.click()}
                className="px-3 py-2 text-sm rounded-lg transition disabled:cursor-not-allowed"
                style={{ backgroundColor: '#0B8043', color: '#FFFFFF', fontWeight: 600 }}
              >
                Camera
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!canonicalActionsEnabled}
          onClick={() => setShowNewSpreadsheetModal(true)}
          className="w-full rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 enabled:cursor-pointer enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 theme-transition"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}
        >
          <span className="flex flex-col items-center gap-4">
            <span className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#2563EB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </span>
            <span>
              <span className="block text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Create Spreadsheet</span>
              <span className="block text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Start from scratch</span>
            </span>
          </span>
        </button>
      </div>

      {showNewSpreadsheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowNewSpreadsheetModal(false); setNewSpreadsheetName('') }} />
          <div className="relative rounded-2xl border w-full max-w-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create New Spreadsheet</h2>
              <button onClick={() => { setShowNewSpreadsheetModal(false); setNewSpreadsheetName('') }} className="p-1 rounded-full transition" style={{ color: 'var(--accent)' }}>
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
                disabled={!canonicalActionsEnabled || creatingSpreadsheet}
                className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
                placeholder="e.g., Q3 Lead List"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-primary)' }}>
              <button onClick={() => { setShowNewSpreadsheetModal(false); setNewSpreadsheetName('') }} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={createSpreadsheet} disabled={!canonicalActionsEnabled || !newSpreadsheetName.trim() || creatingSpreadsheet} className="px-5 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>
                {creatingSpreadsheet && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>CSV Files</h2>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>{files.filter(f => f.source === 'csv').length}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div></div>
            ) : files.filter(f => f.source === 'csv').length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No CSV files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {files.filter(f => f.source === 'csv').map((file) => (
                  <div key={file.id} className="group rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }} onClick={() => openFile(file)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)' }}>
                          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</h3>
                          <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{file.columns.length} columns · {new Date(file.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id) }} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 hover:bg-red-50" style={{ color: 'var(--text-muted)' }} title="Delete">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #2563EB, #60A5FA, #93C5FD)' }}></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Spreadsheets</h2>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>{files.filter(f => f.source === 'spreadsheet').length}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#2563EB' }}></div></div>
            ) : files.filter(f => f.source === 'spreadsheet').length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No spreadsheets created yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {files.filter(f => f.source === 'spreadsheet').map((file) => (
                  <div key={file.id} className="group rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }} onClick={() => openFile(file)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
                          <svg className="w-5 h-5" style={{ color: '#2563EB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</h3>
                          <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{file.columns.length} columns · {new Date(file.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id) }} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 hover:bg-red-50" style={{ color: 'var(--text-muted)' }} title="Delete">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Notification Modal */}
      {duplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)' }} onClick={() => setDuplicateModal(null)} />
          <div className="relative rounded-2xl border p-6 sm:p-8 max-w-md w-full theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,89,0,0.1)' }}>
                <svg className="w-5 h-5" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Duplicate Lead Detected</h3>
            </div>

            {duplicateModal.type === 'upload' && (
              <>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#FF5900' }}>{duplicateModal.count}</strong> duplicate lead(s) from <strong>"{duplicateModal.sourceFileName}"</strong> were found and automatically moved to the <strong>"Duplicate Leads"</strong> file under Spreadsheets.
                </p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setDuplicateModal(null)} className="px-4 py-2 text-sm rounded-lg transition" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Dismiss</button>
                </div>
              </>
            )}

            {duplicateModal.type === 'in-file' && (
              <>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#FF5900' }}>{duplicateModal.count}</strong> duplicate row(s) found in this file. The email <strong style={{ color: '#FF5900' }}>"{duplicateModal.email}"</strong> appears multiple times.
                </p>
                <ul className="text-xs mb-4 space-y-1 max-h-[140px] overflow-y-auto" style={{ color: 'var(--text-muted)' }}>
                  {duplicateModal.dupes?.map((d, i) => (
                    <li key={i} className="p-1.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <span style={{ color: '#FF5900' }}>{d.email}</span> — {d.rows.length} occurrences
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setDuplicateModal(null)} className="px-4 py-2 text-sm rounded-lg transition" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Dismiss</button>
                  {duplicateModal.dupes?.[0]?.rows[0]?.id && (
                    <button onClick={removeInFileDuplicates} className="px-4 py-2 text-sm rounded-lg transition hover:opacity-90" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 500 }}>
                      Remove all duplicates
                    </button>
                  )}
                </div>
              </>
            )}

            {duplicateModal.type === 'cell-edit' && (
              <>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  The email <strong style={{ color: '#FF5900' }}>"{duplicateModal.email}"</strong> already exists in another file or row. What would you like to do?
                </p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setDuplicateModal(null)} className="px-4 py-2 text-sm rounded-lg transition" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                  <button
                    onClick={removeDuplicateCellRow}
                    className="px-4 py-2 text-sm rounded-lg transition hover:opacity-90"
                    style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 500 }}
                  >
                    Remove from sheet
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
