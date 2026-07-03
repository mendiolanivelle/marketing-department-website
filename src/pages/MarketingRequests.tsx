import { useState, useEffect } from 'react'
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
  const [viewingRequest, setViewingRequest] = useState<SubmittedRequest | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)

  const filtered = filterPriority ? submitted.filter(r => r.priority === filterPriority) : submitted

  useEffect(() => {
    loadSubmissions()

    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel('marketing-requests-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'marketing_requests' },
          () => { loadSubmissions() }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } else {
      const handleStorage = () => loadSubmissions()
      window.addEventListener('marketing-request-updated', handleStorage)

      return () => {
        window.removeEventListener('marketing-request-updated', handleStorage)
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
    let deletedFromSupabase = false
    try {
      if (isSupabaseConfigured && supabase) {
        if (req.id) {
          const { error } = await supabase.from('marketing_requests').delete().eq('id', req.id)
          if (error) throw new Error(error.message)
          deletedFromSupabase = true
        } else if (req.editToken) {
          const { error } = await supabase.from('marketing_requests').delete().eq('edit_token', req.editToken)
          if (error) throw new Error(error.message)
          deletedFromSupabase = true
        }
      }
      if (!deletedFromSupabase) {
        const existing = localStorage.getItem('exodia-marketing-requests')
        if (existing) {
          const requests = JSON.parse(existing)
          const idx = requests.findIndex((r: any) => r.editToken === req.editToken)
          if (idx !== -1) requests.splice(idx, 1)
          localStorage.setItem('exodia-marketing-requests', JSON.stringify(requests))
        }
      }
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleting(null)
      return
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
              <a
                href="/#/submit-request"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--accent)', boxShadow: '0 4px 12px rgba(255,89,0,0.25)', color: '#FFFFFF' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Open Submission Form
              </a>
            </div>

            {/* Stats badges */}
            {!loading && submitted.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-5">
                {[
                  { label: 'Total', key: null, color: 'var(--text-primary)', bg: '#F3F4F6', activeBg: '#6B7280', count: submitted.length },
                  { label: 'Rush', key: 'Rush', color: '#DC2626', bg: '#FEF2F2', activeBg: '#DC2626', count: submitted.filter(r => r.priority === 'Rush').length },
                  { label: 'High', key: 'High', color: '#FF5900', bg: '#FFF7ED', activeBg: '#FF5900', count: submitted.filter(r => r.priority === 'High').length },
                  { label: 'Standard', key: 'Standard', color: '#2563EB', bg: '#EFF6FF', activeBg: '#2563EB', count: submitted.filter(r => r.priority === 'Standard').length },
                  { label: 'Low', key: 'Low', color: '#16A34A', bg: '#F0FDF4', activeBg: '#16A34A', count: submitted.filter(r => r.priority === 'Low').length },
                ].map((badge) => {
                  const isActive = badge.key === null ? filterPriority === null : filterPriority === badge.key
                  return (
                    <button
                      key={badge.label}
                      onClick={() => setFilterPriority(badge.key === null ? null : filterPriority === badge.key ? null : badge.key)}
                      className="px-4 py-2 rounded-xl text-center transition hover:-translate-y-0.5"
                      style={{
                        backgroundColor: isActive ? badge.activeBg : badge.bg,
                        border: isActive ? '2px solid ' + badge.activeBg : '2px solid transparent',
                        color: isActive ? '#FFFFFF' : badge.color,
                        minWidth: '90px',
                      }}
                    >
                      <div className="text-lg font-bold leading-none mb-0.5">{badge.count}</div>
                      <div className="text-[10px] font-medium" style={{ opacity: 0.85 }}>{badge.label}</div>
                    </button>
                  )
                })}
              </div>
            )}
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
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{filtered.length} request{filtered.length !== 1 ? 's' : ''}{filterPriority ? ` (${filterPriority})` : ''}</p>
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
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <svg className="w-6 h-6" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No requests submitted yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Title</th>
                      <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tracking ID</th>
                      <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Requester</th>
                      <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Department</th>
                      <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Priority</th>
                      <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Date Needed</th>
                      <th className="p-3 w-10"></th>
                      <th className="p-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((req, index) => (
                      <tr
                        key={index}
                        onClick={() => setViewingRequest(req)}
                        className="cursor-pointer transition hover:opacity-80"
                        style={{ borderTop: '2px solid var(--border-secondary)' }}
                      >
                        <td className="p-3">
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{req.title}</span>
                        </td>
                        <td className="p-3">
                          {req.tracking_id ? (
                            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{req.tracking_id}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{req.name}</td>
                        <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{req.department}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${priorityColors[req.priority] || '#6B7280'}15`, color: priorityColors[req.priority] || '#6B7280' }}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>{req.dateNeeded || '—'}</td>
                        <td className="p-3">
                          <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const idx = submitted.findIndex(r => r === req)
                              if (idx !== -1) deleteRequest(idx, req)
                            }}
                            disabled={deleting !== null}
                            className="p-1.5 rounded-lg transition hover:opacity-70"
                            style={{ color: '#FF5900' }}
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF-style document modal */}
      {viewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setViewingRequest(null)}>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none shadow-2xl" style={{ backgroundColor: '#FFFFFF' }} onClick={(e) => e.stopPropagation()}>
            {/* Document header bar */}
            <div className="flex items-center justify-between px-8 py-4 border-b" style={{ backgroundColor: '#1B1A1C', borderColor: '#2D2B2E' }}>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Marketing Request Document</span>
              </div>
              <button onClick={() => setViewingRequest(null)} className="p-1.5 rounded-lg transition hover:opacity-70" style={{ color: '#9CA3AF' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Document body */}
            <div className="px-10 py-8">
              {/* Title + Tracking */}
              <div className="text-center mb-8 pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B1A1C' }}>{viewingRequest.title}</h2>
                {viewingRequest.tracking_id && (
                  <span className="text-sm font-mono" style={{ color: '#FF5900' }}>{viewingRequest.tracking_id}</span>
                )}
              </div>

              {/* Two-column info */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Requester</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingRequest.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Department</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingRequest.department}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Email</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingRequest.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Date Needed</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingRequest.dateNeeded}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Priority</p>
                  <p className="text-sm font-semibold" style={{ color: priorityColors[viewingRequest.priority] || '#6B7280' }}>{viewingRequest.priority}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Management Approval</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingRequest.managementApproval}</p>
                </div>
              </div>

              {/* Description */}
              {viewingRequest.description && (
                <div className="mb-8">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Description</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#1B1A1C', lineHeight: 1.7 }}>{viewingRequest.description}</p>
                </div>
              )}

              {/* Request Type */}
              {viewingRequest.requestType && viewingRequest.requestType.length > 0 && (
                <div className="mb-8">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Request Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingRequest.requestType.map((t, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-md font-medium" style={{ backgroundColor: '#FFF7ED', color: '#FF5900' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Platforms */}
              {viewingRequest.platforms && (
                <div className="mb-8">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Platforms / Sizes</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingRequest.platforms}</p>
                </div>
              )}

              {/* Target Audience */}
              {viewingRequest.audience && (
                <div className="mb-8">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Target Audience</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingRequest.audience}</p>
                </div>
              )}

              {/* Resource Links */}
              {viewingRequest.resourceLinks && viewingRequest.resourceLinks.length > 0 && viewingRequest.resourceLinks.some(l => l.trim()) && (
                <div className="mb-8">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Resource Links</p>
                  <ul className="space-y-1">
                    {viewingRequest.resourceLinks.filter(l => l.trim()).map((link, i) => (
                      <li key={i} className="text-sm" style={{ color: '#FF5900' }}>{link}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer */}
              <div className="pt-6 border-t text-center" style={{ borderColor: '#E5E7EB' }}>
                <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Exodia Game Development &middot; Marketing Department</p>
              </div>
            </div>

            {/* Document actions */}
            <div className="flex items-center justify-between px-8 py-4 border-t" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
              <button
                onClick={() => {
                  const idx = submitted.findIndex(r => r === viewingRequest)
                  if (idx !== -1) deleteRequest(idx, viewingRequest)
                  setViewingRequest(null)
                }}
                disabled={deleting !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition hover:bg-red-50"
                style={{ color: '#DC2626' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
              <button onClick={() => setViewingRequest(null)} className="px-4 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: '#1B1A1C', color: '#FFFFFF' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  )
}