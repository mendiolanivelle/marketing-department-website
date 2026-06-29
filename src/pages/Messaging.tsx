import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'

interface OutreachLead {
  id: number
  name: string
  email: string
  company: string
  role: string
  status: 'pending' | 'sent' | 'replied' | 'follow-up'
  lastContacted: string
  notes: string
  photoUrl?: string
}

const defaultLeads: OutreachLead[] = [
  { id: 1, name: 'John Smith', email: 'john@acme.com', company: 'Acme Corp', role: 'CEO', status: 'pending', lastContacted: '', notes: '' },
  { id: 2, name: 'Sarah Lee', email: 'sarah@techstart.io', company: 'TechStart Inc', role: 'CTO', status: 'sent', lastContacted: 'Jun 22', notes: 'Awaiting response on proposal' },
  { id: 3, name: 'Mike Chen', email: 'mike@globalmedia.com', company: 'Global Media', role: 'Marketing Director', status: 'replied', lastContacted: 'Jun 20', notes: 'Interested, scheduling call' },
  { id: 4, name: 'Emma Davis', email: 'emma@brandify.co', company: 'Brandify', role: 'VP of Sales', status: 'follow-up', lastContacted: 'Jun 15', notes: 'Need to follow up by end of week' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  'pending': { label: 'Pending', color: '#3E4048' },
  'sent': { label: 'Sent', color: '#0B8043' },
  'follow-up': { label: 'Follow Up', color: '#4A90D9' },
  'replied': { label: 'Replied', color: '#FF5900' },
}

const sortLeads = (leads: OutreachLead[]) => [...leads]

const templateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
})

type TemplateFormData = z.infer<typeof templateSchema>

interface MessageTemplate {
  id: string
  title: string
  category: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

const defaultCategories = [
  '1st Meeting - Accept',
  '1st Meeting - Decline',
  '2nd Meeting - Handoff to Sales',
  '2nd Meeting - Handoff to Operations',
  '3rd Meeting - Follow Up',
  'Quotation - Sent',
  'Quotation - Follow Up',
  'Project Start - Welcome',
  'General Follow Up',
]

const fallbackTemplates: MessageTemplate[] = [
  {
    id: '1',
    title: 'Accept Client - 1st Meeting',
    category: '1st Meeting - Accept',
    subject: 'Re: Meeting Request - {{company_name}}',
    body: `Hi {{contact_name}},\n\nThank you for reaching out to Exodia. We'd love to schedule an initial meeting to discuss your project requirements and how our team can help.\n\nAre you available for a call on {{proposed_date}}? Let us know what time works best for you.\n\nLooking forward to connecting.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '2',
    title: 'Decline Client - 1st Meeting',
    category: '1st Meeting - Decline',
    subject: 'Re: Meeting Request - {{company_name}}',
    body: `Hi {{contact_name}},\n\nThank you for your interest in Exodia Game Development. After reviewing your requirements, we regret to inform you that this project doesn't align with our current capacity and expertise.\n\nWe appreciate you considering us and wish you the best with your project.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '3',
    title: 'Handoff to Sales - 2nd Meeting',
    category: '2nd Meeting - Handoff to Sales',
    subject: 'Next Steps - {{company_name}} Project Discussion',
    body: `Hi {{contact_name}},\n\nGreat speaking with you about your project. Based on our discussion, I'd like to introduce you to {{sales_rep_name}} from our Sales team who will help take things forward.\n\nThey'll reach out shortly to discuss pricing, timelines, and next steps. Feel free to reply to this email if you have any immediate questions.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '4',
    title: 'Handoff to Operations - 2nd Meeting',
    category: '2nd Meeting - Handoff to Operations',
    subject: 'Project Onboarding - {{company_name}}',
    body: `Hi {{contact_name}},\n\nFollowing our second meeting, I'm handing you over to our Operations team to begin the onboarding process.\n\n{{ops_rep_name}} will be your main point of contact going forward. They'll set up the project workspace, share the development timeline, and schedule the kickoff meeting.\n\nLooking forward to working together.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '5',
    title: 'Quotation Sent',
    category: 'Quotation - Sent',
    subject: 'Project Quotation - {{company_name}}',
    body: `Hi {{contact_name}},\n\nPlease find attached our quotation for the {{project_name}} project.\n\nThe proposal includes:\n- Scope of work\n- Timeline and milestones\n- Pricing breakdown\n\nPlease review and let us know if you have any questions. We're happy to hop on a call to walk through the details.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
]

export default function Messaging() {
  // === Reach Out State ===
  const [leads, setLeads] = useState<OutreachLead[]>(() => {
    const saved = localStorage.getItem('exodia-outreach-leads')
    return saved ? JSON.parse(saved) : defaultLeads
  })

  useEffect(() => {
    localStorage.setItem('exodia-outreach-leads', JSON.stringify(leads))
  }, [leads])

  const [showAdd, setShowAdd] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null)
  const [selectedDetailLead, setSelectedDetailLead] = useState<OutreachLead | null>(null)
  const [detailNotes, setDetailNotes] = useState('')
  const [newLead, setNewLead] = useState({ name: '', email: '', company: '', role: '' })
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [editingLead, setEditingLead] = useState<OutreachLead | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const memberFileRef = useRef<HTMLInputElement>(null)
  const [photoTarget, setPhotoTarget] = useState<number | 'edit' | null>(null)

  // === Reach Out Functions ===
  const addLead = () => {
    if (!newLead.name.trim() || !newLead.email.trim()) return
    const id = leads.length > 0 ? Math.max(...leads.map(l => l.id)) + 1 : 1
    setLeads(sortLeads([...leads, { ...newLead, id, status: 'pending' as const, lastContacted: '', notes: '' }]))
    setNewLead({ name: '', email: '', company: '', role: '' })
    setShowAdd(false)
    logActivity('Lead', `Added "${newLead.name.trim()}" (${newLead.email.trim()})`)
  }

  const deleteLead = (id: number) => {
    const lead = leads.find(l => l.id === id)
    setLeads(leads.filter(l => l.id !== id))
    if (lead) logActivity('Lead', `Deleted "${lead.name}"`)
  }

  const updateStatus = (id: number, status: OutreachLead['status']) => {
    const lead = leads.find(l => l.id === id)
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    setLeads(sortLeads(leads.map(l => l.id === id ? { ...l, status, lastContacted: today } : l)))
    if (lead) logActivity('Lead', `Updated "${lead.name}" status to ${status}`)
  }

  const saveLeadEdit = () => {
    if (!editingLead) return
    setLeads(sortLeads(leads.map(l => l.id === editingLead.id ? editingLead : l)))
    setEditingLead(null)
    logActivity('Lead', `Edited "${editingLead.name}"`)
  }

  const sendEmail = () => {
    if (!selectedLead || !emailSubject.trim()) return
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(selectedLead.email)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    window.open(gmailUrl, '_blank')
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    setLeads(sortLeads(leads.map(l => l.id === selectedLead.id ? { ...l, status: 'sent', lastContacted: today } : l)))
    setShowEmail(false)
    setEmailSubject('')
    setEmailBody('')
    setSelectedLead(null)
    logActivity('Email', `Sent to "${selectedLead.name}" (${selectedLead.email})`)
  }

  const addNote = (id: number, note: string) => {
    if (!note.trim()) return
    setLeads(leads.map(l => l.id === id ? { ...l, notes: l.notes ? `${l.notes}\n${note.trim()}` : note.trim() } : l))
  }

  const statusCycle: OutreachLead['status'][] = ['pending', 'sent', 'follow-up', 'replied']

  const moveToNextStatus = (lead: OutreachLead) => {
    const idx = statusCycle.indexOf(lead.status)
    if (idx < statusCycle.length - 1) updateStatus(lead.id, statusCycle[idx + 1])
  }

  const moveToPrevStatus = (lead: OutreachLead) => {
    const idx = statusCycle.indexOf(lead.status)
    if (idx > 0) updateStatus(lead.id, statusCycle[idx - 1])
  }

  const filtered = (filterStatus === 'all' ? leads : leads.filter(l => l.status === filterStatus)).filter(l =>
    !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.company.toLowerCase().includes(searchQuery.toLowerCase()) || l.email.toLowerCase().includes(searchQuery.toLowerCase()) || l.notes.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // === Message Templates State ===
  const [templates, setTemplates] = useState<MessageTemplate[]>(fallbackTemplates)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // === Message Templates Hook ===
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  })

  // === Message Templates Functions ===
  const fetchTemplates = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) setTemplates(data)
    } catch (err) {
      console.error('Error fetching templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()

    if (!isSupabaseConfigured || !supabase) return

    const channel = supabase
      .channel('message_templates_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_templates' }, () => {
        fetchTemplates()
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [fetchTemplates])

  const onSubmit = async (data: TemplateFormData) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Please check your environment variables.')
      return
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('message_templates')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
        setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, ...data, updated_at: new Date().toISOString() } : t))
        setSuccessMessage('Template updated successfully!')
        logActivity('Template', `Updated "${data.title}"`)
      } else {
        const { data: newData, error } = await supabase
          .from('message_templates')
          .insert([{ ...data }])
          .select()
        if (error) throw error
        if (newData) setTemplates(prev => [newData[0], ...prev])
        setSuccessMessage('Template created successfully!')
        logActivity('Template', `Created "${data.title}"`)
      }
      reset()
      setShowForm(false)
      setEditingId(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error saving template:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save template. Please try again.')
    }
  }

  const handleEdit = (template: MessageTemplate) => {
    reset({
      title: template.title,
      category: template.category,
      subject: template.subject,
      body: template.body,
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    setErrorMessage(null)
    const template = templates.find(t => t.id === id)

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Please check your environment variables.')
      return
    }

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccessMessage('Template deleted successfully!')
      await fetchTemplates()
      if (template) logActivity('Template', `Deleted "${template.title}"`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error deleting template:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete template. Please try again.')
    }
    setDeleteConfirmId(null)
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const filteredTemplates = selectedCategory === 'All'
    ? templates
    : templates.filter(t => t.category === selectedCategory)

  const categories = ['All', ...defaultCategories]

  return (
    <div>
      {/* ======== REACH OUT SECTION ======== */}
      <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Reach Out</h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Email outreach and follow-up management</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Lead
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search leads by name, company, email, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border rounded-xl text-sm outline-none transition"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pending', count: leads.filter(l => l.status === 'pending').length, color: '#3E4048' },
            { label: 'Sent', count: leads.filter(l => l.status === 'sent').length, color: '#0B8043' },
            { label: 'Follow Up', count: leads.filter(l => l.status === 'follow-up').length, color: '#4A90D9' },
            { label: 'Replied', count: leads.filter(l => l.status === 'replied').length, color: '#FF5900' },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-xl border-2 exodia-card text-center theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="text-2xl sm:text-3xl mb-1" style={{ color: stat.color || 'var(--text-primary)', fontWeight: 700 }}>{stat.count}</div>
              <div className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'pending', 'sent', 'follow-up', 'replied'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm capitalize transition"
              style={{
                backgroundColor: filterStatus === s ? 'var(--accent)' : 'var(--bg-card)',
                color: filterStatus === s ? '#FFFFFF' : 'var(--text-secondary)',
                borderColor: 'var(--border-primary)',
                fontWeight: 500,
              }}
            >
              {s === 'all' ? 'All' : statusConfig[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Lead List */}
        <input type="file" accept="image/*" ref={memberFileRef} className="hidden" onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            if (photoTarget === 'edit') {
              if (editingLead) setEditingLead({ ...editingLead, photoUrl: dataUrl })
            } else if (typeof photoTarget === 'number') {
              setLeads(leads.map(l => l.id === photoTarget ? { ...l, photoUrl: dataUrl } : l))
            }
            setPhotoTarget(null)
          }
          reader.readAsDataURL(file)
          e.target.value = ''
        }} />
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {filtered.map((lead) => {
            const status = statusConfig[lead.status]
            return (
              <div
                key={lead.id}
                className="group rounded-xl border-2 exodia-card p-4 sm:p-5 transition-all hover:shadow-md cursor-pointer"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', borderLeft: `4px solid ${status.color}` }}
                onClick={() => { setSelectedDetailLead(lead); setDetailNotes(lead.notes) }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer group/avatar" style={{ backgroundColor: 'var(--btn-primary-bg)' }} onClick={(e) => { e.stopPropagation(); setPhotoTarget(lead.id); memberFileRef.current?.click() }}>
                        {lead.photoUrl ? (
                          <img src={lead.photoUrl} alt={lead.name} className="w-full h-full object-cover" />
                        ) : (
                          <span style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>{lead.name.charAt(0)}{lead.company.charAt(0)}</span>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{lead.name}</h3>
                        <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{lead.company}{lead.role ? ` · ${lead.role}` : ''} · {lead.email}</p>
                      </div>
                    </div>
                    {lead.notes && (
                      <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{lead.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${status.color}20`, color: status.color, fontWeight: 500 }}>
                      {status.label}
                    </span>
                    {lead.lastContacted && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{lead.lastContacted}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: 'var(--border-primary)' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); setShowEmail(true); setEmailSubject(''); setEmailBody('') }}
                    className="px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1"
                    style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF', fontWeight: 500 }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Email
                  </button>
                  <div className="w-px h-5" style={{ backgroundColor: 'var(--border-secondary)' }} />
                  <select
                    value={lead.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStatus(lead.id, e.target.value as OutreachLead['status'])}
                    className="px-2 py-1.5 text-xs rounded-lg border outline-none cursor-pointer"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                  >
                    <option value="pending">{statusConfig.pending.label}</option>
                    <option value="sent">{statusConfig.sent.label}</option>
                    <option value="replied">{statusConfig.replied.label}</option>
                    <option value="follow-up">{statusConfig['follow-up'].label}</option>
                  </select>
                  <button onClick={(e) => { e.stopPropagation(); setEditingLead(lead) }} className="p-1.5 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Edit">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteLead(lead.id) }} className="p-1.5 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No leads found. Add one to get started.</p>
            </div>
          )}
        </div>

        {/* Add Lead Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAdd(false)}>
            <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Add Lead</h3>
              <input type="text" placeholder="Full Name" value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
              <input type="email" placeholder="Email" value={newLead.email} onChange={e => setNewLead({ ...newLead, email: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Company" value={newLead.company} onChange={e => setNewLead({ ...newLead, company: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Role / Position" value={newLead.role} onChange={e => setNewLead({ ...newLead, role: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4" style={{ borderColor: 'var(--border-primary)' }} />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                <button onClick={addLead} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Lead Modal */}
        {editingLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingLead(null)}>
            <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Lead</h3>
              <div className="flex justify-center mb-4">
                <div className="relative w-20 h-20 rounded-full flex items-center justify-center overflow-hidden cursor-pointer group/avatar" style={{ backgroundColor: 'var(--btn-primary-bg)' }} onClick={() => { setPhotoTarget('edit'); memberFileRef.current?.click() }}>
                  {editingLead.photoUrl ? (
                    <img src={editingLead.photoUrl} alt={editingLead.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>{editingLead.name.charAt(0)}{editingLead.company.charAt(0)}</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                </div>
              </div>
              <input type="text" placeholder="Full Name" value={editingLead.name} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
              <input type="email" placeholder="Email" value={editingLead.email} onChange={e => setEditingLead({ ...editingLead, email: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Company" value={editingLead.company} onChange={e => setEditingLead({ ...editingLead, company: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Role / Position" value={editingLead.role} onChange={e => setEditingLead({ ...editingLead, role: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
              <div className="mb-4">
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Notes</label>
                <textarea placeholder="Add notes..." value={editingLead.notes} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} rows={3} className="w-full px-3 py-2.5 border rounded-lg outline-none resize-none" style={{ borderColor: 'var(--border-primary)' }} />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setEditingLead(null)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                <button onClick={saveLeadEdit} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Compose Email Modal */}
        {showEmail && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowEmail(false)}>
            <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Compose Email</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>To: {selectedLead.email} ({selectedLead.name}, {selectedLead.company})</p>
              <input type="text" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
              <textarea placeholder="Write your email..." value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4 resize-none" style={{ borderColor: 'var(--border-primary)' }} />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowEmail(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                <button onClick={sendEmail} disabled={!emailSubject.trim()} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Send Email</button>
              </div>
            </div>
          </div>
        )}

        {/* Lead Detail Popup */}
        {selectedDetailLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => { setSelectedDetailLead(null); setDetailNotes('') }}>
            <div className="relative rounded-2xl border w-full max-w-2xl max-h-[90vh] overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
                <h3 className="text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lead Details</h3>
                <button onClick={() => { setSelectedDetailLead(null); setDetailNotes('') }} className="p-1 rounded-lg transition" style={{ color: 'var(--accent)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex flex-col sm:flex-row h-full max-h-[calc(90vh-60px)] overflow-y-auto">
                {/* Left: Lead Info */}
                <div className="sm:w-1/2 p-6 border-r" style={{ borderColor: 'var(--border-secondary)' }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
                      {selectedDetailLead.photoUrl ? (
                        <img src={selectedDetailLead.photoUrl} alt={selectedDetailLead.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl text-white" style={{ fontWeight: 700 }}>{selectedDetailLead.name.charAt(0)}{selectedDetailLead.company.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-base" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedDetailLead.name}</h4>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{selectedDetailLead.role}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Company</label>
                      <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{selectedDetailLead.company}</p>
                    </div>
                    <div>
                      <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Email</label>
                      <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{selectedDetailLead.email}</p>
                    </div>
                    <div>
                      <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Role / Position</label>
                      <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{selectedDetailLead.role || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Status</label>
                      <span className="inline-block text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: `${statusConfig[selectedDetailLead.status].color}20`, color: statusConfig[selectedDetailLead.status].color, fontWeight: 500 }}>
                        {statusConfig[selectedDetailLead.status].label}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Last Contacted</label>
                      <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{selectedDetailLead.lastContacted || 'Not yet contacted'}</p>
                    </div>
                    <div>
                      <button
                        onClick={() => { const s = selectedDetailLead; setSelectedDetailLead(null); setDetailNotes(''); setSelectedLead(s); setShowEmail(true); setEmailSubject(''); setEmailBody('') }}
                        className="w-full px-3 py-2 text-xs text-white rounded-lg transition"
                        style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
                      >
                        Send Email
                      </button>
                    </div>
                  </div>
                </div>
                {/* Right: Editable Notes */}
                <div className="sm:w-1/2 p-6 flex flex-col">
                  <label className="text-sm mb-3" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Notes</label>
                  <textarea
                    value={detailNotes}
                    onChange={(e) => {
                      setDetailNotes(e.target.value)
                      setLeads(prev => prev.map(l => l.id === selectedDetailLead.id ? { ...l, notes: e.target.value } : l))
                    }}
                    placeholder="Write notes about this lead..."
                    rows={12}
                    className="w-full flex-1 px-4 py-3 border rounded-xl outline-none resize-none text-sm leading-relaxed"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
                  />
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Changes are saved automatically.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="px-4 sm:px-6 lg:px-8">
        <hr style={{ borderColor: 'var(--border-primary)' }} />
      </div>

      {/* ======== MESSAGE TEMPLATES SECTION ======== */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Message Templates</h2>
            <p className="text-sm text-[var(--text-secondary)]">Search and use email templates</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); reset() }}
            className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Template
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search templates by name, category, or subject..."
            value={selectedCategory === 'All' ? '' : selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value || 'All')}
            className="w-full pl-12 pr-4 py-3.5 border rounded-xl text-sm outline-none transition"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-medium">Supabase not configured</p>
            <p className="text-xs text-amber-600 mt-1">Templates are using local fallback data.</p>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowForm(false); setEditingId(null); reset() }}>
            <div className="relative rounded-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between rounded-t-2xl" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editingId ? 'Edit Template' : 'New Template'}</h2>
                <button onClick={() => { setShowForm(false); setEditingId(null); reset() }} className="p-1 rounded-full transition" style={{ color: 'var(--accent)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {errorMessage && <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-800 text-sm">{errorMessage}</p></div>}
              {successMessage && <div className="mx-6 mt-4 p-4 border rounded-lg" style={{ backgroundColor: 'var(--accent-light)', borderColor: 'var(--accent)' }}><p className="text-sm" style={{ color: 'var(--accent)' }}>{successMessage}</p></div>}
              <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Title</label>
                    <input {...register('title')} className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="e.g. Accept Client - 1st Meeting" />
                    {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
                    <select {...register('category')} className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      <option value="">Select category</option>
                      {defaultCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                    </select>
                    {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject Line</label>
                  <input {...register('subject')} className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="e.g. Re: Meeting Request - {{company_name}}" />
                  {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject.message}</p>}
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Use {'{{variable_name}}'} for dynamic placeholders</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email Body</label>
                  <textarea {...register('body')} rows={8} className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none resize-vertical font-mono" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="Write your email template here..." />
                  {errors.body && <p className="mt-1 text-xs text-red-600">{errors.body.message}</p>}
                </div>
                <div className="sticky bottom-0 border-t -mx-6 px-6 py-4 flex justify-end gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); reset() }} className="px-5 py-2.5 rounded-lg transition text-sm" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 text-white rounded-lg transition text-sm disabled:opacity-50" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>{isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--text-primary)' }}></div></div>
        ) : (
          <>
            {(() => {
              const query = selectedCategory === 'All' ? '' : selectedCategory.toLowerCase()
              const results = query
                ? templates.filter(t =>
                    t.title.toLowerCase().includes(query) ||
                    t.category.toLowerCase().includes(query) ||
                    t.subject.toLowerCase().includes(query)
                  )
                : templates
              if (results.length === 0) {
                return (
                  <div className="text-center py-16 rounded-2xl border-2 exodia-card" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{query ? 'No templates match your search' : 'No templates yet'}</p>
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {results.map((template) => (
                    <div key={template.id} className="rounded-2xl border-2 exodia-card p-4 sm:p-6 transition-all hover:shadow-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs mb-2" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 500 }}>{template.category}</span>
                          <h3 className="text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{template.title}</h3>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleCopy(`Subject: ${template.subject}\n\n${template.body}`, template.id)} className="p-2 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Copy">
                            {copiedId === template.id
                              ? <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                          </button>
                          <button onClick={() => handleEdit(template)} className="p-2 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {deleteConfirmId === template.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(template.id)} className="p-2 rounded-lg bg-red-50 transition" title="Confirm"><svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                              <button onClick={() => setDeleteConfirmId(null)} className="p-2 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Cancel"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(template.id)} className="p-2 rounded-lg hover:bg-red-50 transition" style={{ color: 'var(--accent)' }} title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          )}
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Subject</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Body</p>
                        <p className="text-sm whitespace-pre-wrap line-clamp-4 font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{template.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}