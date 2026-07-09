import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logActivity } from '../lib/activityLogger'

interface TimelineColumn {
  key: string
  label: string
  emailTemplateId?: string
}

interface TimelineTable {
  id: string
  title: string
  columns: TimelineColumn[]
  created_at: string
}

interface EmailHistoryItem {
  date: string
  subject: string
  preview: string
}

interface TimelineLead {
  id: string
  table_id: string
  company: string
  contact: string
  email: string
  value: string
  date: string
  column_key: string
  notes: string
  attachments: string[]
  email_history: EmailHistoryItem[]
  last_email_sent?: string
  checklist?: { text: string; done: boolean }[]
  created_at: string
  updated_at: string
}

interface MessageTemplate {
  id: string
  title: string
  category: string
  subject: string
  body: string
}

const defaultColumns = (): TimelineColumn[] => [
  { key: 'col-1', label: 'Initial Contact' },
  { key: 'col-2', label: 'Discovery Call' },
  { key: 'col-3', label: 'Proposal Sent' },
  { key: 'col-4', label: 'SOW & Pricing Finalization' },
  { key: 'col-5', label: 'Closed Won' },
]

const fillTimelineTemplate = (text: string, lead: TimelineLead) =>
  text
    .replace(/\{\{contact_name\}\}/g, lead.contact || lead.email || 'there')
    .replace(/\{\{company_name\}\}/g, lead.company || 'your company')
    .replace(/\{\{sender_name\}\}/g, 'Marketing Team')
    .replace(/\{\{sales_rep_name\}\}/g, 'our Sales Team')
    .replace(/\{\{ops_rep_name\}\}/g, 'our Operations Team')
    .replace(/\{\{proposed_date\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    .replace(/\{\{project_name\}\}/g, lead.company || 'your project')

const escapeEmailHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const plainTextToEmailHtml = (message: string, lead: TimelineLead) => {
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
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${escapeEmailHtml(lead.contact || lead.email || 'there')},</p>
        ${paragraphs}
        <a href="https://exodiagamedev.com" style="display:inline-block;background:#FF5900;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 22px;font-weight:700;font-size:14px;">Book a Call</a>
        <p style="margin:28px 0 0;font-size:15px;line-height:1.7;">Best regards,<br>Marketing Team</p>
      </div>
    </div>
  </div>
</div>`
}

const ensureDesignedEmailBody = (body: string, lead: TimelineLead) =>
  /<\/?[a-z][\s\S]*>/i.test(body) ? body : plainTextToEmailHtml(body, lead)

const htmlToPlainText = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export default function Timeline() {
  const { user } = useAuth()
  const [tables, setTables] = useState<TimelineTable[]>([])
  const [leads, setLeads] = useState<TimelineLead[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedColumn, setDraggedColumn] = useState<{ tableId: string; colKey: string } | null>(null)
  const [selectedLead, setSelectedLead] = useState<TimelineLead | null>(null)
  const [editingTableTitle, setEditingTableTitle] = useState<string | null>(null)
  const [editingTableTitleValue, setEditingTableTitleValue] = useState('')
  const [editingColumnLabel, setEditingColumnLabel] = useState<{ tableId: string; colKey: string } | null>(null)
  const [editingColumnValue, setEditingColumnValue] = useState('')
  const [showAddTable, setShowAddTable] = useState(false)
  const [newTableTitle, setNewTableTitle] = useState('')
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [addColumnTableId, setAddColumnTableId] = useState<string>('')
  const [newColumnName, setNewColumnName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)
  const [addLeadTableId, setAddLeadTableId] = useState<string>('')
  const [addLeadColumnKey, setAddLeadColumnKey] = useState<string>('col-1')
  const [leadForm, setLeadForm] = useState({ company: '', contact: '', email: '', value: '', date: '' })
  const [editingLead, setEditingLead] = useState<TimelineLead | null>(null)
  const [newNote, setNewNote] = useState('')
  const [newAttachment, setNewAttachment] = useState('')
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [showSendEmail, setShowSendEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [lastEmailSent, setLastEmailSent] = useState('')
  const [editingLastEmail, setEditingLastEmail] = useState(false)
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [editingChecklistIdx, setEditingChecklistIdx] = useState<number | null>(null)
  const [editingChecklistValue, setEditingChecklistValue] = useState('')
  const [activeRightTab, setActiveRightTab] = useState('notes')
  const [showAddPopup, setShowAddPopup] = useState<'note' | 'checklist' | 'attachment' | null>(null)
  const [addPopupValue, setAddPopupValue] = useState('')
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    // Merge Supabase data + localStorage leads
    let localTables: TimelineTable[] = []
    let localLeads: TimelineLead[] = []

    // Read from localStorage fallback
    const savedTables = localStorage.getItem('exodia-timeline-tables')
    if (savedTables) {
      try { localTables = JSON.parse(savedTables) } catch {}
    }
    const savedLeads = localStorage.getItem('exodia-timeline-leads')
    if (savedLeads) {
      try { localLeads = JSON.parse(savedLeads) } catch {}
    }
    const fallbackTables = localTables
    const fallbackLeads = localLeads

    // Ensure a default onboarding table exists
    if (localTables.length === 0) {
      localTables = [{
        id: 'onboarding-default',
        title: 'Client Onboarding',
        columns: defaultColumns(),
        created_at: new Date().toISOString(),
      }]
      localStorage.setItem('exodia-timeline-tables', JSON.stringify(localTables))
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from('timeline_tables')
          .select('*')
          .order('created_at', { ascending: false })
        if (!tableError && tableData) {
          localTables = tableData.map((t: any) => ({
            ...t,
            columns: typeof t.columns === 'string' ? JSON.parse(t.columns) : t.columns,
          }))
        }

        const { data: leadData, error: leadError } = await supabase
          .from('timeline_leads')
          .select('*')
        if (!leadError && leadData) {
          localLeads = leadData.map((l: any) => ({
            ...l,
            attachments: typeof l.attachments === 'string' ? JSON.parse(l.attachments) : (l.attachments || []),
            email_history: typeof l.email_history === 'string' ? JSON.parse(l.email_history) : (l.email_history || []),
            last_email_sent: l.last_email_sent || '',
          }))
          const unsyncedCallingCards = fallbackLeads.filter(localLead =>
            localLead.notes?.includes('Auto-created from calling card upload') &&
            !localLeads.some(remoteLead =>
              (localLead.email && remoteLead.email === localLead.email && remoteLead.date === localLead.date && remoteLead.notes === localLead.notes) ||
              (!localLead.email && remoteLead.company === localLead.company && remoteLead.contact === localLead.contact && remoteLead.notes === localLead.notes)
            )
          )
          if (unsyncedCallingCards.length > 0) {
            localLeads = [...localLeads, ...unsyncedCallingCards]
            fallbackTables.forEach(table => {
              if (!localTables.some(remoteTable => remoteTable.id === table.id) && unsyncedCallingCards.some(lead => lead.table_id === table.id)) {
                localTables.push(table)
              }
            })
          }
        }
      } catch (err) {
        console.error('Error fetching timeline data:', err)
      }
    }

    setTables(localTables)
    setLeads(localLeads)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const interval = !isSupabaseConfigured || !supabase ? setInterval(fetchData, 15000) : undefined
    window.addEventListener('timeline-data-changed', fetchData)
    if (!isSupabaseConfigured || !supabase) return () => {
      if (interval) clearInterval(interval)
      window.removeEventListener('timeline-data-changed', fetchData)
    }
    const channel = supabase
      .channel('timeline_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_tables' }, () => { fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_leads' }, () => { fetchData() })
      .subscribe()
    return () => {
      try { supabase?.removeChannel(channel) } catch {}
      clearInterval(interval)
      window.removeEventListener('timeline-data-changed', fetchData)
    }
  }, [fetchData])

  // Persist to localStorage for cross-page sync
  useEffect(() => {
    localStorage.setItem('exodia-timeline-tables', JSON.stringify(tables))
  }, [tables])

  useEffect(() => {
    localStorage.setItem('exodia-timeline-leads', JSON.stringify(leads))
  }, [leads])

  useEffect(() => {
    const fetchTemplates = async () => {
      const saved = localStorage.getItem('exodia-message-templates')
      if (saved) {
        try { setTemplates(JSON.parse(saved)) } catch {}
      }
      if (!isSupabaseConfigured || !supabase) return
      try {
        const { data } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false })
        if (data) {
          setTemplates(data)
          localStorage.setItem('exodia-message-templates', JSON.stringify(data))
        }
      } catch (err) { console.error('Error fetching message templates:', err) }
    }
    fetchTemplates()
  }, [])

  const sendColumnAutoEmail = async (lead: TimelineLead, column: TimelineColumn) => {
    if (!column.emailTemplateId || !lead.email || !supabase) return lead
    const template = templates.find(t => t.id === column.emailTemplateId)
    if (!template) return lead

    const subject = fillTimelineTemplate(template.subject, lead)
    const htmlBody = ensureDesignedEmailBody(fillTimelineTemplate(template.body, lead), lead)
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const { error } = await supabase.functions.invoke('send-outreach-email', {
      body: {
        to: lead.email,
        name: lead.contact || lead.email,
        subject,
        body: htmlToPlainText(htmlBody),
        htmlBody,
        messageId: `<${crypto.randomUUID()}@exodiagamedev.com>`,
      },
    })
    if (error) throw error
    const updated = { ...lead, last_email_sent: today }
    setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
    await supabase.from('timeline_leads').update({ last_email_sent: today }).eq('id', lead.id)
    logActivity('Timeline', `Auto emailed "${lead.company}" using "${template.title}"`)
    return updated
  }

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', leadId)
  }

  const handleDragEnd = () => {}

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, tableId: string, columnKey: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    if (!leadId || !supabase) return

    // Check if the target column is at or past SOW
    const table = tables.find(t => t.id === tableId)
    if (table) {
      const targetIdx = table.columns.findIndex(c => c.key === columnKey)
      const sowIdx = table.columns.findIndex(c => /sow.*costing|costing.*sow/i.test(c.label))
      if (sowIdx !== -1 && targetIdx >= sowIdx) {
        const isSales = user?.email?.toLowerCase() === 'sales@exodiagamedev.com'
        if (!isSales) {
          alert('Only sales@exodiagamedev.com can move leads starting from SOW and Costing Creation.')
          return
        }
      }
    }

    const lead = leads.find(l => l.id === leadId)
    const targetColumn = table?.columns.find(c => c.key === columnKey)
    if (!lead || (lead.table_id === tableId && lead.column_key === columnKey)) return
    const movedLead = { ...lead, column_key: columnKey, table_id: tableId }
    setLeads(prev => prev.map(l => l.id === leadId ? movedLead : l))
    try {
      await supabase.from('timeline_leads').update({ column_key: columnKey, table_id: tableId, updated_at: new Date().toISOString() }).eq('id', leadId)
      if (targetColumn) await sendColumnAutoEmail(movedLead, targetColumn)
    } catch (err) { console.error('Error moving lead:', err) }
  }

const moveToNextColumn = async (lead: TimelineLead, table: TimelineTable) => {
    const currentIdx = table.columns.findIndex(c => c.key === lead.column_key)
    if (currentIdx === -1 || currentIdx >= table.columns.length - 1) return
    const nextCol = table.columns[currentIdx + 1]

    // Only sales can move leads at or past "SOW and Costing Creation"
    const sowIdx = table.columns.findIndex(c => /sow.*costing|costing.*sow/i.test(c.label))
    if (sowIdx !== -1 && currentIdx >= sowIdx) {
      const isSales = user?.email?.toLowerCase() === 'sales@exodiagamedev.com'
      if (!isSales) {
        alert('Only sales@exodiagamedev.com can move leads starting from SOW and Costing Creation.')
        return
      }
    }

    const movedLead = { ...lead, column_key: nextCol.key }
    setLeads(prev => prev.map(l => l.id === lead.id ? movedLead : l))
    if (supabase) {
      try {
        await supabase.from('timeline_leads').update({ column_key: nextCol.key, updated_at: new Date().toISOString() }).eq('id', lead.id)
        await sendColumnAutoEmail(movedLead, nextCol)
      } catch (err) { console.error('Error moving lead:', err) }
    }
  }

  const moveToPrevColumn = async (lead: TimelineLead, table: TimelineTable) => {
    const currentIdx = table.columns.findIndex(c => c.key === lead.column_key)
    if (currentIdx <= 0) return
    const prevCol = table.columns[currentIdx - 1]

    // Only sales can move leads at or past "SOW and Costing Creation"
    const sowIdx = table.columns.findIndex(c => /sow.*costing|costing.*sow/i.test(c.label))
    if (sowIdx !== -1 && currentIdx >= sowIdx) {
      const isSales = user?.email?.toLowerCase() === 'sales@exodiagamedev.com'
      if (!isSales) {
        alert('Only sales@exodiagamedev.com can move leads starting from SOW and Costing Creation.')
        return
      }
    }

    const movedLead = { ...lead, column_key: prevCol.key }
    setLeads(prev => prev.map(l => l.id === lead.id ? movedLead : l))
    if (supabase) {
      try {
        await supabase.from('timeline_leads').update({ column_key: prevCol.key, updated_at: new Date().toISOString() }).eq('id', lead.id)
        await sendColumnAutoEmail(movedLead, prevCol)
      } catch (err) { console.error('Error moving lead:', err) }
    }
  }

  // Column drag handlers
  const handleColumnDragStart = (e: React.DragEvent, tableId: string, colKey: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/column', JSON.stringify({ tableId, colKey }))
    setDraggedColumn({ tableId, colKey })
  }

  const handleColumnDragEnd = () => {
    setDraggedColumn(null)
  }

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleColumnDrop = async (e: React.DragEvent, targetTableId: string, targetColKey: string) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/column')
    if (!data || !supabase) return

    const { tableId, colKey } = JSON.parse(data)

    // Only allow reordering within the same table
    if (tableId !== targetTableId || colKey === targetColKey) {
      setDraggedColumn(null)
      return
    }

    const table = tables.find(t => t.id === tableId)
    if (!table) return

    // Reorder columns
    const columns = [...table.columns]
    const draggedIndex = columns.findIndex(c => c.key === colKey)
    const targetIndex = columns.findIndex(c => c.key === targetColKey)

    if (draggedIndex === -1 || targetIndex === -1) return

    const [draggedCol] = columns.splice(draggedIndex, 1)
    columns.splice(targetIndex, 0, draggedCol)

    try {
      const { error } = await supabase
        .from('timeline_tables')
        .update({ columns })
        .eq('id', tableId)
      if (error) throw error
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, columns } : t))
    } catch (err) { console.error('Error reordering columns:', err) }

    setDraggedColumn(null)
  }

  const addTimelineTable = async () => {
    const title = newTableTitle.trim() || `Timeline ${tables.length + 1}`
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('timeline_tables')
        .insert([{ title, columns: defaultColumns() }])
        .select()
        .single()
      if (error) throw error
      setTables(prev => [data, ...prev])
      setShowAddTable(false)
      setNewTableTitle('')
      logActivity('Timeline', `Created table "${data.title}"`)
    } catch (err) { console.error('Error adding table:', err) }
  }

  const deleteTimelineTable = async (tableId: string) => {
    if (!confirm('Delete this timeline table and all its leads?') || !supabase) return
    const table = tables.find(t => t.id === tableId)
    try {
      const { error } = await supabase.from('timeline_tables').delete().eq('id', tableId)
      if (error) throw error
    } catch (err) { console.error('Error deleting table:', err) }
  }

  const saveTableTitle = async (tableId: string) => {
    if (!supabase || !editingTableTitleValue.trim()) return
    try {
      const { error } = await supabase
        .from('timeline_tables')
        .update({ title: editingTableTitleValue.trim() })
        .eq('id', tableId)
      if (error) throw error
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, title: editingTableTitleValue.trim() } : t))
      logActivity('Timeline', `Renamed table to "${editingTableTitleValue.trim()}"`)
    } catch (err) { console.error('Error updating table title:', err) }
    setEditingTableTitle(null)
  }

  const saveColumnLabel = async (tableId: string, colKey: string) => {
    if (!supabase || !editingColumnValue.trim()) return
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    const newColumns = table.columns.map(c => c.key === colKey ? { ...c, label: editingColumnValue.trim() } : c)
    try {
      const { error } = await supabase
        .from('timeline_tables')
        .update({ columns: newColumns })
        .eq('id', tableId)
      if (error) throw error
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, columns: newColumns } : t))
    } catch (err) { console.error('Error updating column:', err) }
    setEditingColumnLabel(null)
  }

  const saveColumnTemplate = async (tableId: string, colKey: string, emailTemplateId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    const newColumns = table.columns.map(c => c.key === colKey ? { ...c, emailTemplateId: emailTemplateId || undefined } : c)
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, columns: newColumns } : t))
    if (!supabase) return
    try {
      const { error } = await supabase.from('timeline_tables').update({ columns: newColumns }).eq('id', tableId)
      if (error) throw error
    } catch (err) { console.error('Error updating column template:', err) }
  }

  const addColumn = async () => {
    const label = newColumnName.trim()
    if (!label || !supabase) return
    const table = tables.find(t => t.id === addColumnTableId)
    if (!table) return
    // Generate a new column key
    const maxColNum = table.columns.reduce((max, c) => {
      const num = parseInt(c.key.replace('col-', ''))
      return num > max ? num : max
    }, 0)
    const newKey = `col-${maxColNum + 1}`
    const newColumn = { key: newKey, label }
    const newColumns = [...table.columns, newColumn]
    try {
      const { error } = await supabase
        .from('timeline_tables')
        .update({ columns: newColumns })
        .eq('id', table.id)
      if (error) throw error
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, columns: newColumns } : t))
      setShowAddColumn(false)
      setNewColumnName('')
    } catch (err) { console.error('Error adding column:', err) }
  }

  const deleteColumn = async (tableId: string, colKey: string) => {
    if (!confirm('Delete this column and all its leads?')) return
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    
    // Update UI immediately
    const newColumns = table.columns.filter(c => c.key !== colKey)
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, columns: newColumns } : t))
    
    // Delete leads in this column
    if (supabase) {
      try {
        await supabase.from('timeline_leads').delete().eq('table_id', tableId).eq('column_key', colKey)
        await supabase.from('timeline_tables').update({ columns: newColumns }).eq('id', tableId)
      } catch (err) { console.error('Error deleting column:', err) }
    }
  }

  const addLead = async () => {
    if (!leadForm.company || !leadForm.contact || !leadForm.email || !supabase) { alert('Please fill in all fields'); return }
    const tempId = `temp-${Date.now()}`
    const newLead: TimelineLead = {
      id: tempId,
      table_id: addLeadTableId,
      column_key: addLeadColumnKey,
      ...leadForm,
      notes: '',
      attachments: [],
      email_history: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    // Add immediately to local state
    setLeads(prev => [...prev, newLead])
    setShowAddLead(false)
    setLeadForm({ company: '', contact: '', email: '', value: '', date: '' })
    logActivity('Timeline', `Added lead "${leadForm.company}"`)
    try {
      const { data, error } = await supabase
        .from('timeline_leads')
        .insert([{
          table_id: addLeadTableId,
          column_key: addLeadColumnKey,
          ...leadForm,
          notes: '',
          attachments: [],
          email_history: [],
        }])
        .select()
        .single()
      if (error) throw error
      // Replace temp lead with real one
      if (data) {
        setLeads(prev => prev.map(l => l.id === tempId ? data : l))
      }
    } catch (err) { console.error('Error adding lead:', err); alert('Failed to add lead') }
  }

  const updateLead = async () => {
    if (!editingLead || !supabase) return
    // Update local state immediately
    setLeads(prev => prev.map(l => l.id === editingLead.id ? { ...editingLead, updated_at: new Date().toISOString() } : l))
    if (selectedLead?.id === editingLead.id) setSelectedLead(editingLead)
    setEditingLead(null)
    try {
      const { error } = await supabase
        .from('timeline_leads')
        .update({ ...editingLead, updated_at: new Date().toISOString() })
        .eq('id', editingLead.id)
      if (error) throw error
    } catch (err) { console.error('Error updating lead:', err) }
  }

  const deleteLead = async (leadId: string) => {
    if (!confirm('Delete this lead?') || !supabase) return
    const lead = leads.find(l => l.id === leadId)
    setLeads(prev => prev.filter(l => l.id !== leadId))
    setSelectedLead(null)
    if (lead) logActivity('Timeline', `Deleted lead "${lead.company}"`)
    try {
      const { error } = await supabase.from('timeline_leads').delete().eq('id', leadId)
      if (error) throw error
    } catch (err) { console.error('Error deleting lead:', err) }
  }

  const addNote = async () => {
    if (!selectedLead || !addPopupValue.trim() || !supabase) return
    const updatedNotes = selectedLead.notes ? `${selectedLead.notes}\n${addPopupValue.trim()}` : addPopupValue.trim()
    const updated = { ...selectedLead, notes: updatedNotes }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    setShowAddPopup(null)
    setAddPopupValue('')
    logActivity('Timeline', `Added note to "${selectedLead.company}"`)
    try {
      await supabase.from('timeline_leads').update({ notes: updatedNotes }).eq('id', selectedLead.id)
    } catch (err) { console.error('Error adding note:', err) }
  }

  const deleteNote = async (noteIndex: number) => {
    if (!selectedLead || !supabase) return
    const notes = selectedLead.notes ? selectedLead.notes.split('\n').filter(n => n.trim()) : []
    notes.splice(noteIndex, 1)
    const updatedNotes = notes.join('\n')
    const updated = { ...selectedLead, notes: updatedNotes }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    try {
      await supabase.from('timeline_leads').update({ notes: updatedNotes }).eq('id', selectedLead.id)
    } catch (err) { console.error('Error deleting note:', err) }
  }

  const updateNote = async (noteIndex: number) => {
    if (!selectedLead || !editingNoteValue.trim() || !supabase) return
    const notes = selectedLead.notes ? selectedLead.notes.split('\n').filter(n => n.trim()) : []
    notes[noteIndex] = editingNoteValue.trim()
    const updatedNotes = notes.join('\n')
    const updated = { ...selectedLead, notes: updatedNotes }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    setEditingNoteIndex(null)
    setEditingNoteValue('')
    try {
      await supabase.from('timeline_leads').update({ notes: updatedNotes }).eq('id', selectedLead.id)
    } catch (err) { console.error('Error updating note:', err) }
  }

  const addAttachment = async () => {
    if (!selectedLead || !addPopupValue.trim() || !supabase) return
    const updatedAttachments = [...selectedLead.attachments, addPopupValue.trim()]
    const updated = { ...selectedLead, attachments: updatedAttachments }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    setShowAddPopup(null)
    setAddPopupValue('')
    try {
      await supabase.from('timeline_leads').update({ attachments: updatedAttachments }).eq('id', selectedLead.id)
    } catch (err) { console.error('Error adding attachment:', err) }
  }

  const deleteAttachment = async (attIndex: number) => {
    if (!selectedLead || !supabase) return
    const updatedAttachments = selectedLead.attachments.filter((_, i) => i !== attIndex)
    const updated = { ...selectedLead, attachments: updatedAttachments }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    try {
      await supabase.from('timeline_leads').update({ attachments: updatedAttachments }).eq('id', selectedLead.id)
    } catch (err) { console.error('Error deleting attachment:', err) }
  }

  const sendEmail = async () => {
    if (!selectedLead || !emailSubject.trim() || !supabase) return
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(selectedLead.email)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    window.open(gmailUrl, '_blank')
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const updated = { ...selectedLead, last_email_sent: today }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    setLastEmailSent(today)
    setShowSendEmail(false)
    setEmailSubject('')
setEmailBody('')
    logActivity('Timeline', `Emailed "${selectedLead.company}"`)
    try {
      await supabase.from('timeline_leads').update({ last_email_sent: today }).eq('id', selectedLead.id)
    } catch (err) { console.error('Error updating email date:', err) }
  }

  const saveLastEmailSent = async () => {
    if (!selectedLead || !supabase) return
    const updated = { ...selectedLead, last_email_sent: lastEmailSent }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    setEditingLastEmail(false)
    try {
      await supabase.from('timeline_leads').update({ last_email_sent: lastEmailSent }).eq('id', selectedLead.id)
    } catch (err) { console.error('Error saving email date:', err) }
  }

  const addChecklistItem = async () => {
    if (!selectedLead || !addPopupValue.trim()) return
    const checklist = selectedLead.checklist || []
    const updated = { ...selectedLead, checklist: [...checklist, { text: addPopupValue.trim(), done: false }] }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    setShowAddPopup(null)
    setAddPopupValue('')
    try { await supabase?.from('timeline_leads').update({ checklist: updated.checklist }).eq('id', selectedLead.id) } catch {}
  }

  const toggleChecklistItem = async (idx: number) => {
    if (!selectedLead || !selectedLead.checklist) return
    const checklist = [...selectedLead.checklist]
    checklist[idx] = { ...checklist[idx], done: !checklist[idx].done }
    const updated = { ...selectedLead, checklist }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    try { await supabase?.from('timeline_leads').update({ checklist }).eq('id', selectedLead.id) } catch {}
  }

  const deleteChecklistItem = async (idx: number) => {
    if (!selectedLead || !selectedLead.checklist) return
    const checklist = selectedLead.checklist.filter((_, i) => i !== idx)
    const updated = { ...selectedLead, checklist }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    try { await supabase?.from('timeline_leads').update({ checklist }).eq('id', selectedLead.id) } catch {}
  }

  const updateChecklistItem = async (idx: number) => {
    if (!selectedLead || !selectedLead.checklist || !editingChecklistValue.trim()) return
    const checklist = [...selectedLead.checklist]
    checklist[idx] = { ...checklist[idx], text: editingChecklistValue.trim() }
    const updated = { ...selectedLead, checklist }
    setSelectedLead(updated)
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
    setEditingChecklistIdx(null)
    setEditingChecklistValue('')
    try { await supabase?.from('timeline_leads').update({ checklist }).eq('id', selectedLead.id) } catch {}
  }

  const filteredTables = searchQuery
    ? tables.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : tables

if (loading) {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex items-center gap-3 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        <div className="h-8 bg-gray-200 rounded w-24"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-4 animate-pulse"></div>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
const timelineTables = filteredTables.map((table) => {
  const columns = table.columns.map((col) => {
    const colLeads = leads.filter(l => l.table_id === table.id && l.column_key === col.key)
    const isDraggedColumn = draggedColumn?.tableId === table.id && draggedColumn?.colKey === col.key
    const colIndex = table.columns.findIndex(c => c.key === col.key)
    const borderColors = ['#FF5900', '#2563EB', '#0B8043', '#7C3AED', '#DC2626']
    const borderColor = borderColors[colIndex % borderColors.length]
    return (
      <div
        key={col.key}
        className="min-w-[240px] sm:min-w-[260px] flex-1 rounded-xl p-3"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          opacity: isDraggedColumn ? 0.5 : 1,
          border: '1px solid var(--border-secondary)',
          borderTop: `3px solid ${borderColor}`,
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const columnData = e.dataTransfer.getData('application/column')
          const cardId = e.dataTransfer.getData('text/plain')
          if (columnData) {
            handleColumnDrop(e, table.id, col.key)
          } else if (cardId) {
            handleDrop(e, table.id, col.key)
          }
        }}
      >
        {/* Column Header */}
        <div
          className="group flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.setData('application/column', JSON.stringify({ tableId: table.id, colKey: col.key }))
            e.dataTransfer.effectAllowed = 'move'
            handleColumnDragStart(e, table.id, col.key)
          }}
          onDragEnd={handleColumnDragEnd}
          title="Drag to reorder column"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: borderColor }}></div>
            {editingColumnLabel?.tableId === table.id && editingColumnLabel?.colKey === col.key ? (
              <input
                type="text"
                value={editingColumnValue}
                onChange={(e) => setEditingColumnValue(e.target.value)}
                onBlur={() => saveColumnLabel(table.id, col.key)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveColumnLabel(table.id, col.key); if (e.key === 'Escape') setEditingColumnLabel(null) }}
                className="flex-1 text-xs px-1 py-0.5 border rounded outline-none"
                style={{ borderColor: 'var(--accent)', color: 'var(--text-primary)', fontWeight: 500 }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => e.stopPropagation()}
              />
            ) : (
              <h3
                className="text-xs truncate cursor-pointer hover:underline"
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingColumnLabel({ tableId: table.id, colKey: col.key })
                  setEditingColumnValue(col.label)
                }}
                onDragStart={(e) => e.stopPropagation()}
                title="Click to edit column name"
              >
                {col.label}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {colLeads.length}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); deleteColumn(table.id, col.key) }}
              className="p-1 rounded-lg transition opacity-0 group-hover:opacity-100 hover:bg-red-50"
              style={{ color: 'var(--accent)' }}
              title="Delete column"
              onDragStart={(e) => e.stopPropagation()}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <select
          value={col.emailTemplateId || ''}
          onChange={(e) => saveColumnTemplate(table.id, col.key, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
          className="w-full mb-3 px-2 py-1.5 text-xs rounded-lg border outline-none"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-secondary)', color: 'var(--text-secondary)' }}
          title="Auto email template"
        >
          <option value="">No auto email</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>{template.title}</option>
          ))}
        </select>

        {/* Cards */}
        {colLeads.length === 0 ? (
              <div className="text-center py-8 rounded-xl border" style={{ borderColor: 'var(--border-primary)' }}>
                <svg className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No leads in this column</p>
              </div>
            ) : (
              <div className="space-y-2">
                {colLeads.map((lead) => (
            <div
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className="rounded-xl p-3 border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{lead.company}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>{lead.date}</span>
                </div>
                <p className="text-xs mb-2 truncate" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{lead.contact}</p>
                {lead.checklist && lead.checklist.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: 'var(--border-secondary)' }}>
                        <div className="h-1 rounded-full transition-all" style={{ width: `${Math.round((lead.checklist.filter(c => c.done).length / lead.checklist.length) * 100)}%`, backgroundColor: '#0B8043' }} />
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{lead.checklist.filter(c => c.done).length}/{lead.checklist.length}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-1 pt-2" style={{ borderTop: '1px solid var(--border-secondary)' }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); moveToPrevColumn(lead, table) }}
                  className="p-1.5 rounded-lg transition hover:scale-110"
                  style={{ color: 'var(--accent)' }}
                  title="Move to previous column"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveToNextColumn(lead, table) }}
                  className="p-1.5 rounded-lg transition hover:scale-110"
                  style={{ color: 'var(--accent)' }}
                  title="Move to next column"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    )
  })
  return (
    <div key={table.id} className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
        <div className="p-4 sm:p-6">
        {/* Table Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {editingTableTitle === table.id ? (
              <input
                type="text"
                value={editingTableTitleValue}
                onChange={(e) => setEditingTableTitleValue(e.target.value)}
                onBlur={() => saveTableTitle(table.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTableTitle(table.id); if (e.key === 'Escape') setEditingTableTitle(null) }}
                className="text-lg sm:text-xl px-2 py-1 border rounded-lg outline-none"
                style={{ borderColor: 'var(--accent)', color: 'var(--text-primary)', fontWeight: 700 }}
                autoFocus
              />
            ) : (
              <h2
                className="text-lg sm:text-xl cursor-pointer hover:opacity-70 truncate"
                style={{ color: 'var(--text-primary)', fontWeight: 700 }}
                onClick={() => { setEditingTableTitle(table.id); setEditingTableTitleValue(table.title) }}
                title="Click to edit title"
              >
                {table.title}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setAddLeadTableId(table.id); setAddLeadColumnKey(table.columns[0]?.key || 'col-1'); setShowAddLead(true) }}
              className="px-3 py-1.5 text-xs text-white rounded-lg transition flex items-center gap-1"
              style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Lead
            </button>
            <button
              onClick={() => { setAddColumnTableId(table.id); setNewColumnName(''); setShowAddColumn(true) }}
              className="px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 500, border: '1px solid var(--border-secondary)' }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Add Column
            </button>
            <button
              onClick={() => deleteTimelineTable(table.id)}
              className="p-1.5 rounded-lg transition hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="Delete table"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Columns */}
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2">
          {columns}
</div>
        </div>
      </div>
  )
})

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
        <div className="p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Timeline</h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Drag and drop cards between columns and tables. Click a card to view details.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showSearch ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search timelines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-2 text-sm border rounded-lg outline-none"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <button
                    onClick={() => { setShowSearch(false); setSearchQuery('') }}
                    className="p-2 rounded-lg"
                    style={{ color: 'var(--accent)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-2 rounded-lg border transition"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--accent)' }}
                  title="Search timelines"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setShowAddTable(true)}
                className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Timeline Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Table Modal */}
      {showAddTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddTable(false)} />
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>New Timeline Table</h3>
            <input
              type="text"
              placeholder="Timeline name..."
              value={newTableTitle}
              onChange={(e) => setNewTableTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTimelineTable() }}
              className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddTable(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addTimelineTable} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Column Modal */}
      {showAddColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddColumn(false)} />
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Add New Column</h3>
            <input
              type="text"
              placeholder="Column name..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addColumn() }}
              className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddColumn(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addColumn} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add Column</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddLead(false)} />
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Add New Lead</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input type="text" placeholder="Company" value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Contact" value={leadForm.contact} onChange={(e) => setLeadForm({ ...leadForm, contact: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="email" placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Value" value={leadForm.value} onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Date" value={leadForm.date} onChange={(e) => setLeadForm({ ...leadForm, date: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <select value={addLeadColumnKey} onChange={(e) => setAddLeadColumnKey(e.target.value)} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }}>
                {tables.find(t => t.id === addLeadTableId)?.columns.map(col => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddLead(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addLead} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add Lead</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Popup */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedLead(null)} />
          <div className="relative rounded-2xl border max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            {/* Two-column layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left side - Main info */}
              <div className="flex-1 overflow-y-auto p-6 border-r" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedLead.company}</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{selectedLead.contact} &middot; {selectedLead.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingLead({ ...selectedLead })} className="p-2 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Edit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteLead(selectedLead.id)} className="p-2 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg transition" style={{ color: 'var(--accent)' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Value</div>
                    <div className="text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedLead.value}</div>
                  </div>
                  <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Date</div>
                    <div className="text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedLead.date}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border mb-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Contact Email</div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedLead.email}</div>
                </div>

                {/* Last Email Sent Date */}
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Last Email Sent</div>
                    <button
                      onClick={() => { setEditingLastEmail(true); setLastEmailSent(selectedLead.last_email_sent || '') }}
                      className="text-xs px-2 py-0.5 rounded transition"
                      style={{ color: 'var(--accent)', fontWeight: 500, backgroundColor: 'var(--accent-light)' }}
                    >
                      {editingLastEmail ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  {editingLastEmail ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={lastEmailSent}
                        onChange={(e) => setLastEmailSent(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveLastEmailSent(); if (e.key === 'Escape') { setEditingLastEmail(false); setLastEmailSent(selectedLead.last_email_sent || '') } }}
                        className="flex-1 px-2 py-1 text-sm border rounded outline-none"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                        placeholder="e.g., Jun 20, 2026"
                        autoFocus
                      />
                      <button onClick={saveLastEmailSent} className="px-3 py-1 text-sm text-white rounded" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
                    </div>
                  ) : (
                    <div className="text-sm mt-1" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {selectedLead.last_email_sent || 'No email sent yet'}
                    </div>
                  )}
                </div>

                {/* Send Email */}
                <button
                  onClick={() => { setShowSendEmail(true); setEmailSubject(''); setEmailBody('') }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white transition mt-3"
                  style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span className="text-xs">Compose Email to {selectedLead.contact}</span>
                </button>
              </div>

              {/* Right side panel - Tabs */}
              <div className="w-[480px] overflow-y-auto p-6">
                {(() => {
                  const tabs = [
                    { key: 'notes', label: 'Notes', count: selectedLead.notes ? selectedLead.notes.split('\n').filter(n => n.trim()).length : 0 },
                    { key: 'checklist', label: 'Checklist', count: selectedLead.checklist ? selectedLead.checklist.length : 0 },
                    { key: 'attachments', label: 'Attachments & Links', count: selectedLead.attachments.length },
                  ]
                  return (
                    <>
                      {/* Tab bar */}
                      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                        {tabs.map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => setActiveRightTab(tab.key)}
                            className="px-3 py-2 text-xs font-medium transition rounded-t-lg relative -mb-px"
                            style={{
                              color: activeRightTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                              borderBottom: activeRightTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                            }}
                          >
                            {tab.label}
                            {tab.count !== undefined && <span className="ml-1 text-[10px] opacity-60">({tab.count})</span>}
                          </button>
                        ))}
                      </div>

                      {/* Notes Tab */}
                      {activeRightTab === 'notes' && (
                        <div>
                          {selectedLead.notes && selectedLead.notes.split('\n').filter(n => n.trim()).length > 0 ? (
                            <div className="space-y-2 mb-3">
                              {selectedLead.notes.split('\n').filter(n => n.trim()).map((note, i) => (
                                <div key={i} className="group flex items-start gap-2 p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                                  {editingNoteIndex === i ? (
                                    <div className="flex-1 flex gap-2">
                                      <input type="text" value={editingNoteValue} onChange={(e) => setEditingNoteValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') updateNote(i); if (e.key === 'Escape') { setEditingNoteIndex(null); setEditingNoteValue('') } }} className="flex-1 px-2 py-1 text-sm border rounded outline-none" style={{ borderColor: 'var(--border-focus)', color: 'var(--text-primary)' }} autoFocus />
                                      <button onClick={() => updateNote(i)} className="px-2 py-1 text-xs text-white rounded" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
                                      <button onClick={() => { setEditingNoteIndex(null); setEditingNoteValue('') }} className="px-2 py-1 text-xs rounded" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="flex-1 text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{note}</p>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingNoteIndex(i); setEditingNoteValue(note) }} className="p-1 rounded" style={{ color: 'var(--accent)' }} title="Edit"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                        <button onClick={() => deleteNote(i)} className="p-1 rounded" style={{ color: 'var(--accent)' }} title="Delete"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl border mb-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                              <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No notes yet.</p>
                            </div>
                          )}
                          <button onClick={() => setShowAddPopup('note')} className="px-3 py-1.5 text-xs text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>+ Add Note</button>
                        </div>
                      )}

                      {/* Checklist Tab */}
                      {activeRightTab === 'checklist' && (
                        <div>
                          {selectedLead.checklist && selectedLead.checklist.length > 0 ? (
                            <div className="space-y-1 mb-3">
                              {selectedLead.checklist.map((item, i) => (
                                <div key={i} className="group flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                  <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(i)} className="w-4 h-4 rounded cursor-pointer flex-shrink-0" style={{ accentColor: '#FF5900' }} />
                                  {editingChecklistIdx === i ? (
                                    <div className="flex-1 flex gap-2">
                                      <input type="text" value={editingChecklistValue} onChange={(e) => setEditingChecklistValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') updateChecklistItem(i); if (e.key === 'Escape') { setEditingChecklistIdx(null); setEditingChecklistValue('') } }} className="flex-1 px-2 py-1 text-sm border rounded outline-none" style={{ borderColor: 'var(--border-focus)', color: 'var(--text-primary)' }} autoFocus />
                                      <button onClick={() => updateChecklistItem(i)} className="px-2 py-1 text-xs text-white rounded" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
                                      <button onClick={() => { setEditingChecklistIdx(null); setEditingChecklistValue('') }} className="px-2 py-1 text-xs rounded" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className={`flex-1 text-sm ${item.done ? 'line-through' : ''}`} style={{ color: item.done ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 300 }}>{item.text}</span>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingChecklistIdx(i); setEditingChecklistValue(item.text) }} className="p-1 rounded" style={{ color: 'var(--accent)' }} title="Edit"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                        <button onClick={() => deleteChecklistItem(i)} className="p-1 rounded" style={{ color: 'var(--accent)' }} title="Remove"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl border mb-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                              <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No checklist items yet.</p>
                            </div>
                          )}
                          <button onClick={() => setShowAddPopup('checklist')} className="px-3 py-1.5 text-xs text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>+ Add Item</button>
                        </div>
                      )}

                      {/* Attachments Tab */}
                      {activeRightTab === 'attachments' && (
                        <div>
                          {selectedLead.attachments.length > 0 ? (
                            <div className="space-y-1 mb-3">
                              {selectedLead.attachments.map((att, i) => (
                                <div key={i} className="group flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                  <a href={att} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm truncate hover:underline" style={{ color: 'var(--text-secondary)' }}>{att}</a>
                                  <button onClick={() => deleteAttachment(i)} className="p-1 rounded opacity-0 group-hover:opacity-100 transition" style={{ color: 'var(--accent)' }} title="Remove"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl border mb-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                              <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No attachments yet.</p>
                            </div>
                          )}
                          <button onClick={() => setShowAddPopup('attachment')} className="px-3 py-1.5 text-xs text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>+ Add Link</button>
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Add popup */}
                {showAddPopup && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={() => { setShowAddPopup(null); setAddPopupValue('') }}>
                    <div className="relative rounded-2xl border p-5 max-w-sm w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={(e) => e.stopPropagation()}>
                      <h4 className="text-sm mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                        {showAddPopup === 'note' ? 'Add Note' : showAddPopup === 'checklist' ? 'Add Checklist Item' : 'Add Link'}
                      </h4>
                      {showAddPopup === 'attachment' ? (
                        <input type="url" value={addPopupValue} onChange={(e) => setAddPopupValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAttachment() }} placeholder="Paste a link or file URL..." className="w-full px-3 py-2 text-sm border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} autoFocus />
                      ) : (
                        <input type="text" value={addPopupValue} onChange={(e) => setAddPopupValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { showAddPopup === 'note' ? addNote() : addChecklistItem() } }} placeholder={showAddPopup === 'note' ? 'Enter a note...' : 'Enter a checklist item...'} className="w-full px-3 py-2 text-sm border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} autoFocus />
                      )}
<div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowAddPopup(null); setAddPopupValue('') }} className="px-3 py-1.5 text-xs rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                        <button onClick={() => { showAddPopup === 'note' ? addNote() : showAddPopup === 'checklist' ? addChecklistItem() : addAttachment() }} className="px-3 py-1.5 text-xs text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showSendEmail && selectedLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowSendEmail(false)} />
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="text-lg mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Compose Email</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>To: {selectedLead.email}</p>
            <input
              type="text"
              placeholder="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              autoFocus
            />
            <textarea
              placeholder="Write your email..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4 resize-none"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSendEmail(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button
                onClick={sendEmail}
                disabled={!emailSubject.trim()}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingLead(null)} />
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Lead</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input type="text" placeholder="Company" value={editingLead.company} onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Contact" value={editingLead.contact} onChange={(e) => setEditingLead({ ...editingLead, contact: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="email" placeholder="Email" value={editingLead.email} onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Value" value={editingLead.value} onChange={(e) => setEditingLead({ ...editingLead, value: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Date" value={editingLead.date} onChange={(e) => setEditingLead({ ...editingLead, date: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingLead(null)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={updateLead} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

{/* Timeline Tables */}
      <div className="space-y-6">
        {timelineTables}
      </div>

      {filteredTables.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            {searchQuery ? 'No timelines match your search.' : 'No timeline tables yet. Create one to get started.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowAddTable(true)}
              className="px-5 py-2.5 text-sm text-white rounded-lg"
              style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
            >
              Create Timeline Table
            </button>
          )}
        </div>
      )}
    </div>
  )
}
