import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import Turnstile from '../components/Turnstile'

const departments = ['HR Department', 'Operations Department', 'Finance Department', 'Sales Department', 'IT Department', 'Facilities Department']
const requestTypes = ['Social Media', 'Print', 'Video', 'Photo', 'Other']
const priorities = ['Low', 'Standard', 'High', 'Rush']

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

interface LoadedMarketingRequest {
  tracking_id: string | null
  name: string
  department: string
  email: string
  title: string
  campaign: string | null
  description: string | null
  request_type: string[]
  platforms: string | null
  audience: string | null
  resource_links: string | null
  date_needed: string
  priority: string
  management_approval: string
}

interface MarketingRequestResponse {
  request?: LoadedMarketingRequest
  editToken?: string
  trackingId?: string
}

const emptyForm: FormData = {
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
}

export default function SubmitRequestForm() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const isEditMode = !!token

  const [form, setForm] = useState<FormData>(emptyForm)
  const [editToken, setEditToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(isEditMode)
  const [trackingId, setTrackingId] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const submissionKeyRef = useRef(crypto.randomUUID())
  const successHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (submitted) successHeadingRef.current?.focus()
  }, [submitted])

  useEffect(() => {
    if (token) {
      const loadFromSupabase = async () => {
        if (!isSupabaseConfigured || !supabase) {
          setError('The secure request service is unavailable. Please try again later.')
          setLoading(false)
          return
        }
        try {
          const { data: response, error: loadError } = await supabase.functions.invoke<MarketingRequestResponse>(
            'public-marketing-request',
            { body: { action: 'load', editToken: token } },
          )
          if (loadError) {
            if (loadError.context instanceof Response && loadError.context.status === 404) {
              setError('Request not found. The edit link may be invalid.')
              return
            }
            throw loadError
          }
          const data = response?.request
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
            setTrackingId(data.tracking_id || '')
            return
          }
          setError('Request not found. The edit link may be invalid.')
        } catch {
          setError('The request could not be loaded securely. Please try again.')
        } finally {
          setLoading(false)
        }
      }
      loadFromSupabase()
    } else {
      setLoading(false)
    }
  }, [token])

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
    if (isEditMode && !editToken) {
      setError('This request cannot be edited because the secure edit link was not validated.')
      setSubmitting(false)
      return
    }
    if (!isEditMode && !turnstileToken) {
      setError('Complete the submission verification before sending this request.')
      setSubmitting(false)
      return
    }

    const finalRequestTypes = [...form.requestType]
    if (form.otherRequestType.trim()) finalRequestTypes.push(`Other: ${form.otherRequestType.trim()}`)

    const requestPayload = {
      name: form.name,
      department: form.department,
      email: form.email,
      title: form.title,
      campaign: form.campaign || null,
      description: form.description || null,
      request_type: finalRequestTypes,
      platforms: form.platforms || null,
      audience: form.audience || null,
      resource_links: form.resourceLinks.filter(link => link.trim()),
      date_needed: form.dateNeeded,
      priority: form.priority,
      management_approval: form.managementApproval || 'Pending',
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('The secure request service is unavailable. Your entries remain on this page.')
      setSubmitting(false)
      return
    }

    let savedEditToken: string
    let savedTrackingId: string
    try {
      const body = editToken
        ? { action: 'update', editToken, request: requestPayload }
        : {
            action: 'create',
            request: requestPayload,
            submissionKey: submissionKeyRef.current,
            turnstileToken,
          }
      const { data: response, error: saveError } = await supabase.functions.invoke<MarketingRequestResponse>(
        'public-marketing-request',
        { body },
      )
      if (saveError) {
        if (saveError.context instanceof Response && saveError.context.status === 404) {
          setError('Request not found. The edit link may be invalid.')
          setSubmitting(false)
          return
        }
        throw saveError
      }
      savedEditToken = editToken || response?.editToken || ''
      savedTrackingId = response?.trackingId || ''
      if (!savedEditToken || !savedTrackingId) throw new Error('Request save was not confirmed')
    } catch {
      setError(`Failed to ${editToken ? 'update' : 'submit'} the request securely. Please try again.`)
      if (!editToken) {
        setTurnstileToken('')
        setTurnstileResetKey(current => current + 1)
      }
      setSubmitting(false)
      return
    }

    setEditToken(savedEditToken)
    setTrackingId(savedTrackingId)
    setSubmitting(false)
    setSubmitted(true)
    window.dispatchEvent(new CustomEvent('marketing-request-updated'))

    if (form.email && isSupabaseConfigured && supabase) {
      try {
        const { error: emailError } = await supabase.functions.invoke('send-edit-link', {
          body: { editToken: savedEditToken },
        })
        if (emailError) throw emailError
        setEmailSent(true)
      } catch {}
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1B1A1C' }}>
        <div role="status" aria-live="polite">
          <div aria-hidden="true" className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#FF5900' }}></div>
          <span className="sr-only">Loading request</span>
        </div>
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
          <h1 ref={successHeadingRef} tabIndex={-1} className="text-2xl mb-3" style={{ color: '#FFFFFF', fontWeight: 700 }}>{isEditMode ? 'Request Updated' : 'Request Submitted'}</h1>
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
            <label htmlFor="request-edit-link" className="block text-xs mb-1" style={{ color: '#1B1A1C', fontWeight: 500 }}>EDIT LINK — SAVE THIS TO EDIT LATER</label>
            <div className="flex items-center gap-2">
              <input id="request-edit-link" readOnly value={editUrl} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-transparent outline-none focus:ring-2" style={{ color: '#1B1A1C', border: '1px solid #D1D5DB' }} />
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
              setForm(emptyForm)
              setEditToken('')
              setSubmitted(false)
              setError('')
              setEmailSent(false)
              setTrackingId('')
              submissionKeyRef.current = crypto.randomUUID()
              setTurnstileToken('')
              setTurnstileResetKey(current => current + 1)
              if (isEditMode) navigate('/submit-request', { replace: true })
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

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pb-16 space-y-6">
      {/* Section A: Requester Information */}
      <div className="mt-6 mb-6">
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION A: REQUESTER INFORMATION</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="requester-name" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Name of Requester</label>
                <input id="requester-name" type="text" maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Your full name" />
              </div>
              <div>
                <label htmlFor="requester-department" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Department</label>
                <select id="requester-department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="requester-email" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Email</label>
              <input id="requester-email" type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="you@example.com" />
            </div>
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
                  <label htmlFor="request-title" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Request Title</label>
                  <input id="request-title" type="text" maxLength={300} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g., Q3 Campaign Banner" />
                </div>
                <div>
                  <label htmlFor="request-campaign" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Campaign / Project</label>
                  <input id="request-campaign" type="text" maxLength={300} value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Campaign or project name" />
                </div>
              </div>
              <div>
                <label htmlFor="request-description" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Description / Objective</label>
                <textarea id="request-description" maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="What is the goal of this request?" />
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
              <fieldset className="min-w-0">
                <legend className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Request Type</legend>
                <div className="flex flex-wrap gap-2">
                  {requestTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={form.requestType.includes(type)}
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
                    aria-label="Other request type"
                    type="text"
                    maxLength={93}
                    value={form.otherRequestType}
                    onChange={(e) => setForm({ ...form, otherRequestType: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2 mt-2"
                    style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}
                    placeholder="Please specify your request type"
                  />
                )}
              </fieldset>
              <div>
                <label htmlFor="request-platforms" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Required Platforms / Sizes</label>
                <input id="request-platforms" type="text" maxLength={1000} value={form.platforms} onChange={(e) => setForm({ ...form, platforms: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g., Instagram Story, 1080x1920" />
              </div>
              <div>
                <label htmlFor="request-audience" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Target Audience / Message</label>
                <textarea id="request-audience" maxLength={3000} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Who is this for and what should it say?" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Resource Links</label>
                <div className="space-y-2">
                  {form.resourceLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        aria-label={`Resource link ${idx + 1}`}
                        type="url"
                        maxLength={2048}
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
                        aria-label={`Remove resource link ${idx + 1}`}
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
                    disabled={form.resourceLinks.length >= 10}
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <label htmlFor="request-date" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Date Needed</label>
                  <input id="request-date" type="date" value={form.dateNeeded} onChange={(e) => setForm({ ...form, dateNeeded: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
                </div>
                <div>
                  <label htmlFor="request-priority" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Priority Level</label>
                  <select id="request-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}>
                    <option value="">Select priority</option>
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <fieldset className="min-w-0">
                <legend className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Management Approval</legend>
                <div className="flex gap-4">
                  {['Yes', 'No', 'Pending'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="management-approval"
                        value={opt}
                        checked={form.managementApproval === opt}
                        onChange={() => setForm({ ...form, managementApproval: opt })}
                        className="sr-only peer"
                      />
                      <div aria-hidden="true" className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF5900] peer-focus-visible:ring-offset-2" style={{ borderColor: form.managementApproval === opt ? '#FF5900' : '#D1D5DB' }}>
                        {form.managementApproval === opt && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF5900' }}></div>}
                      </div>
                      <span className="text-sm" style={{ color: '#374151' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {!isEditMode && (
            <div className="flex justify-center">
              <Turnstile
                action="marketing_request"
                onToken={setTurnstileToken}
                resetKey={turnstileResetKey}
              />
            </div>
          )}

          {error && (
            <div role="alert" className="px-5 py-3 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              {error}
            </div>
          )}

          <div className="text-center pt-2">
            <button
              type="submit"
              disabled={submitting || (!isEditMode && !turnstileToken)}
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
      </form>
    </div>
  )
}
