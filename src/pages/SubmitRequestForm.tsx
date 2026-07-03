import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const departments = ['HR Department', 'Operations Department', 'Finance Department', 'Sales Department', 'IT Department', 'Facilities Department']
const requestTypes = ['Social Media', 'Print', 'Video', 'Photo', 'Other']
const priorities = ['Low', 'Standard', 'High', 'Rush']

function generateToken(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

function generateTrackingId(department: string): string {
  const deptMap: Record<string, string> = {
    'HR Department': 'HR',
    'Operations Department': 'OPS',
    'Finance Department': 'FIN',
    'Sales Department': 'SAL',
    'IT Department': 'IT',
    'Facilities Department': 'FAC',
  }
  const dept = deptMap[department] || department.substring(0, 3).toUpperCase()
  const yy = String(new Date().getFullYear()).slice(-2)
  const mm = String(new Date().getMonth() + 1).padStart(2, '0')
  const existing = localStorage.getItem('exodia-marketing-requests')
  const requests: any[] = existing ? JSON.parse(existing) : []
  const used = new Set<number>()
  let maxSeq = 0
  for (const r of requests) {
    if (r.tracking_id && r.tracking_id.startsWith('MKRQ - ')) {
      const num = parseInt(r.tracking_id.split(' - ')[3], 10)
      if (!isNaN(num)) { used.add(num); if (num > maxSeq) maxSeq = num }
    }
  }
  let seq = 1
  while (used.has(seq)) seq++
  return `MKRQ - ${dept} - ${yy}${mm} - ${String(seq).padStart(3, '0')}`
}

function getRequests(): any[] {
  const existing = localStorage.getItem('exodia-marketing-requests')
  return existing ? JSON.parse(existing) : []
}

function saveRequests(requests: any[]) {
  localStorage.setItem('exodia-marketing-requests', JSON.stringify(requests))
}

interface FormData {
  name: string
  department: string
  email: string
  title: string
  campaign: string
  description: string
  requestType: string[]
  otherRequestType: string
  platforms: string
  audience: string
  resourceLinks: string[]
  dateNeeded: string
  priority: string
  managementApproval: string
}

export default function SubmitRequestForm() {
  const { token } = useParams<{ token: string }>()
  const isEditMode = !!token

  const [form, setForm] = useState<FormData>({
    name: '',
    department: '',
    email: '',
    title: '',
    campaign: '',
    description: '',
    requestType: [],
    otherRequestType: '',
    platforms: '',
    audience: '',
    resourceLinks: [],
    dateNeeded: '',
    priority: '',
    managementApproval: '',
  })
  const [editToken, setEditToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(isEditMode)
  const [trackingId, setTrackingId] = useState('')

  useEffect(() => {
    if (token) {
      const loadFromSupabase = async () => {
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from('marketing_requests').select('*').eq('edit_token', token).single()
          if (data) {
            const parsedOther = data.request_type?.find((t: string) => t.startsWith('Other: '))
            const cleanedTypes = parsedOther
              ? data.request_type.filter((t: string) => t !== parsedOther)
              : data.request_type || []
            setForm({
              name: data.name || '',
              department: data.department || '',
              email: data.email || '',
              title: data.title || '',
              campaign: data.campaign || '',
              description: data.description || '',
              requestType: cleanedTypes,
              otherRequestType: parsedOther ? parsedOther.replace('Other: ', '') : '',
              platforms: data.platforms || '',
              audience: data.audience || '',
              resourceLinks: data.resource_links ? data.resource_links.split(', ').filter(Boolean) : [],
              dateNeeded: data.date_needed || '',
              priority: data.priority || '',
              managementApproval: data.management_approval || '',
            })
            setEditToken(token)
            setLoading(false)
            return
          }
        }
        const requests = getRequests()
        const existing = requests.find((r: any) => r.editToken === token || r.edit_token === token)
        if (existing) {
          const parsedOther = existing.requestType?.find((t: string) => t.startsWith('Other: '))
          const cleanedTypes = parsedOther
            ? existing.requestType.filter((t: string) => t !== parsedOther)
            : existing.requestType || []
          setForm({
            name: existing.name || '',
            department: existing.department || '',
            email: existing.email || '',
            title: existing.title || '',
            campaign: existing.campaign || '',
            description: existing.description || '',
            requestType: cleanedTypes,
            otherRequestType: parsedOther ? parsedOther.replace('Other: ', '') : '',
            platforms: existing.platforms || '',
            audience: existing.audience || '',
            resourceLinks: existing.resourceLinks || existing.resource_links?.split(', ').filter(Boolean) || [],
            dateNeeded: existing.dateNeeded || existing.date_needed || '',
            priority: existing.priority || '',
            managementApproval: existing.managementApproval || existing.management_approval || '',
          })
          setEditToken(token)
        } else {
          setError('Request not found. The edit link may be invalid.')
        }
        setLoading(false)
      }
      loadFromSupabase()
    } else {
      const saved = localStorage.getItem('exodia-marketing-request-draft')
      if (saved) {
        try { setForm(JSON.parse(saved)) } catch {}
      }
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!isEditMode && !submitted) {
      localStorage.setItem('exodia-marketing-request-draft', JSON.stringify(form))
    }
  }, [form, isEditMode, submitted])

  const toggleRequestType = (type: string) => {
    setForm(prev => ({
      ...prev,
      requestType: prev.requestType.includes(type)
        ? prev.requestType.filter(t => t !== type)
        : [...prev.requestType, type],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const finalRequestTypes = [...form.requestType]
    if (form.otherRequestType.trim()) finalRequestTypes.push(`Other: ${form.otherRequestType.trim()}`)

    const now = new Date().toISOString()
    const token = editToken || generateToken()
    let tid = editToken ? '' : ''

    const dbPayload: Record<string, any> = {
      name: form.name,
      department: form.department,
      email: form.email,
      title: form.title,
      campaign: form.campaign || null,
      description: form.description || null,
      request_type: finalRequestTypes,
      platforms: form.platforms || null,
      audience: form.audience || null,
      resource_links: form.resourceLinks.filter(l => l.trim()).join(', '),
      date_needed: form.dateNeeded,
      priority: form.priority,
      management_approval: form.managementApproval || 'Pending',
      edit_token: token,
      updated_at: now,
    }
    if (!editToken) dbPayload.created_at = now

    if (isSupabaseConfigured && supabase) {
      if (editToken) {
        const { error: err } = await supabase.from('marketing_requests').update(dbPayload).eq('edit_token', editToken)
        if (err) { console.error('Update error:', err); setError(err.message || 'Failed to update. Please try again.'); setSubmitting(false); return }
      } else {
        const { data: inserted, error: err } = await supabase.from('marketing_requests').insert([dbPayload]).select('tracking_id')
        if (err) { console.error('Insert error:', err); setError(err.message || 'Failed to submit. Please try again.'); setSubmitting(false); return }
        if (inserted && inserted[0]?.tracking_id) tid = inserted[0].tracking_id
      }
    } else {
      const requests = getRequests()
      const localPayload = { ...dbPayload, editToken: token, resourceLinks: form.resourceLinks.filter(l => l.trim()), tracking_id: editToken ? dbPayload.tracking_id : generateTrackingId(form.department) }
      if (editToken) {
        const idx = requests.findIndex((r: any) => r.editToken === editToken)
        if (idx !== -1) requests[idx] = localPayload
      } else {
        requests.push(localPayload)
      }
      saveRequests(requests)
      if (!editToken) tid = localPayload.tracking_id
    }

    setEditToken(token)
    if (tid) setTrackingId(tid)
    setSubmitting(false)
    setSubmitted(true)
    localStorage.removeItem('exodia-marketing-request-draft')
    window.dispatchEvent(new CustomEvent('marketing-request-updated'))

    // Auto-create campaign + calendar task
    if (!editToken) {
      const campaignsKey = 'exodia-campaigns'
      const savedCampaigns = localStorage.getItem(campaignsKey)
      const campaigns = savedCampaigns ? JSON.parse(savedCampaigns) : []
      const newId = campaigns.length > 0 ? Math.max(...campaigns.map((c: any) => c.id)) + 1 : 1
      const campaign = { id: newId, name: form.title, dept: form.department, status: 'Pending', due: form.dateNeeded, requesterName: form.name, requesterEmail: form.email }
      campaigns.push(campaign)
      localStorage.setItem(campaignsKey, JSON.stringify(campaigns))

      const calKey = 'exodia-calendar-items'
      const savedCal = localStorage.getItem(calKey)
      const calItems = savedCal ? JSON.parse(savedCal) : []
      const calId = crypto.randomUUID()
      const now = new Date().toISOString()
      const calItem = {
        id: calId, title: form.title, type: 'task', date: form.dateNeeded,
        start_time: null, end_time: null, description: `Campaign for ${form.department}`,
        location: null, color: '#1a73e8', assignees: [], notes: 'Status: Pending',
        created_at: now, updated_at: now,
      }
      calItems.push(calItem)
      localStorage.setItem(calKey, JSON.stringify(calItems))

      if (isSupabaseConfigured && supabase) {
        await supabase.from('calendar_items').insert([calItem]).maybeSingle()
      }

      window.dispatchEvent(new CustomEvent('calendar-updated'))
    }

    if (form.email && isSupabaseConfigured && supabase) {
      try {
        const editUrl = `${window.location.origin}/#/edit-request/${token}`
        await supabase.functions.invoke('send-edit-link', {
          body: { to: form.email, name: form.name, editLink: editUrl, title: form.title },
        })
        setEmailSent(true)
      } catch {}
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1B1A1C' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#FF5900' }}></div>
      </div>
    )
  }

  if (submitted) {
    const editUrl = `${window.location.origin}/#/edit-request/${editToken}`
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1B1A1C' }}>
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg, rgba(255,89,0,0.2), rgba(255,140,51,0.1))' }}>
            <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl mb-3" style={{ color: '#FFFFFF', fontWeight: 700 }}>{isEditMode ? 'Request Updated' : 'Request Submitted'}</h1>
          {trackingId && (
            <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,89,0,0.15)' }}>
              <span className="text-xs font-mono font-bold" style={{ color: '#FF5900' }}>{trackingId}</span>
            </div>
          )}
          <p className="text-sm mb-3 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300, lineHeight: 1.6 }}>
            {isEditMode ? 'Your changes have been saved.' : 'Your marketing request has been received.'}
          </p>
          {emailSent && (
            <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>
              An edit link was sent to <strong style={{ color: '#FF5900' }}>{form.email}</strong>
            </p>
          )}
          <div className="mb-6 p-3 rounded-xl text-left" style={{ backgroundColor: '#FFFFFF' }}>
            <p className="text-xs mb-1" style={{ color: '#1B1A1C', fontWeight: 500 }}>EDIT LINK — SAVE THIS TO EDIT LATER</p>
            <div className="flex items-center gap-2">
              <input readOnly value={editUrl} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-transparent outline-none" style={{ color: '#1B1A1C', border: '1px solid #D1D5DB' }} />
              <button
                onClick={() => { navigator.clipboard.writeText(editUrl) }}
                className="px-2.5 py-1.5 text-xs text-white rounded-lg flex-shrink-0"
                style={{ backgroundColor: '#FF5900' }}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <button
              onClick={() => {
              setForm({
                name: '', department: '', email: '', title: '', campaign: '', description: '',
                requestType: [], otherRequestType: '', platforms: '', audience: '',
                resourceLinks: [], dateNeeded: '', priority: '', managementApproval: '',
              })
              setEditToken('')
              setSubmitted(false)
              setError('')
              setEmailSent(false)
              setTrackingId('')
            }}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-medium transition hover:-translate-y-0.5 cursor-pointer"
              style={{ backgroundColor: '#FF5900', color: '#FFFFFF', border: 'none', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}
            >
              New Request
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#FAFAFA', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1B1A1C 0%, #2D2B2E 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="py-12 sm:py-16 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,89,0,0.2), rgba(255,140,51,0.1))' }}>
              <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl mb-3" style={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}>{isEditMode ? 'Edit Request' : 'Marketing Request Form'}</h1>
            <p className="text-sm sm:text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>
              {isEditMode ? 'Update your answers below and save your changes.' : 'Fill out the details below and our marketing team will get back to you shortly.'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pb-16" style={{ marginTop: '-1.5rem' }}>
        <div className="space-y-6">
          {/* Section A */}
          <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
            <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
              <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION A: REQUESTER INFORMATION</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Name of Requester</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Your full name" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Department</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}>
                    <option value="">Select department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Email / Internal Chat Handle</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="email@company.com or @slackhandle" />
              </div>
            </div>
          </div>

          {/* Section B */}
          <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
            <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
              <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION B: PROJECT OVERVIEW</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Request Title</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g., Q3 Campaign Banner" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Campaign / Project</label>
                  <input type="text" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Campaign or project name" />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Description / Objective</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="What is the goal of this request?" />
              </div>
            </div>
          </div>

          {/* Section C */}
          <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
            <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
              <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION C: SPECIFICATIONS &amp; ASSETS</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Request Type</label>
                <div className="flex flex-wrap gap-2">
                  {requestTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleRequestType(type)}
                      className="px-3.5 py-1.5 text-sm rounded-lg border transition-all"
                      style={{
                        backgroundColor: form.requestType.includes(type) ? '#FF5900' : '#FFFFFF',
                        borderColor: form.requestType.includes(type) ? '#FF5900' : '#D1D5DB',
                        color: form.requestType.includes(type) ? '#FFFFFF' : '#374151',
                        boxShadow: form.requestType.includes(type) ? '0 2px 8px rgba(255,89,0,0.25)' : 'none',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {form.requestType.includes('Other') && (
                  <input
                    type="text"
                    value={form.otherRequestType}
                    onChange={(e) => setForm({ ...form, otherRequestType: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2 mt-2"
                    style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}
                    placeholder="Please specify your request type"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Required Platforms / Sizes</label>
                <input type="text" value={form.platforms} onChange={(e) => setForm({ ...form, platforms: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g., Instagram Story, 1080x1920" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Target Audience / Message</label>
                <textarea value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Who is this for and what should it say?" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Resource Links</label>
                <div className="space-y-2">
                  {form.resourceLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...form.resourceLinks]
                          newLinks[idx] = e.target.value
                          setForm({ ...form, resourceLinks: newLinks })
                        }}
                        className="flex-1 px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2"
                        style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}
                        placeholder="Google Drive links to logos, copy, or mood boards"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, resourceLinks: form.resourceLinks.filter((_, i) => i !== idx) })}
                        className="p-2 rounded-lg transition hover:bg-red-50"
                        style={{ color: '#DC2626' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, resourceLinks: [...form.resourceLinks, ''] })}
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition hover:opacity-80"
                    style={{ color: '#FF5900' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Add Link
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section D */}
          <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
            <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
              <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION D: LOGISTICS</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Date Needed</label>
                  <input type="date" value={form.dateNeeded} onChange={(e) => setForm({ ...form, dateNeeded: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Priority Level</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}>
                    <option value="">Select priority</option>
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Management Approval</label>
                <div className="flex gap-4">
                  {['Yes', 'No', 'Pending'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer group" onClick={() => setForm({ ...form, managementApproval: opt })}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition" style={{ borderColor: form.managementApproval === opt ? '#FF5900' : '#D1D5DB' }}>
                        {form.managementApproval === opt && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF5900' }}></div>}
                      </div>
                      <span className="text-sm" style={{ color: '#374151' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="px-5 py-3 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              {error}
            </div>
          )}

          <div className="text-center pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-10 py-3 rounded-xl text-white text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50 inline-flex items-center gap-2"
              style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 16px rgba(255,89,0,0.3)' }}
            >
              {submitting && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {submitting ? 'Saving...' : isEditMode ? 'Update Request' : 'Submit Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}