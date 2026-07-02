import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const departments = ['HR Department', 'Operations Department', 'Finance Department', 'Sales Department', 'IT Department', 'Facilities Department']
const requestTypes = ['Social Media', 'Event Promo', 'Game Asset', 'Print', 'Video', 'Other']
const priorities = ['Low', 'Standard', 'High', 'Rush']

interface FormData {
  name: string
  department: string
  email: string
  title: string
  campaign: string
  description: string
  requestType: string[]
  platforms: string
  audience: string
  resourceLinks: string
  dateNeeded: string
  priority: string
  managementApproval: string
}

export default function SubmitRequestForm() {
  const [form, setForm] = useState<FormData>({
    name: '',
    department: '',
    email: '',
    title: '',
    campaign: '',
    description: '',
    requestType: [],
    platforms: '',
    audience: '',
    resourceLinks: '',
    dateNeeded: '',
    priority: '',
    managementApproval: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

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

    const payload = {
      ...form,
      requestType: form.requestType,
      created_at: new Date().toISOString(),
    }

    if (isSupabaseConfigured && supabase) {
      const { error: err } = await supabase.from('marketing_requests').insert([payload])
      if (err) {
        setError('Failed to submit. Please try again.')
        setSubmitting(false)
        return
      }
    } else {
      const existing = localStorage.getItem('exodia-marketing-requests')
      const requests = existing ? JSON.parse(existing) : []
      requests.push(payload)
      localStorage.setItem('exodia-marketing-requests', JSON.stringify(requests))
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1B1A1C' }}>
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg, rgba(255,89,0,0.2), rgba(255,140,51,0.1))' }}>
            <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl mb-3" style={{ color: '#FFFFFF', fontWeight: 700 }}>Request Submitted</h1>
          <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300, lineHeight: 1.6 }}>
            Your marketing request has been received. The team will review it and get back to you.
          </p>
          <a
            href="/#/submit-request"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5"
            style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}
          >
            Submit Another Request
          </a>
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
            <h1 className="text-2xl sm:text-3xl mb-3" style={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}>Marketing Request Form</h1>
            <p className="text-sm sm:text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>
              Fill out the details below and our marketing team will get back to you shortly.
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
                <input type="text" value={form.resourceLinks} onChange={(e) => setForm({ ...form, resourceLinks: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Google Drive links to logos, copy, or mood boards" />
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
                    <label key={opt} className="flex items-center gap-2 cursor-pointer group">
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
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}