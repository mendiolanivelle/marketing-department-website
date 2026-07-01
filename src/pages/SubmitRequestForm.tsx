import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const departments = ['HR', 'Dev', 'Sales', 'Finance', 'Marketing', 'Operations', 'QA', 'Design', 'Executive']
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--accent-light)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Request Submitted</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Your marketing request has been received. The team will review it and get back to you.
          </p>
          <a
            href="/#/requests"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Back to Marketing Requests
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #FAFAFA 0%, #FFF5F0 100%)', minHeight: '100vh' }}>
      <div className="py-10 px-4 text-center" style={{ background: 'linear-gradient(135deg, #1B1A1C 0%, #2D2B2E 100%)', borderBottom: '3px solid #FF5900' }}>
        <div className="max-w-4xl mx-auto">
          <div className="w-16 h-16 rounded-[16px] flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl mb-2" style={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}>Marketing Request Form</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,89,0,0.15)' }}>
            <span className="text-xs" style={{ color: '#FF8C42', fontWeight: 600 }}>Exodia Game Development &middot; Marketing Department</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pb-12 space-y-8">
        {/* Section A */}
        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="p-4 border-b" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Section A: Requester Information</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Name of Requester</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Department</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}>
                <option value="">Select department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Email / Internal Chat Handle</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="email@company.com or @slackhandle" />
            </div>
          </div>
        </div>

        {/* Section B */}
        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="p-4 border-b" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Section B: Project Overview</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Request Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g., Q3 Hiring Campaign Banner" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Campaign / Project it belongs to</label>
              <input type="text" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Campaign or project name" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Description / Objective</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="What is the goal of this request?" />
            </div>
          </div>
        </div>

        {/* Section C */}
        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="p-4 border-b" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Section C: Specifications &amp; Assets</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Request Type</label>
              <div className="flex flex-wrap gap-2">
                {requestTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleRequestType(type)}
                    className="px-3 py-1.5 text-sm rounded-lg border transition"
                    style={{
                      backgroundColor: form.requestType.includes(type) ? '#FF5900' : '#F3F4F6',
                      borderColor: form.requestType.includes(type) ? '#FF5900' : '#D1D5DB',
                      color: form.requestType.includes(type) ? '#FFFFFF' : '#374151',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Required Platforms / Sizes</label>
              <input type="text" value={form.platforms} onChange={(e) => setForm({ ...form, platforms: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g., Instagram Story, 1080x1920" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Target Audience / Message</label>
              <textarea value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Who is this for and what should it say?" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Resource Links</label>
              <input type="text" value={form.resourceLinks} onChange={(e) => setForm({ ...form, resourceLinks: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Google Drive links to logos, copy, or mood boards" />
            </div>
          </div>
        </div>

        {/* Section D */}
        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="p-4 border-b" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Section D: Logistics</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Date Needed</label>
              <input type="date" value={form.dateNeeded} onChange={(e) => setForm({ ...form, dateNeeded: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Priority Level</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} required className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}>
                <option value="">Select priority</option>
                {priorities.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Management Approval</label>
              <div className="flex gap-4">
                {['Yes', 'No', 'Pending'].map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="managementApproval"
                      value={opt}
                      checked={form.managementApproval === opt}
                      onChange={(e) => setForm({ ...form, managementApproval: e.target.value })}
                    />
                    <span className="text-sm" style={{ color: '#374151' }}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            {error}
          </div>
        )}

        <div className="text-center">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5 disabled:opacity-50"
            style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  )
}