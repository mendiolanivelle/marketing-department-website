import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'

interface EmailHistoryItem {
  id: string
  subject: string
  body: string
  sentAt: string
  direction: 'sent' | 'received'
}

interface OutreachLead {
  id: number
  name: string
  email: string
  company: string
  role: string
  status: 'pending' | 'sent' | 'replied' | 'follow-up' | 'no-reply' | 'meeting-booked'
  lastContacted: string
  notes: string
  photoUrl?: string
  rawData?: Record<string, string>
  sourceFileId?: string
  emailHistory: EmailHistoryItem[]
}

const statusConfig: Record<string, { label: string; color: string }> = {
  'pending': { label: 'Pending', color: '#3E4048' },
  'sent': { label: 'Sent', color: '#0B8043' },
  'follow-up': { label: 'Follow Up', color: '#4A90D9' },
  'replied': { label: 'Replied', color: '#FF5900' },
  'no-reply': { label: 'No Reply', color: '#DC2626' },
  'meeting-booked': { label: 'Meeting Booked', color: '#2563EB' },
}

const sortLeads = (leads: OutreachLead[]) => [...leads]

const templateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  subject: z.string().min(1, 'Subject is required'),
  emailMessage: z.string().optional(),
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

const defaultEmailMessage = `We would love to connect with {{company_name}} about your project goals.

Tell us what you want to highlight here.`

const emailHtmlStarter = `<div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#1B1A1C;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eceef2;">
      <div style="background:#FF5900;padding:28px 32px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.2;">Exodia Game Development</h1>
        <p style="margin:8px 0 0;color:#ffe7da;font-size:14px;">Marketing Department</p>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi {{contact_name}},</p>
        <!-- EMAIL_MESSAGE_START -->
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">We would love to connect with {{company_name}} about your project goals.</p>
        <div style="background:#FFF7ED;border:1px solid #fed7aa;border-radius:14px;padding:18px;margin:22px 0;">
          <p style="margin:0;color:#9a3412;font-size:14px;line-height:1.6;">Tell us what you want to highlight here.</p>
        </div>
        <!-- EMAIL_MESSAGE_END -->
        <a href="https://calendar.app.google/rV8V8QwCYUr4XrP98" style="display:inline-block;background:#FF5900;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 22px;font-weight:700;font-size:14px;">Book a Call</a>
        <p style="margin:28px 0 0;font-size:15px;line-height:1.7;">Best regards,<br>{{sender_name}}</p>
      </div>
    </div>
  </div>
</div>`

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const messageToHtml = (message: string) =>
  message
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('\n        ')

const applyEmailMessage = (html: string, message: string) => {
  const messageHtml = messageToHtml(message)
  const source = html || emailHtmlStarter
  if (!source.includes('<!-- EMAIL_MESSAGE_START -->')) return emailHtmlStarter.replace(/<!-- EMAIL_MESSAGE_START -->[\s\S]*<!-- EMAIL_MESSAGE_END -->/, `<!-- EMAIL_MESSAGE_START -->\n        ${messageHtml}\n        <!-- EMAIL_MESSAGE_END -->`)
  return source.replace(/<!-- EMAIL_MESSAGE_START -->[\s\S]*<!-- EMAIL_MESSAGE_END -->/, `<!-- EMAIL_MESSAGE_START -->\n        ${messageHtml}\n        <!-- EMAIL_MESSAGE_END -->`)
}

const extractEmailMessage = (html: string) => {
  const match = html.match(/<!-- EMAIL_MESSAGE_START -->([\s\S]*?)<!-- EMAIL_MESSAGE_END -->/)
  const source = match ? match[1] : html
  return source.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const renderEmailPreview = (body = '') => {
  const content = body.trim()
  if (!content) {
    return '<!doctype html><html><body style="margin:0;background:#f4f4f5;"></body></html>'
  }
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(content)
  const html = looksLikeHtml
    ? content
    : `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1B1A1C;white-space:pre-wrap;padding:24px;">${escapeHtml(content)}</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f4f5;">${html}</body></html>`
}

export default function Messaging() {
  // === Reach Out State ===
  const [leads, setLeads] = useState<OutreachLead[]>(() => {
    if (isSupabaseConfigured) return []
    const saved = localStorage.getItem('exodia-outreach-leads')
    if (!saved) return []
    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed)
        ? parsed.map((lead: OutreachLead) => ({ ...lead, emailHistory: lead.emailHistory || [] }))
        : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (isSupabaseConfigured) return
    localStorage.setItem('exodia-outreach-leads', JSON.stringify(leads))
  }, [leads])

// Sync leads from Lead Generation files
  const reSyncAll = useRef(false)

  useEffect(() => {
    if (isSupabaseConfigured) return
    const syncLeadFiles = async () => {
      const savedFiles = localStorage.getItem('exodia-lead-files')
      let leadFiles: any[] = []
      if (savedFiles) {
        try {
          const parsed = JSON.parse(savedFiles)
          if (Array.isArray(parsed)) leadFiles = parsed
        } catch {}
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('lead_files')
          .select('id, name, columns')
        if (error) {
          console.error('Failed to load canonical lead files for messaging sync:', error)
        } else if (data) {
          const canonicalIds = new Set(data.map(file => file.id))
          leadFiles = [...data, ...leadFiles.filter(file => !canonicalIds.has(file.id))]
        }
      }
      if (leadFiles.length === 0) return

      const currentLeadsRaw = localStorage.getItem('exodia-outreach-leads')
      let currentLeads: OutreachLead[] = currentLeadsRaw ? JSON.parse(currentLeadsRaw) : []

      let syncedFileIds: string[] = []
      try {
        const saved = localStorage.getItem('exodia-synced-lead-files')
        if (saved && !reSyncAll.current) syncedFileIds.push(...JSON.parse(saved))
      } catch {}
      reSyncAll.current = false

      // Build set of currently existing file IDs
      const existingFileIds = new Set(leadFiles.map((f: any) => f.id))

      // Remove leads that came from a file that no longer exists
      const deletedFileIds = isSupabaseConfigured && supabase
        ? []
        : syncedFileIds.filter(id => !existingFileIds.has(id))
      if (deletedFileIds.length > 0) {
        currentLeads = currentLeads.filter(l => !deletedFileIds.includes(l.sourceFileId || ''))
        // Remove deleted file IDs from synced tracker
        syncedFileIds = syncedFileIds.filter(id => existingFileIds.has(id))
      }

      const newLeads: OutreachLead[] = []
      let updatedCount = 0
      const newlySynced: string[] = []
      let maxId = currentLeads.length > 0 ? Math.max(...currentLeads.map(l => l.id)) : 0

      const fetchRows = async (fileId: string) => {
          const local = localStorage.getItem(`exodia-lead-rows-${fileId}`)
          if (local) return JSON.parse(local)
          if (isSupabaseConfigured && supabase) {
            const { data, error } = await supabase.from('lead_rows').select('*').eq('file_id', fileId)
            if (error) {
              console.error(`Failed to load canonical lead rows for messaging sync (${fileId}):`, error)
              return null
            }
            if (data && data.length > 0) return data
          }
          return null
        }

        for (const file of leadFiles) {
          const cols = (file.columns as string[]) || []
          const nonCompanyCols = cols.filter(c => !/company|organization|studio|client/i.test(c))
          const nameCol = cols.find(c => /name|contact person|full name/i.test(c)) || ''
          const emailCol = nonCompanyCols.find(c => /email|e-mail|mail/i.test(c)) || ''
          const companyCol = cols.find(c => /company|organization|studio|client/i.test(c)) || ''
          const roleCol = cols.find(c => /role|position|title|designation/i.test(c)) || ''

          const rows = await fetchRows(file.id)
          if (!rows) continue

        for (const row of rows) {
          const data = row.data as Record<string, string> || {}
          const rowEmail = emailCol ? (data[emailCol] || '').trim().toLowerCase() : ''
          const rowName = nameCol ? (data[nameCol] || '').trim() : ''
          const rowCompany = companyCol ? (data[companyCol] || '').trim() : ''
          const rowRole = roleCol ? (data[roleCol] || '').trim() : ''
          if (!rowName && !rowEmail) continue

          // If this file was already synced, update matching leads instead of creating new
          const existingIdx = syncedFileIds.includes(file.id)
            ? currentLeads.findIndex(l => l.email.toLowerCase() === rowEmail && rowEmail)
            : -1

          if (existingIdx >= 0) {
            const existing = currentLeads[existingIdx]
            currentLeads[existingIdx] = {
              ...existing,
              name: rowName || existing.name,
              company: rowCompany || existing.company,
              role: rowRole || existing.role,
              rawData: data,
            }
            updatedCount++
          } else if (!syncedFileIds.includes(file.id)) {
            maxId++
            newLeads.push({
              id: maxId,
              name: rowName || rowEmail.split('@')[0] || 'Unknown',
              email: rowEmail || '',
              company: rowCompany || file.name,
              role: rowRole || '',
              status: 'pending',
              lastContacted: '',
              notes: '',
              rawData: data,
              sourceFileId: file.id,
              emailHistory: [],
            })
          }
        }

        newlySynced.push(file.id)
      }

      if (updatedCount > 0 || deletedFileIds.length > 0) {
        setLeads([...currentLeads])
      }
      if (newLeads.length > 0) {
        setLeads(prev => [...newLeads, ...prev])
      }
      if (newlySynced.length > 0 || deletedFileIds.length > 0) {
        const allSynced = [...new Set([...syncedFileIds, ...newlySynced])]
        localStorage.setItem('exodia-synced-lead-files', JSON.stringify(allSynced))
      }
    }

    syncLeadFiles()
    const interval = setInterval(syncLeadFiles, 15000)
    // Listen for file deletions
    const handleFileDelete = () => syncLeadFiles()
    window.addEventListener('lead-file-deleted', handleFileDelete)
    return () => {
      clearInterval(interval)
      window.removeEventListener('lead-file-deleted', handleFileDelete)
    }
  }, [])

  const [showAdd, setShowAdd] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [showEmailSuccess, setShowEmailSuccess] = useState(false)
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null)
  const [selectedDetailLead, setSelectedDetailLead] = useState<OutreachLead | null>(null)
  const [detailNotes, setDetailNotes] = useState('')
  const [newLead, setNewLead] = useState({ name: '', email: '', company: '', role: '' })
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [replyingTo, setReplyingTo] = useState<EmailHistoryItem | null>(null)
  const [editingLead, setEditingLead] = useState<OutreachLead | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showThread, setShowThread] = useState(false)
  const [threadLead] = useState<OutreachLead | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const memberFileRef = useRef<HTMLInputElement>(null)
  const [photoTarget, setPhotoTarget] = useState<number | 'edit' | null>(null)

  // Meeting booking modal
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetingBookLead, setMeetingBookLead] = useState<OutreachLead | null>(null)
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0])
  const [meetingTime, setMeetingTime] = useState('')
  const [bookingMeeting, setBookingMeeting] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: string }[]>([])
  const addNotification = (message: string, type = 'success') => {
    const id = crypto.randomUUID()
    setNotifications(prev => [...prev, { id, message, type }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000)
  }

  // === Reach Out Functions ===
  const addLead = () => {
    if (!newLead.name.trim() || !newLead.email.trim()) return
    const id = leads.length > 0 ? Math.max(...leads.map(l => l.id)) + 1 : 1
    setLeads(sortLeads([{ ...newLead, id, status: 'pending' as const, lastContacted: '', notes: '', emailHistory: [] }, ...leads]))
    setNewLead({ name: '', email: '', company: '', role: '' })
    setShowAdd(false)
    logActivity('Lead', `Added "${newLead.name.trim()}" (${newLead.email.trim()})`)
  }

  const triggerReSync = () => {
    localStorage.removeItem('exodia-synced-lead-files')
    reSyncAll.current = true
    addNotification('Re-syncing all leads from Lead Generation...', 'success')
    setTimeout(() => window.location.reload(), 800)
  }

  const confirmMeetingBooking = async () => {
    if (!meetingBookLead || !meetingDate || bookingMeeting) return
    if (!isSupabaseConfigured || !supabase) {
      addNotification('Meeting booking is unavailable until Supabase is configured.', 'error')
      return
    }
    const lead = meetingBookLead
    const now = new Date().toISOString()
    setBookingMeeting(true)
    try {
      const { data: tables, error: tablesError } = await supabase
        .from('timeline_tables')
        .select('id, title, columns')
        .order('created_at', { ascending: true })
      if (tablesError) throw tablesError
      const targetTable = tables?.find((table: any) => /onboarding|client/i.test(table.title)) || tables?.[0]
      if (!targetTable) throw new Error('Create a timeline table before booking a meeting.')
      const columns = typeof targetTable.columns === 'string' ? JSON.parse(targetTable.columns) : targetTable.columns
      const targetColumn = Array.isArray(columns)
        ? columns.find((column: any) => /introductory|intro call|discovery/i.test(column.label)) || columns[0]
        : null
      if (!targetColumn?.key) throw new Error('The selected timeline table has no columns.')

      const calendarItem = {
        id: crypto.randomUUID(),
        title: `Meeting - ${lead.name}`,
        type: 'meeting',
        date: meetingDate,
        start_time: meetingTime || null,
        end_time: null,
        description: `Meeting booked with ${lead.name} from ${lead.company}`,
        location: null,
        color: '#FF5900',
        assignees: [],
        notes: '',
        created_at: now,
        updated_at: now,
      }
      const [calendarResult, timelineResult] = await Promise.all([
        supabase.from('calendar_items').insert([calendarItem]),
        supabase.from('timeline_leads').insert([{
          table_id: targetTable.id,
          company: lead.company,
          contact: lead.name,
          email: lead.email,
          value: '',
          date: new Date(meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          column_key: targetColumn.key,
          notes: 'Auto-created from Meeting Booked',
          attachments: [],
          email_history: [],
          created_at: now,
          updated_at: now,
        }]),
      ])
      if (calendarResult.error) throw calendarResult.error
      if (timelineResult.error) throw timelineResult.error

      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      setLeads(prev => sortLeads(prev.map(item => item.id === lead.id
        ? { ...item, status: 'meeting-booked', lastContacted: today }
        : item)))
      logActivity('Lead', `Updated "${lead.name}" status to meeting-booked`)
      window.dispatchEvent(new CustomEvent('calendar-updated'))
      window.dispatchEvent(new CustomEvent('timeline-data-changed'))
      setShowMeetingModal(false)
      setMeetingBookLead(null)
      addNotification(`Meeting booked with ${lead.name} on ${meetingDate}${meetingTime ? ' at ' + meetingTime : ''}`)
    } catch (error) {
      console.error('Failed to book meeting:', error)
      addNotification(error instanceof Error ? error.message : 'Failed to book meeting. Please try again.', 'error')
    } finally {
      setBookingMeeting(false)
    }
  }

  const saveLeadEdit = () => {
    if (!editingLead) return
    setLeads(sortLeads(leads.map(l => l.id === editingLead.id ? editingLead : l)))
    setEditingLead(null)
    logActivity('Lead', `Edited "${editingLead.name}"`)
  }

  const sendEmail = async () => {
    if (!selectedLead || !emailSubject.trim()) return
    const fixUrl = (text: string) => text.replace(/https:\/\/exodiagamedev\.com(["')\s>])/g, 'https://calendar.app.google/rV8V8QwCYUr4XrP98$1')
    const now = new Date().toISOString()
    const messageId = `<${crypto.randomUUID()}@exodiagamedev.com>`
    const newEmail: EmailHistoryItem = {
      id: crypto.randomUUID(),
      subject: emailSubject.trim(),
      body: fixUrl(emailBody.trim()),
      sentAt: now,
      direction: 'sent',
    }
    if (!isSupabaseConfigured || !supabase) {
      addNotification('Email service is not configured.', 'error')
      return
    }
    try {
      const { error } = await supabase.functions.invoke('send-outreach-email', {
        body: {
          to: selectedLead.email,
          name: selectedLead.name,
          subject: emailSubject,
          body: fixUrl(emailBody),
          inReplyTo: replyingTo ? `<${replyingTo.id}@exodiagamedev.com>` : undefined,
          references: replyingTo ? `<${replyingTo.id}@exodiagamedev.com>` : undefined,
          messageId,
        },
      })
      if (error) throw error
    } catch (err) {
      console.error('Email send failed:', err)
      addNotification('Email could not be sent. Please try again.', 'error')
      return
    }
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    setLeads(sortLeads(leads.map(l => l.id === selectedLead.id ? {
      ...l,
      status: 'sent',
      lastContacted: today,
      emailHistory: [...l.emailHistory, newEmail],
    } : l)))
    setShowEmail(false)
    setEmailSubject('')
    setEmailBody('')
    setSelectedLead(null)
    setReplyingTo(null)
    setShowEmailSuccess(true)
    logActivity('Email', `Sent to "${selectedLead.name}" (${selectedLead.email})`)
  }

  // === Message Templates State ===
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [templatesWritable, setTemplatesWritable] = useState(false)
  const canonicalTemplateIds = useRef(new Set<string>())
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const categories = useMemo(
    () => [...new Set(templates.map(template => template.category).filter(Boolean))].sort(),
    [templates],
  )

  // === Message Templates Hook ===
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      emailMessage: defaultEmailMessage,
      body: emailHtmlStarter,
    },
  })
  const templateBodyPreview = renderEmailPreview(watch('body') || '')

  // === Message Templates Functions ===
  const migrateUrl = (body: string) => body.replace(/https:\/\/exodiagamedev\.com(["')\s>])/g, 'https://calendar.app.google/rV8V8QwCYUr4XrP98$1')

  const fetchTemplates = useCallback(async () => {
    setTemplatesWritable(false)
    canonicalTemplateIds.current.clear()

    if (!isSupabaseConfigured || !supabase) {
      setTemplates([])
      const saved = localStorage.getItem('exodia-message-templates')
      if (saved) {
        try {
          const parsed = JSON.parse(saved).map((template: MessageTemplate) => ({
            ...template,
            body: migrateUrl(template.body),
          }))
          setTemplates(parsed)
        } catch {}
      }
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const canonicalTemplates = (data ?? []) as MessageTemplate[]
      canonicalTemplateIds.current = new Set(canonicalTemplates.map(template => template.id))
      setErrorMessage(null)
      setTemplates(canonicalTemplates.map(template => ({
        ...template,
        body: migrateUrl(template.body),
      })))
      setTemplatesWritable(true)
    } catch (err) {
      console.error('Error fetching templates:', err)
      setTemplatesWritable(false)
      canonicalTemplateIds.current.clear()
      setErrorMessage('Canonical templates could not be loaded. No fallback records are being shown.')
      setShowForm(false)
      setEditingId(null)
      setDeleteConfirmId(null)
      setTemplates([])
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
      try { supabase?.removeChannel(channel) } catch {}
    }
  }, [fetchTemplates])

  const onSubmit = async ({ emailMessage: _emailMessage, ...data }: TemplateFormData) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!isSupabaseConfigured || !supabase || !templatesWritable) {
      setErrorMessage('Templates are view-only until the database is available.')
      return
    }

    try {
      if (editingId) {
        if (!canonicalTemplateIds.current.has(editingId)) {
          throw new Error('This recovery template has no canonical database identity and is view-only.')
        }
        const { data: updatedTemplate, error } = await supabase
          .from('message_templates')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select('*')
          .single()
        if (error) throw error
        if (!updatedTemplate || updatedTemplate.id !== editingId) throw new Error('The database did not confirm the template update.')
        setTemplates(prev => prev.map(t => t.id === editingId ? updatedTemplate as MessageTemplate : t))
        setSuccessMessage('Template updated successfully!')
        logActivity('Template', `Updated "${data.title}"`)
      } else {
        const { data: newTemplate, error } = await supabase
          .from('message_templates')
          .insert([{ ...data }])
          .select('*')
          .single()
        if (error) throw error
        if (!newTemplate?.id) throw new Error('The database did not confirm the template creation.')
        canonicalTemplateIds.current.add(newTemplate.id)
        setTemplates(prev => [newTemplate as MessageTemplate, ...prev])
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
    if (!templatesWritable || !canonicalTemplateIds.current.has(template.id)) {
      setErrorMessage('This recovery template has no canonical database identity and is view-only.')
      return
    }
    const emailMessage = extractEmailMessage(template.body) || defaultEmailMessage
    reset({
      title: template.title,
      category: template.category,
      subject: template.subject,
      emailMessage,
      body: applyEmailMessage(template.body, emailMessage),
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    setErrorMessage(null)
    const template = templates.find(t => t.id === id)

    if (!isSupabaseConfigured || !supabase || !templatesWritable) {
      setErrorMessage('Templates are view-only until the database is available.')
      addNotification('Template was not deleted because the database is unavailable.', 'error')
      return
    }
    if (!canonicalTemplateIds.current.has(id)) {
      setErrorMessage('This recovery template has no canonical database identity and is view-only.')
      addNotification('Recovery templates cannot be deleted.', 'error')
      return
    }

    try {
      const { data: deletedTemplate, error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id)
        .select('id')
        .single()

      if (error) throw error
      if (deletedTemplate?.id !== id) throw new Error('The database did not confirm the template deletion.')

      canonicalTemplateIds.current.delete(id)
      setTemplates(current => current.filter(item => item.id !== id))
      setSuccessMessage('Template deleted successfully!')
      if (template) logActivity('Template', `Deleted "${template.title}"`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error deleting template:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete template. Please try again.')
    }
    setDeleteConfirmId(null)
  }

  const handleDeleteCategory = async (category: string) => {
    if (!window.confirm(`Delete category "${category}" and all templates under it?`)) return
    if (!isSupabaseConfigured || !supabase || !templatesWritable) {
      addNotification('Category was not deleted because the database is unavailable.', 'error')
      return
    }
    const templateIds = templates.filter(template => template.category === category).map(template => template.id)
    if (templateIds.length === 0 || templateIds.some(id => !canonicalTemplateIds.current.has(id))) {
      addNotification('This category contains no confirmed canonical templates and is view-only.', 'error')
      return
    }

    try {
      const { data: deletedTemplates, error } = await supabase
        .from('message_templates')
        .delete()
        .in('id', templateIds)
        .select('id')
      if (error) throw error
      const deletedIds = new Set((deletedTemplates ?? []).map(template => template.id))
      if (deletedIds.size !== templateIds.length || templateIds.some(id => !deletedIds.has(id))) {
        await fetchTemplates()
        throw new Error('The database did not confirm deletion of every template in this category.')
      }

      templateIds.forEach(id => canonicalTemplateIds.current.delete(id))
      setTemplates(current => current.filter(template => !deletedIds.has(template.id)))
      if (selectedCategory === category) setSelectedCategory('All')
      addNotification(`Category "${category}" was deleted.`)
    } catch (error) {
      console.error('Failed to delete template category:', error)
      addNotification('Category could not be deleted. No local templates were changed.', 'error')
    }
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

  const allCategories = ['All', ...categories]

  return (
    <div>
      <div className="hidden">
      {/* ======== REACH OUT SECTION ======== */}
      <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header */}
        <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Reach Out</h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Email outreach and follow-up management</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
            <button
              onClick={triggerReSync}
              className="px-3 py-2 text-xs rounded-lg transition flex items-center gap-1.5"
              style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-light)', fontWeight: 500 }}
              title="Re-sync all leads from Lead Generation files"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Sync All
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Lead
            </button>
          </div>
          </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Pending', count: leads.filter(l => l.status === 'pending').length, color: '#3E4048' },
            { label: 'Sent', count: leads.filter(l => l.status === 'sent').length, color: '#0B8043' },
            { label: 'Follow Up', count: leads.filter(l => l.status === 'follow-up').length, color: '#4A90D9' },
            { label: 'No Reply', count: leads.filter(l => l.status === 'no-reply').length, color: '#DC2626' },
            { label: 'Replied', count: leads.filter(l => l.status === 'replied').length, color: '#FF5900' },
            { label: 'Meeting Booked', count: leads.filter(l => l.status === 'meeting-booked').length, color: '#2563EB' },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-xl border-2 exodia-card text-center theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="text-2xl sm:text-3xl mb-1" style={{ color: stat.color || 'var(--text-primary)', fontWeight: 700 }}>{stat.count}</div>
              <div className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{stat.label}</div>
            </div>
          ))}
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

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'pending', 'sent', 'follow-up', 'no-reply', 'replied', 'meeting-booked'].map((s) => (
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowEmail(false); setReplyingTo(null) }}>
            <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Compose Email</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>To: {selectedLead.email} ({selectedLead.name})</p>

              {selectedLead.emailHistory?.length > 0 && (
                <div className="mb-4 rounded-xl border" style={{ borderColor: 'var(--border-secondary)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-secondary)' }}>Previous conversation — click an entry to reply in thread</div>
                  <div className="max-h-48 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                    {selectedLead.emailHistory.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => {
                          setReplyingTo(email)
                          const prefix = email.subject.startsWith('Re:') ? '' : 'Re: '
                          setEmailSubject(prefix + email.subject)
                          setEmailBody(`\n\n---\nOn ${new Date(email.sentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, ${email.direction === 'sent' ? 'you' : selectedLead.name} wrote:\n> ${email.body.replace(/\n/g, '\n> ')}`)
                        }}
                        className="px-3 py-2.5 space-y-1 cursor-pointer transition hover:brightness-95"
                        style={{ backgroundColor: replyingTo?.id === email.id ? 'var(--accent-light)' : 'transparent' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium" style={{ color: email.direction === 'sent' ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {email.direction === 'sent' ? 'You:' : `${selectedLead.name}:`}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {new Date(email.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{email.subject}</p>
                        <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{email.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {replyingTo && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                  <span className="flex-1">Replying to: <strong>{replyingTo.subject}</strong></span>
                  <button onClick={() => { setReplyingTo(null); setEmailSubject(''); setEmailBody('') }} className="p-0.5 rounded hover:brightness-90" style={{ color: 'var(--accent)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <select
                onChange={(e) => {
                  const t = templates.find(t => t.id === e.target.value)
                  if (t && selectedLead) {
                    const replace = (text: string) =>
                      text
                        .replace(/\{\{contact_name\}\}/g, selectedLead.name || 'there')
                        .replace(/\{\{company_name\}\}/g, selectedLead.company || 'your company')
                        .replace(/\{\{sender_name\}\}/g, 'Marketing Team')
                        .replace(/\{\{sales_rep_name\}\}/g, 'our Sales Team')
                        .replace(/\{\{ops_rep_name\}\}/g, 'our Operations Team')
                        .replace(/\{\{proposed_date\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
                        .replace(/\{\{project_name\}\}/g, 'your project')
                    setEmailSubject(replace(t.subject))
                    setEmailBody(replace(t.body))
                  }
                }}
                className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none mb-3"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}
                defaultValue=""
              >
                <option value="" disabled>Choose a message template...</option>
                {categories.map(cat => {
                  const catTemplates = templates.filter(t => t.category === cat)
                  return (
                    <optgroup key={cat} label={cat}>
                      {catTemplates.length > 0 ? catTemplates.map(t => (
                        <option key={t.id} value={t.id} style={{ color: 'var(--text-primary)' }}>{t.title}</option>
                      )) : (
                        <option disabled style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No templates yet</option>
                      )}
                    </optgroup>
                  )
                })}
              </select>
              <input type="text" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
              <textarea placeholder="Write your email..." value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4 resize-none" style={{ borderColor: 'var(--border-primary)' }} />
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowEmail(false); setReplyingTo(null) }} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                <button onClick={sendEmail} disabled={!emailSubject.trim()} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Send Email</button>
              </div>
            </div>
          </div>
        )}

        {/* Thread View Modal */}
        {showThread && threadLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowThread(false)}>
            <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Email Thread</h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{threadLead.name} &middot; {threadLead.email}</p>
                </div>
                <button onClick={() => setShowThread(false)} className="p-1.5 rounded-lg transition" style={{ color: 'var(--accent)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
                {threadLead.emailHistory?.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No emails sent yet.</p>
                ) : (
                  [...threadLead.emailHistory].reverse().map((email) => (
                    <div
                      key={email.id}
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: email.direction === 'sent' ? 'var(--accent-light)' : 'var(--bg-secondary)',
                        border: '1px solid var(--border-secondary)',
                        marginLeft: email.direction === 'received' ? '24px' : '0',
                        marginRight: email.direction === 'sent' ? '24px' : '0',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: email.direction === 'sent' ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {email.direction === 'sent' ? 'You' : threadLead.name}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {new Date(email.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{email.subject}</p>
                      <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{email.body}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => { setShowThread(false); setSelectedLead(threadLead); setShowEmail(true); setEmailSubject(''); setEmailBody(''); setReplyingTo(null) }}
                  className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Reply
                </button>
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
                <div className="sm:w-1/2 p-6 border-r overflow-y-auto" style={{ borderColor: 'var(--border-secondary)' }}>
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
                        onClick={() => { const s = selectedDetailLead; setSelectedDetailLead(null); setDetailNotes(''); setSelectedLead(s); setShowEmail(true); setEmailSubject(''); setEmailBody(''); setReplyingTo(null) }}
                        className="w-full px-3 py-2 text-xs text-white rounded-lg transition"
                        style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
                      >
                        Send Email
                      </button>
                    </div>
                  </div>
                </div>
                {/* Right: Editable Notes */}
                <div className="sm:w-1/2 p-6">
                  <label className="text-sm mb-2" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Notes</label>
                  <textarea
                    value={detailNotes}
                    onChange={(e) => {
                      setDetailNotes(e.target.value)
                      setLeads(prev => prev.map(l => l.id === selectedDetailLead.id ? { ...l, notes: e.target.value } : l))
                    }}
                    placeholder="Write notes about this lead..."
                    rows={5}
                    className="w-full px-4 py-3 border rounded-xl outline-none resize-none text-sm leading-relaxed"
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
      </div>

      {/* ======== MESSAGE TEMPLATES SECTION ======== */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Message Templates</h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Search and use email templates</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(true); setEditingId(null); reset({ title: '', category: '', subject: '', emailMessage: defaultEmailMessage, body: applyEmailMessage(emailHtmlStarter, defaultEmailMessage) }) }}
                disabled={!templatesWritable}
                title={templatesWritable ? 'Create template' : 'Templates are view-only until canonical data is available'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                style={{ backgroundColor: 'var(--accent)', boxShadow: '0 4px 12px rgba(255,89,0,0.25)', color: '#FFFFFF' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Template
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        {errorMessage && !showForm && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search templates by name, category, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 border rounded-xl text-sm outline-none transition"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>

        {/* Category filter buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {allCategories.map((cat) => (
            <div key={cat} className="relative group">
              <button
                onClick={() => setSelectedCategory(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:-translate-y-0.5"
                style={{
                  backgroundColor: selectedCategory === cat ? '#FF5900' : 'var(--bg-secondary)',
                  color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                }}
              >
                {cat}
              </button>
              {cat !== 'All' && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDeleteCategory(cat)
                  }}
                  disabled={!templatesWritable || !templates.some(template => template.category === cat && canonicalTemplateIds.current.has(template.id))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{ backgroundColor: '#DC2626', color: '#FFF' }}
                  title={`Delete "${cat}" category`}
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-medium">Supabase not configured</p>
            <p className="text-xs text-amber-600 mt-1">Local fallback templates are available for recovery and are view-only.</p>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowForm(false); setEditingId(null); reset() }}>
            <div className="relative rounded-2xl border w-full max-w-5xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={(e) => e.stopPropagation()}>
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
                    <input {...register('category')} list="category-list" className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="Select or type a new category..." />
                    <datalist id="category-list">
                      {categories.map((cat) => (<option key={cat} value={cat} />))}
                    </datalist>
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
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email Message</label>
                  <textarea
                    {...register('emailMessage', {
                      onChange: (e) => setValue('body', applyEmailMessage(watch('body') || emailHtmlStarter, e.target.value), { shouldDirty: true, shouldValidate: true }),
                    })}
                    rows={15}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none resize-vertical"
                    style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    placeholder="Write the email content here..."
                  />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>HTML Email Designer</label>
                    </div>
                    <textarea {...register('body')} rows={16} className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none resize-vertical font-mono" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="<div style=&quot;font-family:Arial,sans-serif&quot;>Write your HTML email here...</div>" />
                    {errors.body && <p className="mt-1 text-xs text-red-600">{errors.body.message}</p>}
                  </div>
                  <div>
                    <p className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Live Preview</p>
                    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-primary)', backgroundColor: '#f4f4f5' }}>
                      <iframe
                        title="Email template preview"
                        srcDoc={templateBodyPreview}
                        sandbox=""
                        className="w-full h-[420px] bg-white"
                      />
                    </div>
                  </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ borderColor: '#E5E7EB' }}>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
        ) : (
          <>
            {(() => {
              const query = selectedCategory === 'All' ? '' : selectedCategory.toLowerCase()
              const results = (query ? templates.filter(t => t.category.toLowerCase() === query) : templates).filter(t =>
                !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.subject.toLowerCase().includes(searchQuery.toLowerCase())
              )
              if (results.length === 0) {
                return (
                  <div className="text-center py-16 rounded-2xl border-2 exodia-card" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{query ? 'No templates match your search' : 'No templates yet'}</p>
                  </div>
                )
              }
              const grouped: Record<string, typeof results> = {}
              results.forEach(t => {
                const cat = t.category || 'Uncategorized'
                if (!grouped[cat]) grouped[cat] = []
                grouped[cat].push(t)
              })
              return <div className="space-y-8">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold mb-3 cursor-pointer hover:opacity-70 transition inline-flex items-center gap-1.5" style={{ color: selectedCategory === category ? 'var(--accent)' : 'var(--text-primary)' }} onClick={() => setSelectedCategory(category)}>
                      {category}
                      {selectedCategory === category && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedCategory('All') }} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>Clear</button>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {items.map((template) => (
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
                          <button
                            onClick={() => handleEdit(template)}
                            disabled={!templatesWritable || !canonicalTemplateIds.current.has(template.id)}
                            className="p-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ color: 'var(--accent)' }}
                            title={templatesWritable && canonicalTemplateIds.current.has(template.id) ? 'Edit' : 'Recovery template (view-only)'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {deleteConfirmId === template.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(template.id)} disabled={!templatesWritable || !canonicalTemplateIds.current.has(template.id)} className="p-2 rounded-lg bg-red-50 transition disabled:cursor-not-allowed disabled:opacity-40" title="Confirm"><svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                              <button onClick={() => setDeleteConfirmId(null)} className="p-2 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Cancel"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(template.id)}
                              disabled={!templatesWritable || !canonicalTemplateIds.current.has(template.id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition disabled:cursor-not-allowed disabled:opacity-40"
                              style={{ color: 'var(--accent)' }}
                              title={templatesWritable && canonicalTemplateIds.current.has(template.id) ? 'Delete' : 'Recovery template (view-only)'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Subject</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Email Message</p>
                        <p className="text-sm whitespace-pre-wrap line-clamp-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{extractEmailMessage(template.body) || template.body}</p>
                      </div>
                    </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          })()}
          </>)}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
          {notifications.map(n => (
            <div
              key={n.id}
              className="px-4 py-3 rounded-xl shadow-lg text-sm animate-slide-in"
              style={{ backgroundColor: n.type === 'success' ? '#0B8043' : '#DC2626', color: '#FFF' }}
              role={n.type === 'success' ? 'status' : 'alert'}
            >
              <div className="flex items-center gap-2">
                {n.type === 'success' ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {n.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Meeting Booking Modal */}
      {showMeetingModal && meetingBookLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowMeetingModal(false)}>
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Book Meeting</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Set the date and time for the meeting with <strong>{meetingBookLead.name}</strong>.</p>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Meeting Date</label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Meeting Time (optional)</label>
            <input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => {
                setShowMeetingModal(false); setMeetingBookLead(null)
              }} disabled={bookingMeeting} className="px-4 py-2 text-sm rounded-lg disabled:opacity-50" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={confirmMeetingBooking} disabled={bookingMeeting} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>{bookingMeeting ? 'Booking…' : 'Confirm Booking'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Sent Success Popup */}
      {showEmailSuccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowEmailSuccess(false)}>
          <div className="relative rounded-2xl border p-8 max-w-sm w-full text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F0FDF4' }}>
              <svg className="w-8 h-8" style={{ color: '#16A34A' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Email Sent!</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              Your email has been sent successfully.
            </p>
            <button
              onClick={() => setShowEmailSuccess(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition hover:opacity-80"
              style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
