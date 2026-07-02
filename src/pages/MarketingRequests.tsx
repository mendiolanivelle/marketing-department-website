import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'

interface SubmittedRequest {
  id?: number
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

  useEffect(() => {
    loadSubmissions()
  }, [])

  const loadSubmissions = async () => {
    setLoading(true)
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('marketing_requests').select('*').order('created_at', { ascending: false })
      if (data) {
        setSubmitted(data.map((r: any) => ({
          ...r,
          requestType: Array.isArray(r.requestType) ? r.requestType : (r.request_type || []),
          resourceLinks: Array.isArray(r.resourceLinks) ? r.resourceLinks : (r.resource_links ? [r.resource_links] : []),
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
      <section className="py-16 sm:py-20 px-4 sm:px-6 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h1 className="text-3xl sm:text-4xl mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Marketing Requests</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Submit your marketing requests and reach out to the team
          </p>
        </div>
      </section>

      {/* Submit a Request Link */}
      <section className="py-12 px-4 sm:px-6 text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl p-8 sm:p-10 border theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl sm:text-2xl mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Submit a Marketing Request</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              Use our structured form to submit your request. Include all necessary details so the marketing team can act quickly.
            </p>
            <a
              href="/#/submit-request"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Open Submission Form
            </a>
          </div>
        </div>
      </section>

      {/* Submitted Requests */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Submitted Requests</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>View all marketing requests submitted through the form</p>
            </div>
            <button
              onClick={loadSubmissions}
              className="p-2 rounded-lg transition hover:opacity-70"
              style={{ color: 'var(--accent)' }}
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
            </div>
          ) : submitted.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <svg className="w-7 h-7" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No requests submitted yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submitted.map((req, index) => (
                <div key={index} className="rounded-2xl overflow-hidden border theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                  <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)' }}>
                          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>
                          <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                            {req.name} · {req.department} · {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: `${priorityColors[req.priority] || '#6B7280'}15`, color: priorityColors[req.priority] || '#6B7280' }}>
                          {req.priority}
                        </span>
                        <button
                          onClick={() => setExpanded(expanded === index ? null : index)}
                          className="p-1.5 rounded-lg transition hover:opacity-70"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <svg className={`w-4 h-4 transition-transform ${expanded === index ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteRequest(index, req)}
                          disabled={deleting === index}
                          className="p-1.5 rounded-lg transition hover:bg-red-50"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {expanded === index && (
                      <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border-primary)' }}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Requester</span>
                            <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{req.name}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Department</span>
                            <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{req.department}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Email</span>
                            <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{req.email}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Date Needed</span>
                            <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{req.dateNeeded}</p>
                          </div>
                        </div>
                        {req.description && (
                          <div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Description</span>
                            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-primary)' }}>{req.description}</p>
                          </div>
                        )}
                        {req.requestType && req.requestType.length > 0 && (
                          <div>
                            <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Request Type</span>
                            <div className="flex flex-wrap gap-1.5">
                              {req.requestType.map((t, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {req.platforms && (
                          <div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Platforms / Sizes</span>
                            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-primary)' }}>{req.platforms}</p>
                          </div>
                        )}
                        {req.audience && (
                          <div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Target Audience</span>
                            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-primary)' }}>{req.audience}</p>
                          </div>
                        )}
                        {req.resourceLinks && req.resourceLinks.length > 0 && (
                          <div>
                            <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Resource Links</span>
                            <div className="space-y-1">
                              {req.resourceLinks.map((link, i) => (
                                <p key={i} className="text-sm truncate" style={{ color: 'var(--accent)' }}>{link}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Management Approval</span>
                          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-primary)' }}>{req.managementApproval}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Reach Out to Us */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 text-center" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
        <div className="max-w-4xl mx-auto">
          <h2 id="contact" className="text-2xl sm:text-4xl mb-4" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>Reach Out to Us</h2>
          <p className="text-sm sm:text-base mb-12 leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--btn-primary-text)', opacity: 0.8, fontWeight: 300 }}>
            Need marketing support? Have a question about brand guidelines? Reach us through the channels below.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-4 p-7 sm:p-9 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 group" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, #EA4335, #FB8861)' }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1.5" style={{ color: '#FFFFFF', fontWeight: 600 }}>Email</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>maxene_pableo@exodiagamedev.com</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 p-7 sm:p-9 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 group" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, #4A154B, #7B2D8E)' }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 15.5C6 17.43 4.93 19 3.5 19S1 17.43 1 15.5 2.07 12 3.5 12 6 13.57 6 15.5M6 8.5C6 10.43 4.93 12 3.5 12S1 10.43 1 8.5 2.07 5 3.5 5 6 6.57 6 8.5M9 12c0 1.93 1.07 3.5 2.5 3.5S14 13.93 14 12s-1.07-3.5-2.5-3.5S9 10.07 9 12m6-3.5c0 1.93 1.07 3.5 2.5 3.5S20 10.43 20 8.5 18.93 5 17.5 5 15 6.57 15 8.5m2.5 6c-1.43 0-2.5 1.57-2.5 3.5s1.07 3.5 2.5 3.5 2.5-1.57 2.5-3.5-1.07-3.5-2.5-3.5z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1.5" style={{ color: '#FFFFFF', fontWeight: 600 }}>Slack</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>#marketing-requests</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 p-7 sm:p-9 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 group" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, #0078D4, #00BCF2)' }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1.5" style={{ color: '#FFFFFF', fontWeight: 600 }}>Office</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>Floor 4, Room 412</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}