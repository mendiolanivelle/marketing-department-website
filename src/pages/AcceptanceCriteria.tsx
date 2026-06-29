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
  budget: string
  deliverables: any[]
  signature: string
  created_at: string
}

export default function AcceptanceCriteria() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)

  useEffect(() => {
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
    fetchSubmissions()
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Acceptance Criteria Forms</h1>
        <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
          View all client-submitted acceptance criteria forms from the public form link.
        </p>
      </div>

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
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              onClick={() => setSelectedSubmission(sub)}
              className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-md theme-transition"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base mb-1" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sub.project_name || 'Untitled'}</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                      {sub.client_name} &middot; {sub.contact}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                      {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2.5 py-0.5 rounded-md text-xs" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>
                      {sub.project_type || 'N/A'}
                    </span>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
              </div>
              {selectedSubmission.deliverables && selectedSubmission.deliverables.length > 0 && (
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Deliverables ({selectedSubmission.deliverables.length})</p>
                  <div className="space-y-2">
                    {selectedSubmission.deliverables.map((d: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.name || 'Unnamed'}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{d.description}</p>
                        {d.criteria && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Criteria: {d.criteria}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Signed by</p>
                <p style={{ color: 'var(--text-primary)' }}>{selectedSubmission.signature}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}