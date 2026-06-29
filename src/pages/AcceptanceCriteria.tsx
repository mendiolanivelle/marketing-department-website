import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface Submission {
  id: string
  client_name: string
  project_name: string
  contact: string
  email: string
  project_type: string
  target_platform: string[]
  timezone: string
  start_date: string
  deadline: string
  budget: string
  doc_link: string
  deliverables: any[]
  reviewer: string[]
  review_rounds: string
  review_time: string
  approval_basis: string[]
  comms_tool: string[]
  weekly_meeting: string[]
  meeting_time: string
  daily_sync: string[]
  sync_time: string
  training: string[]
  game_engine: string[]
  tech_requirements: string
  tools_software: string
  performance_constraints: string
  signature: string
  signature_date: string
  created_at: string
}

export default function AcceptanceCriteria() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)

  const fetchSubmissions = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('acceptance_forms')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSubmissions(data || [])
    } catch (err) {
      console.error('Error fetching submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubmissions()
    if (!isSupabaseConfigured || !supabase) return

    // Realtime subscription for new submissions
    const channel = supabase
      .channel('acceptance_forms_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'acceptance_forms' }, () => {
        fetchSubmissions()
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Acceptance Criteria Forms</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            View all client-submitted acceptance criteria forms. New submissions appear in real time.
          </p>
        </div>
        <a
          href="/#/acceptance-form"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-white rounded-lg transition flex-shrink-0 hover:-translate-y-0.5"
          style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Public Form
        </a>
      </div>

      {/* Stats row */}
      {!loading && submissions.length > 0 && (
        <div className="flex gap-3 sm:gap-4 mb-4 flex-wrap">
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</span>
            <span className="ml-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{submissions.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending</span>
            <span className="ml-2 text-sm font-bold" style={{ color: '#EA580C' }}>{submissions.filter(s => s.project_type === 'Pending').length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Project Base</span>
            <span className="ml-2 text-sm font-bold" style={{ color: 'var(--accent)' }}>{submissions.filter(s => s.project_type === 'Project Base').length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Staff Aug</span>
            <span className="ml-2 text-sm font-bold" style={{ color: '#2563EB' }}>{submissions.filter(s => s.project_type === 'Staff Augmentation').length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No submissions yet. Share the public form link to start receiving entries.</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Public link: /acceptance-form</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Project</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Client</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Contact</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Platform</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Budget</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Submitted</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    className="cursor-pointer transition hover:opacity-80"
                    style={{ borderTop: '1px solid var(--border-secondary)' }}
                  >
                    <td className="p-3">
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sub.project_name || 'Untitled'}</span>
                    </td>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{sub.client_name || '—'}</td>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>
                      {sub.contact || '—'}
                      {sub.email && <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{sub.email}</span>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md text-xs" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>
                        {sub.project_type || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {(sub.target_platform || []).length > 0
                          ? (sub.target_platform as string[]).slice(0, 2).map((p: string, i: number) => (
                              <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{p}</span>
                            ))
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </div>
                    </td>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{sub.budget || '—'}</td>
                    <td className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-3">
                      <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }} onClick={() => setSelectedSubmission(null)} />
          <div className="relative rounded-2xl border max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedSubmission.project_name || 'Untitled Project'}</h2>
              <button onClick={() => setSelectedSubmission(null)} className="p-1 rounded-lg transition" style={{ color: 'var(--accent)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Client</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.client_name}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Contact</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.contact} &middot; {selectedSubmission.email}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Project Type</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.project_type}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Platform</p>
                  <p style={{ color: 'var(--text-primary)' }}>{(selectedSubmission.target_platform || []).join(', ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Budget</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.budget || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Submitted</p>
                  <p style={{ color: 'var(--text-primary)' }}>{new Date(selectedSubmission.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Timezone</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.timezone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Timeline</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.start_date || '?'} → {selectedSubmission.deadline || '?'}</p>
                </div>
              </div>

              {selectedSubmission.deliverables && selectedSubmission.deliverables.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Deliverables ({selectedSubmission.deliverables.length})</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <th className="p-2 border text-left" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-muted)' }}>Name</th>
                          <th className="p-2 border text-left" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-muted)' }}>Description</th>
                          <th className="p-2 border text-left" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-muted)' }}>Criteria</th>
                          <th className="p-2 border text-left" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-muted)' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSubmission.deliverables.map((d: any, i: number) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border-secondary)' }}>
                            <td className="p-2" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.name || '—'}</td>
                            <td className="p-2" style={{ color: 'var(--text-secondary)' }}>{d.description || '—'}</td>
                            <td className="p-2" style={{ color: 'var(--text-secondary)' }}>{d.criteria || '—'}</td>
                            <td className="p-2" style={{ color: 'var(--text-secondary)' }}>{d.quantity || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--border-secondary)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Signed by</p>
                <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.signature || 'N/A'} {selectedSubmission.signature_date && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>on {selectedSubmission.signature_date}</span>}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}