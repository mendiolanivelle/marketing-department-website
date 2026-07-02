import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'

interface SubmittedRequest {
  id?: number
  tracking_id?: string
  name: string
  department: string
  email: string
  title: string
  campaign?: string
  description?: string
  requestType: string[]
  platforms?: string
  audience?: string
  resourceLinks?: string[]
  dateNeeded: string
  priority: string
  managementApproval: string
  created_at: string
  editToken?: string
}

export default function MarketingRequests() {
  const [submitted, setSubmitted] = useState<SubmittedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    loadSubmissions()

    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel('marketing-requests-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'marketing_requests' },
          () => { loadSubmissions() }
        )
        .subscribe()

      pollRef.current = setInterval(loadSubmissions, 30000)

      return () => {
        supabase.removeChannel(channel)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } else {
      const handleStorage = () => loadSubmissions()
      window.addEventListener('marketing-request-updated', handleStorage)
      pollRef.current = setInterval(loadSubmissions, 10000)

      return () => {
        window.removeEventListener('marketing-request-updated', handleStorage)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }
  }, [])

  const loadSubmissions = async () => {
    setLoading(true)
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('marketing_requests').select('*').order('created_at', { ascending: false })
      if (data) {
        setSubmitted(data.map((r: any) => ({
          id: r.id,
          tracking_id: r.tracking_id,
          name: r.name,
          department: r.department,
          email: r.email,
          title: r.title,
          campaign: r.campaign,
          description: r.description,
          requestType: Array.isArray(r.request_type) ? r.request_type : (r.request_type ? [r.request_type] : []),
          platforms: r.platforms,
          audience: r.audience,
          resourceLinks: r.resource_links ? r.resource_links.split(', ').filter(Boolean) : [],
          dateNeeded: r.date_needed,
          priority: r.priority,
          managementApproval: r.management_approval,
          created_at: r.created_at,
          editToken: r.edit_token,
        })))
      }
    } else {
      const existing = localStorage.getItem('exodia-marketing-requests')
      if (existing) setSubmitted(JSON.parse(existing).reverse())
    }
    setLoading(false)
  }

  const deleteRequest = async (index: number, req: SubmittedRequest) => {
    setDeleting(index)
    if (isSupabaseConfigured && supabase && req.id) {
      await supabase.from('marketing_requests').delete().eq('id', req.id)
    } else {
      const existing = localStorage.getItem('exodia-marketing-requests')
      if (existing) {
        const requests = JSON.parse(existing)
        const idx = requests.findIndex((r: any) => r.editToken === req.editToken)
        if (idx !== -1) requests.splice(idx, 1)
        localStorage.setItem('exodia-marketing-requests', JSON.stringify(requests))
      }
    }
    setSubmitted(prev => prev.filter((_, i) => i !== index))
    setDeleting(null)
    logActivity('MarketingRequests', `Deleted request "${req.title}"`)
    loadSubmissions()
  }

  const priorityColors: Record<string, string> = {
    Low: '#0B8043',
    Standard: '#2563EB',
    High: '#FF5900',
    Rush: '#DC2626',
  }

  return (
    <div>
      {/* Header */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Marketing Requests</h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Submit requests, track submissions, and reach out to the team</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit a Request */}
        <div className="max-w-lg mx-auto mb-6 sm:mb-8">
          <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
          <div className="p-6 sm:p-8 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-7 h-7" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Submit a Marketing Request</h2>
            <p className="text-sm mb-6 max-w-lg mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              Use our structured form to submit your request. Include all necessary details so the marketing team can act quickly.
            </p>
            <a
              href="/#/submit-request"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--accent)', boxShadow: '0 4px 12px rgba(255,89,0,0.25)', color: '#FFFFFF' }}
            >
              <svg className="w-4 h-4" style={{ color: '#FFFFFF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Open Submission Form
            </a>
          </div>
        </div>
      </div>

        {/* Submitted Requests */}
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Submitted Requests</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{submitted.length} request{submitted.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={loadSubmissions} className="p-2 rounded-lg transition hover:opacity-70 flex-shrink-0" style={{ color: 'var(--accent)' }} title="Refresh">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: 'var(--accent)' }}></div></div>
            ) : submitted.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <svg className="w-6 h-6" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No requests submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submitted.map((req, index) => (
                  <div key={index} className="rounded-xl border theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <div
                      className="p-4 cursor-pointer transition hover:opacity-80"
                      onClick={() => setExpanded(expanded === index ? null : index)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)' }}>
                            <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{req.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                              {req.tracking_id && <span style={{ color: 'var(--accent)' }}>{req.tracking_id} · </span>}{req.name} · {req.department} · {new Date(req.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${priorityColors[req.priority] || '#6B7280'}15`, color: priorityColors[req.priority] || '#6B7280' }}>
                            {req.priority}
                          </span>
                          <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded === index ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {expanded === index && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                        <div className="pt-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            {[
                              { label: 'Tracking ID', value: req.tracking_id || '—' },
                              { label: 'Requester', value: req.name },
                              { label: 'Department', value: req.department },
                              { label: 'Email', value: req.email },
                              { label: 'Tracking ID', value: req.tracking_id || '—' },
                              { label: 'Date Needed', value: req.dateNeeded },
                              { label: 'Management Approval', value: req.managementApproval },
                            ].map((item, i) => (
                              <div key={i}>
                                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                <p className="mt-0.5 text-sm" style={{ color: 'var(--text-primary)' }}>{item.value || '—'}</p>
                              </div>
                            ))}
                          </div>
                          {req.description && (
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Description</span>
                              <p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{req.description}</p>
                            </div>
                          )}
                          {req.requestType && req.requestType.length > 0 && (
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Request Type</span>
                              <div className="flex flex-wrap gap-1.5">
                                {req.requestType.map((t, i) => (
                                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {req.platforms && (
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Platforms / Sizes</span>
                              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-primary)' }}>{req.platforms}</p>
                            </div>
                          )}
                          {req.audience && (
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Target Audience</span>
                              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-primary)' }}>{req.audience}</p>
                            </div>
                          )}
                          {req.resourceLinks && req.resourceLinks.length > 0 && req.resourceLinks.some(l => l.trim()) && (
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Resource Links</span>
                              <div className="space-y-1">
                                {req.resourceLinks.filter(l => l.trim()).map((link, i) => (
                                  <p key={i} className="text-sm truncate" style={{ color: 'var(--accent)' }}>{link}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-end pt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteRequest(index, req) }}
                              disabled={deleting === index}
                              className="p-1.5 rounded-lg transition hover:bg-red-50 hover:text-red-600"
                              style={{ color: 'var(--text-muted)' }}
                              title="Delete request"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      </div>
  )
}