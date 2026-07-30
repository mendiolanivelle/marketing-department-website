import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sha256Hex } from '../lib/fileIntegrity'
import {
  acknowledgePrivateStorageReview,
  cleanupUnreferencedPrivateObjects,
  drainPrivateStorageCleanup,
  isDefiniteDatabaseRejection,
  queuePrivateStorageCleanup,
  uploadPrivateObject,
} from '../lib/privateStorage'

type RequestType = 'Feedback' | 'Bug' | 'Improvement' | 'New Feature' | 'Question'
type RequestPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
type RequestStatus = 'Open' | 'Reviewing' | 'Planned' | 'Done' | 'Closed'

interface WebsiteRequest {
  id: string
  title: string
  request_type: RequestType
  priority: RequestPriority
  status: RequestStatus
  page_area: string | null
  description: string
  requester_name: string | null
  requester_email: string | null
  created_by: string | null
  admin_notes: string | null
  attachments?: WebsiteRequestAttachment[] | null
  created_at: string
  updated_at: string
}

interface WebsiteRequestAttachment {
  name: string
  type: string
  dataUrl?: string
  path?: string
  size?: number
  sha256?: string
  file?: File
}

const requestTypes: RequestType[] = ['Feedback', 'Bug', 'Improvement', 'New Feature', 'Question']
const priorities: RequestPriority[] = ['Low', 'Medium', 'High', 'Urgent']
const statuses: RequestStatus[] = ['Open', 'Reviewing', 'Planned', 'Done', 'Closed']
const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024
const MAX_ATTACHMENTS = 4
const ATTACHMENT_BUCKET = 'website-request-attachments'
const SIGNED_URL_TTL_SECONDS = 60 * 60
const PRIVATE_STORAGE_ENABLED = import.meta.env.VITE_PRIVATE_STORAGE_ENABLED === 'true'
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

class UnknownRequestSaveOutcome extends Error {}

const priorityStyle: Record<RequestPriority, { bg: string; text: string; border: string }> = {
  Low: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  Medium: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  High: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  Urgent: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
}

const statusStyle: Record<RequestStatus, { bg: string; text: string }> = {
  Open: { bg: '#F3F4F6', text: '#374151' },
  Reviewing: { bg: '#FEF3C7', text: '#92400E' },
  Planned: { bg: '#E0F2FE', text: '#0369A1' },
  Done: { bg: '#DCFCE7', text: '#166534' },
  Closed: { bg: '#E5E7EB', text: '#4B5563' },
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function getDisplayName(email?: string | null) {
  if (!email) return ''
  const name = email.split('@')[0].replace(/[._-]+/g, ' ')
  return name.replace(/\b\w/g, letter => letter.toUpperCase())
}

function emptyForm(email?: string | null) {
  return {
    title: '',
    request_type: 'Feedback' as RequestType,
    priority: 'Medium' as RequestPriority,
    page_area: '',
    description: '',
    requester_name: getDisplayName(email),
    attachments: [] as WebsiteRequestAttachment[],
  }
}

export default function WebsiteRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<WebsiteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reconciliationRequired, setReconciliationRequired] = useState(false)
  const [message, setMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'All'>('Open')
  const [form, setForm] = useState(() => emptyForm(user?.email))

  const visibleRequests = useMemo(() => {
    if (statusFilter === 'All') return requests
    return requests.filter(request => request.status === statusFilter)
  }, [requests, statusFilter])

  const loadRequests = async () => {
    setLoading(true)
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Database is not configured, so requests cannot sync yet.')
      setLoading(false)
      return
    }

    const client = supabase
    await drainPrivateStorageCleanup(client, ATTACHMENT_BUCKET)
    const { data, error } = await client
      .from('website_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Could not load requests: ${error.message}`)
    } else {
      const loaded = (data || []) as WebsiteRequest[]
      const attachmentPaths = loaded.flatMap(request =>
        Array.isArray(request.attachments)
          ? request.attachments
            .map(attachment => attachment.path)
            .filter((path): path is string => typeof path === 'string' && path.length > 0)
          : [],
      )
      const signedUrls = new Map<string, string>()
      await Promise.all(attachmentPaths.map(async path => {
        const { data: signedData } = await client.storage
          .from(ATTACHMENT_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
        if (signedData?.signedUrl) signedUrls.set(path, signedData.signedUrl)
      }))
      setRequests(loaded.map(request => ({
        ...request,
        attachments: Array.isArray(request.attachments)
          ? request.attachments.map(attachment => ({
            ...attachment,
            dataUrl: (attachment.path && signedUrls.get(attachment.path)) || attachment.dataUrl,
          }))
          : [],
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadRequests()

    if (!isSupabaseConfigured || !supabase) return
    const channel = supabase
      .channel('website-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_requests' }, () => { loadRequests() })
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [])

  const addAttachments = async (files: FileList | null) => {
    if (!PRIVATE_STORAGE_ENABLED) return
    if (!files?.length) return
    const remaining = MAX_ATTACHMENTS - form.attachments.length
    if (remaining <= 0) {
      setMessage(`You can attach up to ${MAX_ATTACHMENTS} images.`)
      return
    }
    const images = Array.from(files)
      .filter(file => ALLOWED_ATTACHMENT_TYPES.has(file.type))
      .slice(0, remaining)
    if (images.length === 0) {
      setMessage('Attach a PNG, JPEG, WebP, GIF, or AVIF image.')
      return
    }
    const oversized = images.find(file => file.size > MAX_ATTACHMENT_SIZE)
    if (oversized) {
      setMessage('Images must be 2MB or smaller.')
      return
    }
    const attachments = images.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      file,
      dataUrl: URL.createObjectURL(file),
    }))
    setForm(prev => ({ ...prev, attachments: [...prev.attachments, ...attachments] }))
    setMessage('')
  }

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')

    if (!isSupabaseConfigured || !supabase) {
      setMessage('Database is not configured, so this request was not submitted.')
      return
    }

    if (!form.title.trim() || !form.description.trim()) {
      setMessage('Please add a title and description.')
      return
    }
    if (reconciliationRequired) {
      setMessage('Refresh and verify the previous request before submitting again.')
      return
    }

    setSaving(true)
    const requestId = crypto.randomUUID()
    const uploadedPaths: string[] = []
    let cleanupAllowed = true
    try {
      const storedAttachments: WebsiteRequestAttachment[] = []
      const attachments = PRIVATE_STORAGE_ENABLED ? form.attachments : []
      for (const attachment of attachments) {
        if (!attachment.file) continue
        const path = `${crypto.randomUUID()}/${crypto.randomUUID()}`
        const sha256 = await sha256Hex(attachment.file)
        const reviewReserved = await queuePrivateStorageCleanup(
          supabase,
          ATTACHMENT_BUCKET,
          [path],
          'failed_website_request_upload',
          requestId,
          false,
        )
        if (!reviewReserved) {
          throw new Error('Could not reserve a durable attachment record')
        }
        const uploadOutcome = await uploadPrivateObject(
          supabase,
          ATTACHMENT_BUCKET,
          path,
          attachment.file,
          attachment.type,
          sha256,
        )
        if (uploadOutcome === 'absent') {
          await acknowledgePrivateStorageReview(supabase, ATTACHMENT_BUCKET, [path])
          throw new Error('Attachment upload failed')
        }
        if (uploadOutcome === 'unknown') {
          throw new UnknownRequestSaveOutcome()
        }
        uploadedPaths.push(path)
        storedAttachments.push({
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          sha256,
          path,
        })
      }

      const requestRow = {
        id: requestId,
        title: form.title.trim(),
        request_type: form.request_type,
        priority: form.priority,
        page_area: form.page_area.trim() || null,
        description: form.description.trim(),
        requester_name: form.requester_name.trim() || getDisplayName(user?.email) || null,
        requester_email: user?.email || null,
        created_by: user?.id || null,
        attachments: storedAttachments,
      }
      let insertError: unknown = null
      try {
        const { error } = await supabase.from('website_requests').insert([requestRow])
        insertError = error
      } catch (error) {
        insertError = error
      }
      if (insertError) {
        let verification: 'saved' | 'absent' | 'unknown' = 'unknown'
        try {
          const { data, error: verifyError } = await supabase
            .from('website_requests')
            .select('id')
            .eq('id', requestId)
            .maybeSingle()
          verification = verifyError ? 'unknown' : data ? 'saved' : 'absent'
        } catch {
          verification = 'unknown'
        }
        if (
          verification === 'absent'
          && isDefiniteDatabaseRejection(insertError)
        ) {
          throw new Error('Database insert failed')
        }
        if (verification === 'absent') verification = 'unknown'
        if (verification === 'unknown') {
          cleanupAllowed = false
          throw new UnknownRequestSaveOutcome()
        }
      }

      await acknowledgePrivateStorageReview(
        supabase,
        ATTACHMENT_BUCKET,
        uploadedPaths,
      )
      setMessage('Request submitted and synced to the database.')
      form.attachments.forEach(attachment => {
        if (attachment.dataUrl?.startsWith('blob:')) URL.revokeObjectURL(attachment.dataUrl)
      })
      setForm(emptyForm(user?.email))
      void loadRequests()
    } catch (error) {
      if (cleanupAllowed && uploadedPaths.length > 0) {
        await cleanupUnreferencedPrivateObjects(
          supabase,
          ATTACHMENT_BUCKET,
          uploadedPaths,
        )
      }
      if (error instanceof UnknownRequestSaveOutcome) {
        setReconciliationRequired(true)
        setMessage(
          'The save outcome is unknown. Private objects were preserved for administrator '
          + 'reconciliation; refresh and verify before retrying.',
        )
      } else {
        const detail = error instanceof Error ? error.message : 'unknown error'
        setMessage(`Could not submit request: ${detail}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id: string, status: RequestStatus) => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Database is not configured, so the status was not updated.')
      return
    }
    const { data, error } = await supabase
      .from('website_requests')
      .update({ status })
      .eq('id', id)
      .select('id')
      .single()
    if (error || !data) {
      setMessage(`Could not update status: ${error?.message || 'request was not found'}`)
      return
    }
    setRequests(current => current.map(request => request.id === id ? { ...request, status } : request))
  }

  const updatePriority = async (id: string, priority: RequestPriority) => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Database is not configured, so the priority was not updated.')
      return
    }
    const { data, error } = await supabase
      .from('website_requests')
      .update({ priority })
      .eq('id', id)
      .select('id')
      .single()
    if (error || !data) {
      setMessage(`Could not update priority: ${error?.message || 'request was not found'}`)
      return
    }
    setRequests(current => current.map(request => request.id === id ? { ...request, priority } : request))
  }

  const deleteRequest = async (id: string) => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Database is not configured, so the request was not deleted.')
      return
    }
    if (!confirm('Delete this request?')) return
    const request = requests.find(item => item.id === id)
    const { data, error } = await supabase
      .from('website_requests')
      .delete()
      .eq('id', id)
      .select('id')
      .single()
    if (error || !data) {
      setMessage(`Could not delete request: ${error?.message || 'request was not found'}`)
      return
    }
    const attachmentPaths = request?.attachments
      ?.map(attachment => attachment.path)
      .filter((path): path is string => typeof path === 'string' && path.length > 0) || []
    if (attachmentPaths.length > 0) {
      const cleanupComplete = await drainPrivateStorageCleanup(supabase, ATTACHMENT_BUCKET)
      if (!cleanupComplete) {
        setMessage('The request was deleted. Its private attachments remain tracked for automatic cleanup.')
      }
    }
    setRequests(current => current.filter(request => request.id !== id))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Website Requests</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)', fontWeight: 300 }}>
              Website feedback, bug reports, and improvement tickets from the team.
            </p>
          </div>
          <button
            onClick={loadRequests}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm transition hover:opacity-80"
            style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-primary)', fontWeight: 500 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form
          onSubmit={submitRequest}
          className="rounded-xl border p-5 h-fit"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-secondary)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>New Ticket</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Saved directly to Supabase</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-secondary)' }}
                placeholder="What should be improved?"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Type</span>
                <select
                  value={form.request_type}
                  onChange={(event) => setForm({ ...form, request_type: event.target.value as RequestType })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border-secondary)' }}
                >
                  {requestTypes.map(type => <option key={type}>{type}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Priority</span>
                <select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value as RequestPriority })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border-secondary)' }}
                >
                  {priorities.map(priority => <option key={priority}>{priority}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Page or Area</span>
              <input
                value={form.page_area}
                onChange={(event) => setForm({ ...form, page_area: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-secondary)' }}
                placeholder="Dashboard, Lead Generation, mobile view..."
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Requester</span>
              <input
                value={form.requester_name}
                onChange={(event) => setForm({ ...form, requester_name: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-secondary)' }}
                placeholder="Your name"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Details</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm min-h-32 resize-y"
                style={{ borderColor: 'var(--border-secondary)' }}
                placeholder="Describe the problem, idea, or feedback."
              />
            </label>

            {PRIVATE_STORAGE_ENABLED && (
              <>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Images</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    multiple
                    onChange={(event) => { addAttachments(event.target.files); event.currentTarget.value = '' }}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--border-secondary)' }}
                  />
                </label>

                {form.attachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {form.attachments.map((attachment, index) => (
                      <div key={`${attachment.name}-${index}`} className="relative overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-secondary)' }}>
                        <img src={attachment.dataUrl} alt={attachment.name} className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            if (attachment.dataUrl?.startsWith('blob:')) URL.revokeObjectURL(attachment.dataUrl)
                            setForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }))
                          }}
                          className="absolute right-1 top-1 rounded-full px-1.5 text-xs"
                          style={{ backgroundColor: '#1B1A1C', color: '#FFFFFF' }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={saving || reconciliationRequired}
              className="w-full rounded-lg px-4 py-2.5 text-sm transition disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF', fontWeight: 600 }}
            >
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>

          {message && (
            <p className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--text-primary)' }}>
              {message}
            </p>
          )}
        </form>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {([...statuses, 'All'] as Array<RequestStatus | 'All'>).map(status => {
                const active = statusFilter === status
                const count = status === 'All' ? requests.length : requests.filter(request => request.status === status).length
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className="rounded-lg border px-3 py-2 text-xs transition"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--border-secondary)',
                      backgroundColor: active ? 'var(--accent-light)' : 'var(--bg-card)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {status} <span style={{ opacity: 0.65 }}>{count}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{visibleRequests.length} ticket{visibleRequests.length === 1 ? '' : 's'}</p>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-xl border" style={{ borderColor: 'var(--border-secondary)' }}>
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-solid" style={{ borderColor: 'var(--border-secondary)', borderTopColor: 'var(--accent)' }} />
            </div>
          ) : visibleRequests.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center rounded-xl border text-center" style={{ borderColor: 'var(--border-secondary)', backgroundColor: 'var(--bg-card)' }}>
              <div>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-6 h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3.75h6M5.25 5.25h13.5v10.5H8.25L5.25 18.75V5.25z" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No request tickets yet.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleRequests.map(request => (
                <article
                  key={request.id}
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-secondary)', boxShadow: 'var(--shadow-sm)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ backgroundColor: statusStyle[request.status].bg, color: statusStyle[request.status].text, fontWeight: 600 }}>
                          {request.status}
                        </span>
                        <span className="rounded-full border px-2.5 py-1 text-[11px]" style={{ backgroundColor: priorityStyle[request.priority].bg, borderColor: priorityStyle[request.priority].border, color: priorityStyle[request.priority].text, fontWeight: 600 }}>
                          {request.priority}
                        </span>
                        <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                          {request.request_type}
                        </span>
                      </div>
                      <h3 className="text-base leading-snug" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{request.title}</h3>
                    </div>
                    <button
                      onClick={() => deleteRequest(request.id)}
                      className="rounded-lg p-2 transition hover:opacity-70"
                      style={{ color: '#DC2626' }}
                      title="Delete request"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12m-1 0-.7 12.2A2 2 0 0114.3 21H9.7a2 2 0 01-2-1.8L7 7m3 0V4h4v3" />
                      </svg>
                    </button>
                  </div>

                  <p className="mt-3 text-sm leading-6 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {request.description}
                  </p>

                  <div className="mt-4 grid gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {request.page_area && <p><span style={{ fontWeight: 600 }}>Area:</span> {request.page_area}</p>}
                    <p><span style={{ fontWeight: 600 }}>From:</span> {request.requester_name || 'Unnamed'}{request.requester_email ? ` (${request.requester_email})` : ''}</p>
                    <p><span style={{ fontWeight: 600 }}>Created:</span> {formatDate(request.created_at)}</p>
                  </div>

                  {request.attachments && request.attachments.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {request.attachments.map((attachment, index) => (
                        attachment.dataUrl ? (
                          <a key={`${attachment.name}-${index}`} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-secondary)' }}>
                            <img src={attachment.dataUrl} alt={attachment.name} className="h-20 w-full object-cover" />
                          </a>
                        ) : (
                          <div key={`${attachment.name}-${index}`} className="flex h-20 items-center justify-center rounded-lg border px-2 text-center text-[11px]" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-muted)' }}>
                            Attachment unavailable
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Status</span>
                      <select
                        value={request.status}
                        onChange={(event) => updateStatus(request.id, event.target.value as RequestStatus)}
                        className="mt-1 w-full rounded-lg border px-2 py-2 text-xs"
                        style={{ borderColor: 'var(--border-secondary)' }}
                      >
                        {statuses.map(status => <option key={status}>{status}</option>)}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Priority</span>
                      <select
                        value={request.priority}
                        onChange={(event) => updatePriority(request.id, event.target.value as RequestPriority)}
                        className="mt-1 w-full rounded-lg border px-2 py-2 text-xs"
                        style={{ borderColor: 'var(--border-secondary)' }}
                      >
                        {priorities.map(priority => <option key={priority}>{priority}</option>)}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
