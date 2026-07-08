import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
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

interface TimelineColumn {
  key: string
  label: string
  emailTemplateId?: string
}

interface TimelineTable {
  id: string
  title: string
  columns: TimelineColumn[]
  created_at?: string
}

interface MessageTemplate {
  id: string
  title: string
  category: string
  subject: string
  body: string
}

const CALLING_CARD_COLUMNS = ['Name', 'Company', 'Role / Position', 'Email', 'Contact Number', 'Address', 'Notes', 'Raw OCR Text']
const CALLING_CARD_FILE_NAME = 'Calling Card Leads'
const INTRODUCTORY_CALL_COLUMN: TimelineColumn = { key: 'introductory-call', label: 'Introductory Call' }

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

const letterToCol = (letter: string): number => {
  let col = 0
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64)
  }
  return col - 1
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
      throw new Error(`AI extraction timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try a clearer photo or a smaller image.`)
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

const parseTimelineColumns = (columns: TimelineColumn[] | string | null | undefined): TimelineColumn[] => {
  if (typeof columns === 'string') {
    try { return JSON.parse(columns) } catch { return [] }
  }
  return Array.isArray(columns) ? columns : []
}

const findIntroductoryColumn = (columns: TimelineColumn[]) =>
  columns.find(col => col.label.toLowerCase() === INTRODUCTORY_CALL_COLUMN.label.toLowerCase()) || INTRODUCTORY_CALL_COLUMN

const ensureIntroductoryColumn = (table: TimelineTable): TimelineTable => {
  const columns = parseTimelineColumns(table.columns)
  if (columns.some(col => col.label.toLowerCase() === INTRODUCTORY_CALL_COLUMN.label.toLowerCase())) {
    return { ...table, columns }
  }
  return { ...table, columns: [INTRODUCTORY_CALL_COLUMN, ...columns] }
}

const buildTimelineLead = (rowData: Record<string, string>, now: string, columnKey: string) => {
  const email = rowData.Email.trim()
  return {
    company: rowData.Company.trim() || rowData.Name.trim() || 'Unknown Company',
    contact: rowData.Name.trim() || email || 'Unknown Contact',
    email,
    value: '',
    date: now.slice(0, 10),
    column_key: columnKey,
    notes: [
      'Auto-created from calling card upload',
      rowData['Role / Position'] && `Role: ${rowData['Role / Position']}`,
      rowData['Contact Number'] && `Phone: ${rowData['Contact Number']}`,
      rowData.Address && `Address: ${rowData.Address}`,
      rowData.Notes,
    ].filter(Boolean).join('\n'),
    attachments: [],
    email_history: [],
    created_at: now,
    updated_at: now,
  }
}

const loadMessageTemplates = async (): Promise<MessageTemplate[]> => {
  const saved = localStorage.getItem('exodia-message-templates')
  let templates: MessageTemplate[] = saved ? JSON.parse(saved) : []
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false })
    if (error) throw error
    if (data) {
      templates = data
      localStorage.setItem('exodia-message-templates', JSON.stringify(data))
    }
  }
  return templates
}

const findTemplateForColumn = (templates: MessageTemplate[], column: TimelineColumn) =>
  templates.find(template => template.id === column.emailTemplateId) ||
  (column.label.toLowerCase() === INTRODUCTORY_CALL_COLUMN.label.toLowerCase()
    ? templates.find(template => /introductory call/i.test(`${template.title} ${template.category}`))
    : undefined)

const fillMessageTemplate = (text: string, rowData: Record<string, string>) =>
  text
    .replace(/\{\{contact_name\}\}/g, rowData.Name || rowData.Email || 'there')
    .replace(/\{\{company_name\}\}/g, rowData.Company || 'your company')
    .replace(/\{\{sender_name\}\}/g, 'Marketing Team')
    .replace(/\{\{sales_rep_name\}\}/g, 'our Sales Team')
    .replace(/\{\{ops_rep_name\}\}/g, 'our Operations Team')
    .replace(/\{\{proposed_date\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    .replace(/\{\{project_name\}\}/g, rowData.Company || 'your project')

const escapeEmailHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const plainTextToEmailHtml = (message: string, rowData: Record<string, string>) => {
  const paragraphs = message
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;">${escapeEmailHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('\n        ')

  return `<div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#1B1A1C;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eceef2;">
      <div style="background:#FF5900;padding:28px 32px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.2;">Exodia Game Development</h1>
        <p style="margin:8px 0 0;color:#ffe7da;font-size:14px;">Marketing Department</p>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${escapeEmailHtml(rowData.Name || rowData.Email || 'there')},</p>
        ${paragraphs}
        <a href="https://exodiagamedev.com" style="display:inline-block;background:#FF5900;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 22px;font-weight:700;font-size:14px;">Book a Call</a>
        <p style="margin:28px 0 0;font-size:15px;line-height:1.7;">Best regards,<br>Marketing Team</p>
      </div>
    </div>
  </div>
</div>`
}

const ensureDesignedEmailBody = (body: string, rowData: Record<string, string>) =>
  /<\/?[a-z][\s\S]*>/i.test(body) ? body : plainTextToEmailHtml(body, rowData)

const htmlToPlainText = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const sendColumnTemplateEmail = async (rowData: Record<string, string>, column: TimelineColumn) => {
  const to = rowData.Email.trim()
  if (!to || !isSupabaseConfigured || !supabase) return null
  const template = findTemplateForColumn(await loadMessageTemplates(), column)
  if (!template) return null
  const subject = fillMessageTemplate(template.subject, rowData)
  const htmlBody = ensureDesignedEmailBody(fillMessageTemplate(template.body, rowData), rowData)
  const { error } = await supabase.functions.invoke('send-outreach-email', {
    body: {
      to,
      name: rowData.Name || to,
      subject,
      body: htmlToPlainText(htmlBody),
      htmlBody,
      messageId: `<${crypto.randomUUID()}@exodiagamedev.com>`,
    },
  })
  if (error) throw error
  return { template, subject, body: htmlBody }
}

const appendTimelineNote = (lead: any, note: string) => ({
  ...lead,
  notes: [lead.notes, note].filter(Boolean).join('\n'),
})

const addCallingCardToTimeline = async (rowData: Record<string, string>, now: string) => {
  const savedTables = localStorage.getItem('exodia-timeline-tables')
  let tables: TimelineTable[] = savedTables ? JSON.parse(savedTables) : []
  if (tables.length === 0) {
    tables = [{ id: 'onboarding-default', title: 'Client Onboarding', columns: [INTRODUCTORY_CALL_COLUMN], created_at: now }]
  }
  tables[0] = ensureIntroductoryColumn(tables[0])
  const localColumn = findIntroductoryColumn(tables[0].columns)
  const localLead = buildTimelineLead(rowData, now, localColumn.key)
  const savedLeads = localStorage.getItem('exodia-timeline-leads')
  const leads = savedLeads ? JSON.parse(savedLeads) : []
  const localLeadId = crypto.randomUUID()
  leads.push({ id: localLeadId, table_id: tables[0].id, ...localLead })
  localStorage.setItem('exodia-timeline-tables', JSON.stringify(tables))
  localStorage.setItem('exodia-timeline-leads', JSON.stringify(leads))
  window.dispatchEvent(new CustomEvent('timeline-data-changed'))

  if (isSupabaseConfigured && supabase) {
    let { data: tableData } = await supabase.from('timeline_tables').select('*').order('created_at', { ascending: false }).limit(1)
    let table = tableData?.[0] ? ensureIntroductoryColumn(tableData[0]) : null
    if (!table) {
      const { data, error } = await supabase.from('timeline_tables').insert([{ title: 'Client Onboarding', columns: [INTRODUCTORY_CALL_COLUMN] }]).select().single()
      if (error) throw error
      table = ensureIntroductoryColumn(data)
    } else if (!parseTimelineColumns(tableData?.[0]?.columns).some(col => col.label.toLowerCase() === INTRODUCTORY_CALL_COLUMN.label.toLowerCase())) {
      const { error } = await supabase.from('timeline_tables').update({ columns: table.columns }).eq('id', table.id)
      if (error) throw error
    }
    const supabaseColumn = findIntroductoryColumn(table.columns)
    const supabaseLead = buildTimelineLead(rowData, now, supabaseColumn.key)
    const { data: insertedLead, error } = await supabase.from('timeline_leads').insert([{ table_id: table.id, ...supabaseLead }]).select().single()
    if (error) throw error
    try {
      const sent = await sendColumnTemplateEmail(rowData, { ...supabaseColumn, emailTemplateId: supabaseColumn.emailTemplateId || localColumn.emailTemplateId })
      if (sent) {
        const sentNote = `Auto email sent: ${sent.template.title}`
        const saved = localStorage.getItem('exodia-timeline-leads')
        const localLeads = saved ? JSON.parse(saved) : []
        localStorage.setItem('exodia-timeline-leads', JSON.stringify(localLeads.map((lead: any) => lead.id === localLeadId ? appendTimelineNote(lead, sentNote) : lead)))
        await supabase.from('timeline_leads').update({ notes: appendTimelineNote(insertedLead, sentNote).notes }).eq('id', insertedLead.id)
      }
    } catch (err) {
      console.error('Auto email failed:', err)
    }
    window.dispatchEvent(new CustomEvent('timeline-data-changed'))
  }
}

export default function LeadGeneration() {
  const [files, setFiles] = useState<LeadFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<LeadFile | null>(null)
  const [rows, setRows] = useState<LeadRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const callingCardInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<LeadFile[]>([])
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
  const historyRef = useRef<{ rows: LeadRow[]; columns: string[]; cellFormats: Record<string, CellFormat> }[]>([])
  const historyIndexRef = useRef(-1)
  const skipHistoryRef = useRef(false)

  useEffect(() => { filesRef.current = files }, [files])

  // Auto-push to history on every rows change
  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return }
    if (!selectedFile) return
    const snapshot = {
      rows: JSON.parse(JSON.stringify(rows)),
      columns: [...selectedFile.columns],
      cellFormats: JSON.parse(JSON.stringify(cellFormats)),
    }
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snapshot)
    if (historyRef.current.length > 50) historyRef.current.shift()
    historyIndexRef.current = historyRef.current.length - 1
  }, [rows])

  const saveSnapshot = useCallback(() => {
    if (!selectedFile) return
    const snapshot = {
      rows: JSON.parse(JSON.stringify(rows)),
      columns: [...selectedFile.columns],
      cellFormats: JSON.parse(JSON.stringify(cellFormats)),
    }
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snapshot)
    if (historyRef.current.length > 50) historyRef.current.shift()
    historyIndexRef.current = historyRef.current.length - 1
  }, [rows, selectedFile, cellFormats])

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current--
    const snapshot = historyRef.current[historyIndexRef.current]
    skipHistoryRef.current = true
    setRows(snapshot.rows)
    setCellFormats(snapshot.cellFormats)
    setSelectedFile(prev => prev ? { ...prev, columns: snapshot.columns } : prev)
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    const snapshot = historyRef.current[historyIndexRef.current]
    skipHistoryRef.current = true
    setRows(snapshot.rows)
    setCellFormats(snapshot.cellFormats)
    setSelectedFile(prev => prev ? { ...prev, columns: snapshot.columns } : prev)
  }, [])

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

  const fetchRows = useCallback(async (fileId: string): Promise<LeadRow[]> => {
    setRowsLoading(true)
    try {
      if (!isSupabaseConfigured || !supabase) {
        const saved = localStorage.getItem(`exodia-lead-rows-${fileId}`)
        if (saved) {
          const data = JSON.parse(saved)
          setRows(data)
          return data
        }
        setRows([])
        return []
      }
      const { data, error } = await supabase
        .from('lead_rows')
        .select('*')
        .eq('file_id', fileId)
        .order('row_index', { ascending: true })
      if (error) throw error
      if (data) { setRows(data); localStorage.setItem(`exodia-lead-rows-${fileId}`, JSON.stringify(data)); return data }
      return []
    } catch (err) { console.error('Error fetching rows:', err); return [] }
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
    window.addEventListener('storage', handleStorage)
    window.addEventListener('lead-data-changed', handleLeadGenerationDataChanged)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('lead-data-changed', handleLeadGenerationDataChanged)
    }
  }, [fetchFiles, selectedFile, fetchRows])

  // Notify other components when files or rows change
  useEffect(() => { window.dispatchEvent(new CustomEvent('lead-data-changed', { detail: { source: 'lead-generation' } })) }, [files])
  useEffect(() => {
    if (selectedFile) window.dispatchEvent(new CustomEvent('lead-data-changed', { detail: { source: 'lead-generation' } }))
  }, [rows, selectedFile])

  // Persist files to localStorage on every change
  useEffect(() => { localStorage.setItem('exodia-lead-files', JSON.stringify(files)) }, [files])

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
    if (rowsToCheck.length === 0) return 0

    const emailCol = columns.find(h => h.toLowerCase().includes('email'))
    if (!emailCol) return 0

    const existingEmails = new Set<string>()

    if (supabase) {
      const { data: allRows } = await supabase
        .from('lead_rows')
        .select('file_id, data')
        .neq('file_id', sourceFileId)

      if (allRows) {
        allRows.forEach(r => {
          const data = r.data as Record<string, string>
          if (data[emailCol]) existingEmails.add(data[emailCol].toLowerCase().trim())
        })
      }
    } else {
      // localStorage mode — read other files' rows
      const savedFiles = localStorage.getItem('exodia-lead-files')
      if (savedFiles) {
        const allFiles: LeadFile[] = JSON.parse(savedFiles)
        for (const f of allFiles) {
          if (f.id === sourceFileId) continue
          const savedRows = localStorage.getItem(`exodia-lead-rows-${f.id}`)
          if (savedRows) {
            try {
              const rows: LeadRow[] = JSON.parse(savedRows)
              rows.forEach(r => {
                if (r.data[emailCol]) existingEmails.add(r.data[emailCol].toLowerCase().trim())
              })
            } catch {}
          }
        }
      }
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

    if (supabase) {
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
    } else {
      // localStorage mode — create/update "Duplicate Leads" file
      let savedFiles = localStorage.getItem('exodia-lead-files')
      let allFiles: LeadFile[] = savedFiles ? JSON.parse(savedFiles) : []
      let dupFile = allFiles.find(f => f.name === 'Duplicate Leads')

      if (!dupFile) {
        dupFile = {
          id: crypto.randomUUID(),
          name: 'Duplicate Leads',
          columns: [...columns, 'Source File'],
          source: 'spreadsheet',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        allFiles.unshift(dupFile)
        localStorage.setItem('exodia-lead-files', JSON.stringify(allFiles))
        setFiles(allFiles)
      }

      const savedDupRows = localStorage.getItem(`exodia-lead-rows-${dupFile.id}`)
      const existingDupRows: LeadRow[] = savedDupRows ? JSON.parse(savedDupRows) : []
      const startIdx = existingDupRows.length > 0 ? Math.max(...existingDupRows.map(r => r.row_index)) + 1 : 0

      const now = new Date().toISOString()
      const newRows: LeadRow[] = duplicateRows.map((row, idx) => ({
        id: crypto.randomUUID(),
        file_id: dupFile!.id,
        row_index: startIdx + idx,
        data: { ...row, 'Source File': sourceFileName },
        created_at: now,
        updated_at: now,
      }))

      localStorage.setItem(`exodia-lead-rows-${dupFile.id}`, JSON.stringify([...existingDupRows, ...newRows]))
    }

    return duplicateRows.length
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
      emitUploadStatus(uploadId, `Uploading ${file.name}`, 'uploading', 55)

      if (parsedRows.length > 0) {
        const emailCol = headers.find(h => h.toLowerCase().includes('email'))
        let existingEmails = new Set<string>()

        if (emailCol) {
          if (supabase) {
            const { data: allRows } = await supabase
              .from('lead_rows')
              .select('data')
            if (allRows) {
              allRows.forEach(r => {
                const data = r.data as Record<string, string>
                if (data[emailCol]) existingEmails.add(data[emailCol].toLowerCase().trim())
              })
            }
          } else {
            // localStorage mode — read all rows across all files
            const savedFiles = localStorage.getItem('exodia-lead-files')
            if (savedFiles) {
              const allFiles: LeadFile[] = JSON.parse(savedFiles)
              for (const f of allFiles) {
                const savedRows = localStorage.getItem(`exodia-lead-rows-${f.id}`)
                if (savedRows) {
                  try {
                    const rows: LeadRow[] = JSON.parse(savedRows)
                    rows.forEach(r => {
                      if (r.data[emailCol]) existingEmails.add(r.data[emailCol].toLowerCase().trim())
                    })
                  } catch {}
                }
              }
            }
          }
        }

        // Filter out cross-file duplicates only — keep within-file duplicates so the in-file modal can handle them
        const crossFileUniqueRows: Record<string, string>[] = []
        parsedRows.forEach(row => {
          if (emailCol && row[emailCol]) {
            const email = row[emailCol].toLowerCase().trim()
            if (existingEmails.has(email)) {
              // cross-file duplicate — skip this row, it will be routed by checkAndRouteDuplicates
              return
            }
            // Track within-file duplicates for the modal's row data
            crossFileUniqueRows.push(row)
          } else {
            crossFileUniqueRows.push(row)
          }
        })

        if (crossFileUniqueRows.length > 0) {
          const rowInserts = crossFileUniqueRows.map((row, idx) => ({
            file_id: newFile.id,
            row_index: idx,
            data: row,
          }))
          if (supabase) {
            const { error: rowsError } = await supabase.from('lead_rows').insert(rowInserts)
            if (rowsError) throw rowsError
          } else {
            const now = new Date().toISOString()
            const localRows: LeadRow[] = rowInserts.map(r => ({
              id: crypto.randomUUID(),
              file_id: r.file_id,
              row_index: r.row_index,
              data: r.data,
              created_at: now,
              updated_at: now,
            }))
            localStorage.setItem(`exodia-lead-rows-${newFile.id}`, JSON.stringify(localRows))
          }
        }

        const duplicateCount = await checkAndRouteDuplicates(parsedRows, newFile.id, newFile.name, headers)

        if (duplicateCount > 0) {
          setDuplicateModal({ type: 'upload', count: duplicateCount, sourceFileName: newFile.name })
        }
      }

      setFiles(prev => [newFile, ...prev])
      if (fileInputRef.current) fileInputRef.current.value = ''
      emitUploadStatus(uploadId, `Uploaded ${file.name}`, 'done', 100)
      logActivity('LeadGen', `Uploaded "${newFile.name}" (${parsedRows.length} rows)`)
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

    const aiImageDataUrl = await prepareImageForAi(file)
    const { response, data } = await fetchJsonWithTimeout('/api/extract-calling-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: aiImageDataUrl }),
    })
    if (!response.ok || data?.error) throw new Error(formatExtractionError(data))
    const parsedLead = mapAiLeadToRow(data.lead || {})
    const usefulFields = ['Name', 'Company', 'Role / Position', 'Email', 'Contact Number', 'Address']
    if (!usefulFields.some(field => parsedLead[field]?.trim())) {
      throw new Error('AI could not read usable lead details from this calling card. Please try a clearer, closer photo.')
    }

    const now = new Date().toISOString()
    let targetFile = filesRef.current.find(file => file.name === CALLING_CARD_FILE_NAME && file.source === 'spreadsheet')
    if (!targetFile) {
      const fileId = crypto.randomUUID()
      targetFile = { id: fileId, name: CALLING_CARD_FILE_NAME, columns: CALLING_CARD_COLUMNS, source: 'spreadsheet', created_at: now, updated_at: now }
      if (isSupabaseConfigured && supabase) {
        const { data: fileData, error: fileError } = await supabase
          .from('lead_files')
          .insert([{ name: CALLING_CARD_FILE_NAME, columns: CALLING_CARD_COLUMNS, source: 'spreadsheet' }])
          .select()
          .single()
        if (fileError) throw fileError
        targetFile = fileData
      }
      if (!targetFile) throw new Error('Could not create calling card spreadsheet')
      const createdFile = targetFile
      filesRef.current = [createdFile, ...filesRef.current]
      setFiles(prev => [createdFile, ...prev])
      localStorage.setItem(`exodia-lead-rows-${createdFile.id}`, JSON.stringify([]))
    }

    const existingRows = await fetchRows(targetFile.id)
    const rowIndex = existingRows.length > 0 ? Math.max(...existingRows.map(row => row.row_index)) + 1 : 0
    const rowData = CALLING_CARD_COLUMNS.reduce((acc, col) => {
      acc[col] = parsedLead[col] || ''
      return acc
    }, {} as Record<string, string>)
    let newRow: LeadRow = {
      id: crypto.randomUUID(),
      file_id: targetFile.id,
      row_index: rowIndex,
      data: rowData,
      created_at: now,
      updated_at: now,
    }

    if (isSupabaseConfigured && supabase) {
      const { data: rowResult, error: rowError } = await supabase
        .from('lead_rows')
        .insert([{ file_id: targetFile.id, row_index: rowIndex, data: rowData }])
        .select()
        .single()
      if (rowError) throw rowError
      if (rowResult) newRow = rowResult
    }

    const nextRows = [...existingRows, newRow]
    localStorage.setItem(`exodia-lead-rows-${targetFile.id}`, JSON.stringify(nextRows))
    setSelectedFile(targetFile)
    setRows(nextRows)
    setEditingCell(null)
    setEditingHeader(null)
    try {
      await addCallingCardToTimeline(rowData, now)
    } catch (err) {
      console.error('Error adding calling card to timeline:', err)
    }
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
    callingCardQueueRef.current.push(...selectedFiles.map(file => ({ file, sourceLabel })))
    callingCardTotalRef.current += selectedFiles.length
    emitUploadStatus(callingCardUploadIdRef.current, `${callingCardTotalRef.current - callingCardDoneRef.current} calling card photo${callingCardTotalRef.current - callingCardDoneRef.current === 1 ? '' : 's'} queued`, 'queued', Math.round((callingCardDoneRef.current / Math.max(callingCardTotalRef.current, 1)) * 100))
    e.target.value = ''
    processCallingCardQueue()
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

        const dbRows = emptyRows.map(r => ({ file_id: newFile.id, row_index: r.row_index, data: r.data }))
        const { data: insertedRows, error: rowsError } = await supabase.from('lead_rows').insert(dbRows).select()
        if (rowsError) throw rowsError
        if (insertedRows) {
          emptyRows.splice(0, emptyRows.length, ...insertedRows)
        }
      }

      setFiles(prev => [newFile, ...prev])
      localStorage.setItem(`exodia-lead-rows-${newFile.id}`, JSON.stringify(emptyRows))
      setShowNewSpreadsheetModal(false)
      setNewSpreadsheetName('')
      logActivity('LeadGen', `Created spreadsheet "${name}"`)
    } catch (err) {
      console.error('Error creating spreadsheet:', err)
      alert('Failed to create spreadsheet')
    } finally { setCreatingSpreadsheet(false) }
  }

  const openFile = async (file: LeadFile) => {
    setSelectedFile(file)
    const fileRows = await fetchRows(file.id)
    historyRef.current = []
    historyIndexRef.current = -1
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
    setSelectedFile(null)
    setRows([])
    setEditingCell(null)
    setEditingHeader(null)
    setCurrentCellRef('A1')
    setFormulaValue('')
    historyRef.current = []
    historyIndexRef.current = -1
  }

  const handleCellClick = (row: LeadRow, col: string, rowIdx: number, colIdx: number) => {
    const cellRef = `${col}${rowIdx + 1}`
    setCurrentCellRef(cellRef)
    setFormulaValue(row.data[col] || '')
    setEditingCell({ rowId: row.id, col })
    setEditValue(row.data[col] || '')
  }

  const isEmailDuplicateAcrossFiles = async (email: string, excludeFileId: string, excludeRowId?: string): Promise<boolean> => {
    const normalized = email.toLowerCase().trim()
    if (supabase) {
      const { data: allRows } = await supabase
        .from('lead_rows')
        .select('id, file_id, data')
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
    } else {
      const savedFiles = localStorage.getItem('exodia-lead-files')
      if (savedFiles) {
        const allFiles: LeadFile[] = JSON.parse(savedFiles)
        for (const f of allFiles) {
          if (f.id === excludeFileId) continue
          const emailCol = f.columns.find(h => h.toLowerCase().includes('email'))
          if (!emailCol) continue
          const savedRows = localStorage.getItem(`exodia-lead-rows-${f.id}`)
          if (savedRows) {
            try {
              const rows: LeadRow[] = JSON.parse(savedRows)
              for (const r of rows) {
                if (r.data[emailCol] && r.data[emailCol].toLowerCase().trim() === normalized) return true
              }
            } catch {}
          }
        }
      }
      // Also check within the same file (excluding the current row)
      if (selectedFile && excludeFileId === selectedFile.id) {
        for (const r of rows) {
          if (excludeRowId && r.id === excludeRowId) continue
          const emailCol = selectedFile.columns.find(h => h.toLowerCase().includes('email'))
          if (emailCol && r.data[emailCol] && r.data[emailCol].toLowerCase().trim() === normalized) return true
        }
      }
    }
    return false
  }

  const saveCellEdit = async () => {
    if (!editingCell || !selectedFile) return
    const row = rows.find(r => r.id === editingCell.rowId)
    if (!row) return

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
    setRows(prev => prev.map(r => r.id === editingCell.rowId ? { ...r, data: newData, updated_at: now } : r))
    setEditingCell(null)

if (supabase) {
        try {
          await supabase.from('lead_rows').update({ data: newData, updated_at: now }).eq('id', editingCell.rowId)
        } catch (err) { console.error('Error saving cell:', err) }
      }
      logActivity('LeadGen', `Edited cell in "${selectedFile.name}"`)
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
    if (!confirm('Delete this file and all its data?')) return
    const file = files.find(f => f.id === fileId)
    if (isSupabaseConfigured && supabase) {
      await supabase.from('lead_files').delete().eq('id', fileId)
    }
    // Clean up localStorage
    localStorage.removeItem(`exodia-lead-rows-${fileId}`)
    setFiles(prev => prev.filter(f => f.id !== fileId))
    if (selectedFile?.id === fileId) closeFile()
    if (file) logActivity('LeadGen', `Deleted "${file.name}"`)
    window.dispatchEvent(new CustomEvent('lead-file-deleted', { detail: fileId }))
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
    saveSnapshot()
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
          <button onClick={undo} className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Undo">
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button onClick={redo} className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Redo">
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Print">
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Borders">
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Align left">
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Align center">
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-[rgba(202,205,215,0.3)] rounded" title="Align right">
            <svg className="w-4 h-4 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Upload / Create */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-6 sm:mb-8">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 hover:-translate-y-0.5 theme-transition"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}
        >
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-8 h-8" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload CSV File</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Import existing data</p>
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 hover:-translate-y-0.5 theme-transition"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}
        >
          <input ref={callingCardInputRef} type="file" accept="image/*" multiple onChange={(e) => handleCallingCardPhoto(e, 'upload')} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleCallingCardPhoto(e, 'camera')} className="hidden" />
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
                onClick={() => callingCardInputRef.current?.click()}
                className="px-3 py-2 text-sm rounded-lg transition"
                style={{ backgroundColor: 'rgba(11,128,67,0.1)', color: '#0B8043', fontWeight: 600 }}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-3 py-2 text-sm rounded-lg transition"
                style={{ backgroundColor: '#0B8043', color: '#FFFFFF', fontWeight: 600 }}
              >
                Camera
              </button>
            </div>
          </div>
        </div>

        <div
          onClick={() => setShowNewSpreadsheetModal(true)}
          className="rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 hover:-translate-y-0.5 theme-transition"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#2563EB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Create Spreadsheet</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Start from scratch</p>
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
                    <button onClick={async () => {
                      const rowsToRemove: LeadRow[] = []
                      for (const d of (duplicateModal.dupes || [])) {
                        if (d.rows.length <= 1) continue
                        for (let i = 1; i < d.rows.length; i++) rowsToRemove.push(d.rows[i])
                      }
                      if (rowsToRemove.length === 0) return
                      const activeFile = filesRef.current.find(file => file.id === rowsToRemove[0]?.file_id) || null
                      for (const row of rowsToRemove) {
                        try {
                          if (activeFile) {
                            await checkAndRouteDuplicates([row.data], activeFile.id, activeFile.name, activeFile.columns)
                          }
                          if (supabase) {
                            await supabase.from('lead_rows').delete().eq('id', row.id)
                          } else if (activeFile) {
                            const saved = localStorage.getItem(`exodia-lead-rows-${activeFile.id}`)
                            if (saved) {
                              const localRows: LeadRow[] = JSON.parse(saved)
                              localStorage.setItem(`exodia-lead-rows-${activeFile.id}`, JSON.stringify(localRows.filter(r => r.id !== row.id)))
                            }
                          }
                        } catch {}
                      }
                      setRows(prev => prev.filter(r => !rowsToRemove.some(rm => rm.id === r.id)))
                      setDuplicateModal(null)
                    }} className="px-4 py-2 text-sm rounded-lg transition hover:opacity-90" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 500 }}>
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
                    onClick={async () => {
                      const activeFile = selectedFile as LeadFile | null
                      if (!duplicateModal.rowId || !duplicateModal.fileId || !activeFile) return
                      const row = rows.find(r => r.id === duplicateModal.rowId)
                      if (!row) return
                      try {
                        await checkAndRouteDuplicates(
                          [duplicateModal.rowData || row.data],
                          duplicateModal.fileId,
                          activeFile.name,
                          activeFile.columns
                        )
                        if (supabase) {
                          await supabase.from('lead_rows').delete().eq('id', duplicateModal.rowId)
                        } else {
                          const saved = localStorage.getItem(`exodia-lead-rows-${duplicateModal.fileId}`)
                          if (saved) {
                            const localRows: LeadRow[] = JSON.parse(saved)
                            localStorage.setItem(`exodia-lead-rows-${duplicateModal.fileId}`, JSON.stringify(localRows.filter(r => r.id !== duplicateModal.rowId)))
                          }
                        }
                        setRows(prev => prev.filter(r => r.id !== duplicateModal.rowId))
                        setDuplicateModal(null)
                      } catch {}
                    }}
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
