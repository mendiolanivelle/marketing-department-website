import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface TimelineColumn {
  key: string
  label: string
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
  created_at: string
  updated_at: string
}

const defaultColumns = (): TimelineColumn[] => [
  { key: 'col-1', label: 'Initial Contact' },
  { key: 'col-2', label: 'Discovery Call' },
  { key: 'col-3', label: 'Proposal Sent' },
  { key: 'col-4', label: 'Negotiation' },
  { key: 'col-5', label: 'Closed Won' },
]

const columnColors: Record<string, string> = {
  'col-1': '#4A90D9',
  'col-2': '#6366F1',
  'col-3': '#8B5CF6',
  'col-4': '#F59E0B',
  'col-5': '#FF5900',
  'col-6': '#3E4048',
  'col-7': '#10B981',
  'col-8': '#EF4444',
}

export default function Timeline() {
  const [tables, setTables] = useState<TimelineTable[]>([])
  const [leads, setLeads] = useState<TimelineLead[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedLead, setDraggedLead] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<TimelineLead | null>(null)
  const [editingTableTitle, setEditingTableTitle] = useState<string | null>(null)
  const [editingTableTitleValue, setEditingTableTitleValue] = useState('')
  const [editingColumnLabel, setEditingColumnLabel] = useState<{ tableId: string; colKey: string } | null>(null)
  const [editingColumnValue, setEditingColumnValue] = useState('')
  const [showAddTable, setShowAddTable] = useState(false)
  const [newTableTitle, setNewTableTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)
  const [addLeadTableId, setAddLeadTableId] = useState<string>('')
  const [addLeadColumnKey, setAddLeadColumnKey] = useState<string>('col-1')
  const [leadForm, setLeadForm] = useState({ company: '', contact: '', email: '', value: '', date: '' })
  const [editingLead, setEditingLead] = useState<TimelineLead | null>(null)
  const [newNote, setNewNote] = useState('')
  const [newAttachment, setNewAttachment] = useState('')
  const [newEmailSubject, setNewEmailSubject] = useState('')
  const [newEmailPreview, setNewEmailPreview] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return }
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('timeline_tables')
        .select('*')
        .order('created_at', { ascending: false })
      if (tableError) throw tableError

      const { data: leadData, error: leadError } = await supabase
        .from('timeline_leads')
        .select('*')
      if (leadError) throw leadError

      const parsedTables = (tableData || []).map((t: any) => ({
        ...t,
        columns: typeof t.columns === 'string' ? JSON.parse(t.columns) : t.columns,
      }))
      const parsedLeads = (leadData || []).map((l: any) => ({
        ...l,
        attachments: typeof l.attachments === 'string' ? JSON.parse(l.attachments) : (l.attachments || []),
        email_history: typeof l.email_history === 'string' ? JSON.parse(l.email_history) : (l.email_history || []),
      }))

      setTables(parsedTables)
      setLeads(parsedLeads)
    } catch (err) {
      console.error('Error fetching timeline data:', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    if (!isSupabaseConfigured || !supabase) return
    const channel = supabase
      .channel('timeline_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_tables' }, () => { fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_leads' }, () => { fetchData() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', leadId)
    setDraggedLead(leadId)
  }

  const handleDragEnd = () => { setDraggedLead(null) }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, tableId: string, columnKey: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    if (!leadId || !supabase) return
    try {
      const { error } = await supabase
        .from('timeline_leads')
        .update({ column_key: columnKey, table_id: tableId, updated_at: new Date().toISOString() })
        .eq('id', leadId)
      if (error) throw error
    } catch (err) { console.error('Error moving lead:', err) }
    setDraggedLead(null)
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
    } catch (err) { console.error('Error adding table:', err) }
  }

  const deleteTimelineTable = async (tableId: string) => {
    if (!confirm('Delete this timeline table and all its leads?') || !supabase) return
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

  const addLead = async () => {
    if (!leadForm.company || !leadForm.contact || !leadForm.email || !supabase) { alert('Please fill in all fields'); return }
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
      setShowAddLead(false)
      setLeadForm({ company: '', contact: '', email: '', value: '', date: '' })
    } catch (err) { console.error('Error adding lead:', err); alert('Failed to add lead') }
  }

  const updateLead = async () => {
    if (!editingLead || !supabase) return
    try {
      const { error } = await supabase
        .from('timeline_leads')
        .update({ ...editingLead, updated_at: new Date().toISOString() })
        .eq('id', editingLead.id)
      if (error) throw error
      setEditingLead(null)
    } catch (err) { console.error('Error updating lead:', err) }
  }

  const deleteLead = async (leadId: string) => {
    if (!confirm('Delete this lead?') || !supabase) return
    try {
      const { error } = await supabase.from('timeline_leads').delete().eq('id', leadId)
      if (error) throw error
      setSelectedLead(null)
    } catch (err) { console.error('Error deleting lead:', err) }
  }

  const addNote = async () => {
    if (!selectedLead || !newNote.trim() || !supabase) return
    const updatedNotes = selectedLead.notes ? `${selectedLead.notes}\n${newNote.trim()}` : newNote.trim()
    try {
      const { error } = await supabase
        .from('timeline_leads')
        .update({ notes: updatedNotes })
        .eq('id', selectedLead.id)
      if (error) throw error
      setSelectedLead({ ...selectedLead, notes: updatedNotes })
      setNewNote('')
    } catch (err) { console.error('Error adding note:', err) }
  }

  const addAttachment = async () => {
    if (!selectedLead || !newAttachment.trim() || !supabase) return
    const updatedAttachments = [...selectedLead.attachments, newAttachment.trim()]
    try {
      const { error } = await supabase
        .from('timeline_leads')
        .update({ attachments: updatedAttachments })
        .eq('id', selectedLead.id)
      if (error) throw error
      setSelectedLead({ ...selectedLead, attachments: updatedAttachments })
      setNewAttachment('')
    } catch (err) { console.error('Error adding attachment:', err) }
  }

  const addEmailHistory = async () => {
    if (!selectedLead || !newEmailSubject.trim() || !supabase) return
    const newEntry: EmailHistoryItem = {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      subject: newEmailSubject.trim(),
      preview: newEmailPreview.trim(),
    }
    const updatedHistory = [newEntry, ...selectedLead.email_history]
    try {
      const { error } = await supabase
        .from('timeline_leads')
        .update({ email_history: updatedHistory })
        .eq('id', selectedLead.id)
      if (error) throw error
      setSelectedLead({ ...selectedLead, email_history: updatedHistory })
      setNewEmailSubject('')
      setNewEmailPreview('')
    } catch (err) { console.error('Error adding email:', err) }
  }

  const filteredTables = searchQuery
    ? tables.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : tables

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B1A1C]"></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl mb-2" style={{ color: '#1B1A1C', fontWeight: 700 }}>Timeline</h1>
          <p className="text-sm sm:text-base" style={{ color: '#3E4048', fontWeight: 300 }}>Drag and drop cards between columns and tables. Click a card to view details.</p>
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
                style={{ borderColor: '#CACDD7', color: '#1B1A1C' }}
              />
              <button
                onClick={() => { setShowSearch(false); setSearchQuery('') }}
                className="p-2 rounded-lg"
                style={{ color: '#3E4048' }}
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
              style={{ borderColor: '#CACDD7', color: '#3E4048' }}
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
            style={{ backgroundColor: '#FF5900', fontWeight: 500 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Timeline Table
          </button>
        </div>
      </div>

      {/* Add Table Modal */}
      {showAddTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(27,26,28,0.2)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddTable(false)} />
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
            <h3 className="text-lg mb-4" style={{ color: '#1B1A1C', fontWeight: 700 }}>New Timeline Table</h3>
            <input
              type="text"
              placeholder="Timeline name..."
              value={newTableTitle}
              onChange={(e) => setNewTableTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTimelineTable() }}
              className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4"
              style={{ borderColor: '#CACDD7', color: '#1B1A1C' }}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddTable(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'rgba(202,205,215,0.2)', color: '#3E4048', fontWeight: 500 }}>Cancel</button>
              <button onClick={addTimelineTable} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#FF5900', fontWeight: 500 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(27,26,28,0.2)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddLead(false)} />
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
            <h3 className="text-lg mb-4" style={{ color: '#1B1A1C', fontWeight: 700 }}>Add New Lead</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input type="text" placeholder="Company" value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="text" placeholder="Contact" value={leadForm.contact} onChange={(e) => setLeadForm({ ...leadForm, contact: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="email" placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="text" placeholder="Value" value={leadForm.value} onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="text" placeholder="Date" value={leadForm.date} onChange={(e) => setLeadForm({ ...leadForm, date: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <select value={addLeadColumnKey} onChange={(e) => setAddLeadColumnKey(e.target.value)} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }}>
                {tables.find(t => t.id === addLeadTableId)?.columns.map(col => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddLead(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'rgba(202,205,215,0.2)', color: '#3E4048', fontWeight: 500 }}>Cancel</button>
              <button onClick={addLead} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#FF5900', fontWeight: 500 }}>Add Lead</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Popup */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(27,26,28,0.2)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedLead(null)} />
          <div className="relative rounded-2xl border max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
            {/* Two-column layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left side - Main info */}
              <div className="flex-1 overflow-y-auto p-6 border-r" style={{ borderColor: '#CACDD7' }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl mb-1" style={{ color: '#1B1A1C', fontWeight: 700 }}>{selectedLead.company}</h3>
                    <p className="text-sm" style={{ color: '#3E4048', fontWeight: 300 }}>{selectedLead.contact} &middot; {selectedLead.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingLead({ ...selectedLead })} className="p-2 rounded-lg transition" style={{ color: '#3E4048' }} title="Edit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteLead(selectedLead.id)} className="p-2 rounded-lg transition" style={{ color: '#3E4048' }} title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg transition" style={{ color: '#3E4048' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                    <div className="text-xs mb-1" style={{ color: '#3E4048', fontWeight: 300 }}>Value</div>
                    <div className="text-lg" style={{ color: '#1B1A1C', fontWeight: 700 }}>{selectedLead.value}</div>
                  </div>
                  <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                    <div className="text-xs mb-1" style={{ color: '#3E4048', fontWeight: 300 }}>Date</div>
                    <div className="text-lg" style={{ color: '#1B1A1C', fontWeight: 700 }}>{selectedLead.date}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border mb-4" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                  <div className="text-xs mb-1" style={{ color: '#3E4048', fontWeight: 300 }}>Contact Email</div>
                  <div className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{selectedLead.email}</div>
                </div>
              </div>

              {/* Right side panel - Notes, Attachments, Email History */}
              <div className="w-96 overflow-y-auto p-6">
                {/* Notes Section */}
                <div className="mb-6">
                  <h4 className="text-sm mb-2" style={{ color: '#1B1A1C', fontWeight: 700 }}>Notes</h4>
                  <div className="p-3 rounded-xl border mb-2 min-h-[60px]" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#3E4048', fontWeight: 300 }}>{selectedLead.notes || 'No notes yet.'}</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addNote() }}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none"
                      style={{ borderColor: '#CACDD7' }}
                    />
                    <button onClick={addNote} className="px-3 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#FF5900', fontWeight: 500 }}>Add</button>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="mb-6">
                  <h4 className="text-sm mb-2" style={{ color: '#1B1A1C', fontWeight: 700 }}>Attachments & Links</h4>
                  {selectedLead.attachments.length > 0 ? (
                    <div className="space-y-1 mb-2">
                      {selectedLead.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'rgba(202,205,215,0.15)' }}>
                          <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <a href={att} target="_blank" rel="noopener noreferrer" className="text-sm truncate hover:underline" style={{ color: '#3E4048' }}>{att}</a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm mb-2" style={{ color: '#CACDD7', fontWeight: 300 }}>No attachments yet.</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste a link or file URL..."
                      value={newAttachment}
                      onChange={(e) => setNewAttachment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addAttachment() }}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none"
                      style={{ borderColor: '#CACDD7' }}
                    />
                    <button onClick={addAttachment} className="px-3 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#FF5900', fontWeight: 500 }}>Add</button>
                  </div>
                </div>

                {/* Email History Mini-Timeline */}
                <div>
                  <h4 className="text-sm mb-3" style={{ color: '#1B1A1C', fontWeight: 700 }}>Email History</h4>
                  {selectedLead.email_history.length > 0 ? (
                    <div className="space-y-3 mb-4">
                      {selectedLead.email_history.map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#FF5900' }}></div>
                            {i < selectedLead.email_history.length - 1 && <div className="w-px flex-1 mt-1" style={{ backgroundColor: '#CACDD7' }}></div>}
                          </div>
                          <div className="pb-3">
                            <div className="text-xs mb-0.5" style={{ color: '#CACDD7', fontWeight: 300 }}>{item.date}</div>
                            <div className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{item.subject}</div>
                            <div className="text-xs" style={{ color: '#3E4048', fontWeight: 300 }}>{item.preview}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm mb-4" style={{ color: '#CACDD7', fontWeight: 300 }}>No email history yet.</p>
                  )}
                  <div className="border-t pt-3" style={{ borderColor: '#CACDD7' }}>
                    <input
                      type="text"
                      placeholder="Email subject..."
                      value={newEmailSubject}
                      onChange={(e) => setNewEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-lg outline-none mb-2"
                      style={{ borderColor: '#CACDD7' }}
                    />
                    <textarea
                      placeholder="Email preview..."
                      value={newEmailPreview}
                      onChange={(e) => setNewEmailPreview(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border rounded-lg outline-none mb-2 resize-none"
                      style={{ borderColor: '#CACDD7' }}
                    />
                    <button onClick={addEmailHistory} className="px-3 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#FF5900', fontWeight: 500 }}>Add Email Entry</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(27,26,28,0.2)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingLead(null)} />
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
            <h3 className="text-lg mb-4" style={{ color: '#1B1A1C', fontWeight: 700 }}>Edit Lead</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input type="text" placeholder="Company" value={editingLead.company} onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="text" placeholder="Contact" value={editingLead.contact} onChange={(e) => setEditingLead({ ...editingLead, contact: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="email" placeholder="Email" value={editingLead.email} onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="text" placeholder="Value" value={editingLead.value} onChange={(e) => setEditingLead({ ...editingLead, value: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
              <input type="text" placeholder="Date" value={editingLead.date} onChange={(e) => setEditingLead({ ...editingLead, date: e.target.value })} className="px-3 py-2 border rounded-lg outline-none" style={{ borderColor: '#CACDD7' }} />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingLead(null)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'rgba(202,205,215,0.2)', color: '#3E4048', fontWeight: 500 }}>Cancel</button>
              <button onClick={updateLead} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#FF5900', fontWeight: 500 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Tables */}
      <div className="space-y-8">
        {filteredTables.map((table) => (
          <div key={table.id} className="rounded-2xl border p-4 sm:p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
            {/* Table Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {editingTableTitle === table.id ? (
                  <input
                    type="text"
                    value={editingTableTitleValue}
                    onChange={(e) => setEditingTableTitleValue(e.target.value)}
                    onBlur={() => saveTableTitle(table.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTableTitle(table.id); if (e.key === 'Escape') setEditingTableTitle(null) }}
                    className="text-lg sm:text-xl px-2 py-1 border rounded-lg outline-none"
                    style={{ borderColor: '#FF5900', color: '#1B1A1C', fontWeight: 700 }}
                    autoFocus
                  />
                ) : (
                  <h2
                    className="text-lg sm:text-xl cursor-pointer hover:underline truncate"
                    style={{ color: '#1B1A1C', fontWeight: 700 }}
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
                  style={{ backgroundColor: '#FF5900', fontWeight: 500 }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Lead
                </button>
                <button
                  onClick={() => deleteTimelineTable(table.id)}
                  className="p-1.5 rounded-lg transition"
                  style={{ color: '#CACDD7' }}
                  title="Delete table"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Columns */}
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4">
              {table.columns.map((col) => {
                const colLeads = leads.filter(l => l.table_id === table.id && l.column_key === col.key)
                const colColor = columnColors[col.key] || '#3E4048'
                return (
                  <div
                    key={col.key}
                    className="min-w-[240px] sm:min-w-[260px] flex-1 rounded-xl p-3"
                    style={{ backgroundColor: 'rgba(202,205,215,0.15)' }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, table.id, col.key)}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colColor }}></div>
                        {editingColumnLabel?.tableId === table.id && editingColumnLabel?.colKey === col.key ? (
                          <input
                            type="text"
                            value={editingColumnValue}
                            onChange={(e) => setEditingColumnValue(e.target.value)}
                            onBlur={() => saveColumnLabel(table.id, col.key)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveColumnLabel(table.id, col.key); if (e.key === 'Escape') setEditingColumnLabel(null) }}
                            className="flex-1 text-xs px-1 py-0.5 border rounded outline-none"
                            style={{ borderColor: '#FF5900', color: '#1B1A1C', fontWeight: 500 }}
                            autoFocus
                          />
                        ) : (
                          <h3
                            className="text-xs truncate cursor-pointer hover:underline"
                            style={{ color: '#1B1A1C', fontWeight: 500 }}
                            onClick={() => { setEditingColumnLabel({ tableId: table.id, colKey: col.key }); setEditingColumnValue(col.label) }}
                            title="Click to edit column name"
                          >
                            {col.label}
                          </h3>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0" style={{ backgroundColor: '#FFFFFF', color: '#3E4048', fontWeight: 500 }}>
                        {colLeads.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {colLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedLead(lead)}
                          className={`bg-white rounded-xl p-3 border cursor-pointer transition-all group ${
                            draggedLead === lead.id ? 'opacity-50' : 'hover:shadow-md'
                          }`}
                          style={{ borderColor: '#CACDD7' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm mb-0.5 truncate" style={{ color: '#1B1A1C', fontWeight: 700 }}>{lead.company}</h4>
                              <p className="text-xs mb-2 truncate" style={{ color: '#3E4048', fontWeight: 300 }}>{lead.contact}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs" style={{ color: '#1B1A1C', fontWeight: 500 }}>{lead.value}</span>
                                <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>{lead.date}</span>
                              </div>
                            </div>
                            {/* Action icons - only visible on hover */}
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingLead({ ...lead }) }}
                                className="p-1 rounded-lg transition"
                                style={{ color: '#CACDD7' }}
                                title="Edit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteLead(lead.id) }}
                                className="p-1 rounded-lg transition"
                                style={{ color: '#CACDD7' }}
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredTables.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm mb-4" style={{ color: '#3E4048', fontWeight: 300 }}>
            {searchQuery ? 'No timelines match your search.' : 'No timeline tables yet. Create one to get started.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowAddTable(true)}
              className="px-5 py-2.5 text-sm text-white rounded-lg"
              style={{ backgroundColor: '#FF5900', fontWeight: 500 }}
            >
              Create Timeline Table
            </button>
          )}
        </div>
      )}
    </div>
  )
}
