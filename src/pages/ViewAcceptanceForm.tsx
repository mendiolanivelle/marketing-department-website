import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function ViewAcceptanceForm() {
  const { id } = useParams<{ id: string }>()
  const [sub, setSub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !id) return
    ;(async () => {
      try {
        const { data, error: err } = await supabase
          .from('acceptance_forms')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (err) throw err
        if (!data) { setError('Form not found'); return }
        setSub(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load form')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FAFAFA 0%, #FFF5F0 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-solid" style={{ borderColor: '#E5E7EB', borderTopColor: '#FF5900' }} />
          <span className="text-xs" style={{ color: '#9CA3AF', fontWeight: 400 }}>Loading acceptance criteria...</span>
        </div>
      </div>
    )
  }

  if (error || !sub) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #FAFAFA 0%, #FFF5F0 100%)' }}>
        <div className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-6" style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFE4D0)' }}>
          <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl mb-2" style={{ color: '#1B1A1C', fontWeight: 700 }}>Form Not Found</h1>
        <p className="text-sm mb-6 px-6 text-center" style={{ color: '#6B7280', fontWeight: 400 }}>
          The acceptance criteria form you're looking for doesn't exist or may have been removed. Please check the link or contact the Marketing Department.
        </p>
        <Link to="/" className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}>
          Go to Home
        </Link>
      </div>
    )
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex border-b py-2.5" style={{ borderColor: '#F3F4F6' }}>
      <span className="w-56 text-sm flex-shrink-0" style={{ color: '#6B7280' }}>{label}</span>
      <span className="text-sm" style={{ color: '#1B1A1C' }}>{value || '—'}</span>
    </div>
  )

  const MultiRow = ({ label, items }: { label: string; items: string[] | any }) => (
    <div className="flex border-b py-2.5" style={{ borderColor: '#F3F4F6' }}>
      <span className="w-56 text-sm flex-shrink-0" style={{ color: '#6B7280' }}>{label}</span>
      <span className="text-sm" style={{ color: '#1B1A1C' }}>{(items || []).join(', ') || '—'}</span>
    </div>
  )

  return (
    <div style={{ background: 'linear-gradient(180deg, #FAFAFA 0%, #FFF5F0 100%)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="py-10 px-4 text-center" style={{ background: 'linear-gradient(135deg, #1B1A1C 0%, #2D2B2E 100%)', borderBottom: '3px solid #FF5900' }}>
        <div className="max-w-4xl mx-auto">
          <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #FF5900, #FF8C42)', boxShadow: '0 6px 20px rgba(255,89,0,0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 1800.000000 1800.000000" preserveAspectRatio="xMidYMid meet">
              <g transform="translate(0.000000,1800.000000) scale(0.100000,-0.100000)" fill="#FFFFFF" stroke="none">
                <path d="M5620 14369 c-30 -16 -68 -38 -85 -49 -16 -11 -52 -31 -80 -45 -27 -14 -63 -35 -80 -45 -36 -22 -144 -84 -165 -93 -8 -4 -28 -16 -45 -27 -16 -11 -39 -24 -50 -30 -11 -6 -42 -24 -70 -41 -27 -16 -63 -37 -80 -45 -16 -8 -37 -19 -45 -24 -25 -17 -214 -126 -230 -133 -8 -4 -28 -16 -45 -27 -16 -11 -43 -26 -60 -35 -16 -8 -52 -28 -80 -45 -27 -16 -59 -34 -70 -40 -11 -5 -27 -14 -35 -20 -8 -5 -51 -30 -95 -55 -44 -26 -87 -51 -95 -56 -8 -5 -24 -14 -35 -19 -36 -19 -248 -140 -295 -169 -8 -5 -22 -12 -30 -15 -8 -4 -28 -15 -45 -26 -16 -11 -37 -23 -45 -27 -8 -4 -58 -33 -111 -65 -53 -32 -100 -58 -103 -58 -4 0 -25 -12 -49 -27 -57 -37 -73 -47 -132 -77 -27 -15 -57 -31 -65 -36 -8 -5 -51 -30 -95 -55 -44 -26 -87 -51 -95 -56 -8 -5 -25 -13 -37 -18 -11 -6 -24 -15 -28 -20 -3 -6 -12 -11 -20 -11 -8 0 -33 -13 -57 -29 -24 -16 -61 -39 -83 -50 -22 -12 -47 -26 -55 -31 -29 -19 -165 -96 -180 -103 -41 -19 -95 -56 -92 -63 2 -9 61 -47 92 -60 8 -4 22 -13 30 -19 8 -7 47 -30 85 -50 39 -21 82 -46 96 -56 15 -10 37 -23 50 -29 26 -12 42 -21 106 -63 24 -15 45 -27 49 -27 6 0 132 -73 174 -100 8 -6 24 -14 35 -19 11 -5 37 -21 58 -35 21 -14 42 -26 47 -26 5 0 28 -13 52 -29 24 -16 61 -39 83 -50 22 -12 47 -26 55 -31 46 -28 268 -157 280 -163 8 -4 29 -16 45 -27 17 -11 40 -24 52 -29 11 -5 24 -15 28 -20 3 -6 12 -11 20 -11 8 0 31 -12 52 -26 21 -14 47 -30 58 -35 11 -5 34 -18 50 -29 17 -11 37 -23 45 -27 8 -3 33 -18 55 -32 22 -14 60 -36 85 -48 25 -13 59 -32 75 -43 17 -11 39 -24 50 -30 11 -6 34 -19 50 -30 17 -11 37 -23 45 -27 8 -3 33 -18 55 -32 39 -24 102 -59 158 -88 15 -8 27 -19 27 -24 0 -5 9 -9 21 -9 12 0 38 -13 59 -30 21 -16 40 -30 44 -30 5 0 158 -87 214 -122 15 -9 50 -29 77 -43 28 -14 64 -34 80 -45 17 -11 39 -24 50 -30 11 -6 35 -20 54 -31 40 -24 26 -29 206 76 66 39 136 79 155 90 19 10 53 29 75 42 22 12 49 27 60 33 11 6 29 16 40 23 11 7 70 41 130 75 132 76 138 79 193 115 24 15 49 27 57 27 8 0 17 5 20 11 4 5 17 15 28 20 12 5 36 18 52 28 17 11 62 36 100 56 39 21 77 44 86 51 8 8 20 14 26 14 6 0 16 7 23 15 7 8 19 15 27 15 8 0 29 11 46 24 18 14 43 29 57 35 14 6 34 17 45 23 93 59 127 79 175 103 30 14 62 32 70 39 8 7 22 16 30 20 8 3 38 20 65 37 28 16 64 37 80 45 17 8 39 20 50 27 41 26 101 62 120 73 11 6 43 23 70 38 28 15 73 41 100 57 28 17 64 37 80 45 17 8 44 23 60 34 17 11 39 24 50 30 11 6 34 19 50 30 17 11 53 31 80 45 28 14 64 35 80 45 17 11 37 23 45 27 8 4 44 24 79 46 35 21 74 43 85 48 12 5 35 18 51 29 17 11 40 24 52 29 11 5 24 15 28 20 3 6 13 11 21 11 9 0 30 11 47 24 18 14 43 29 57 35 45 20 100 56 100 66 0 10 -53 45 -96 64 -19 8 -136 77 -174 101 -8 6 -22 13 -30 17 -8 4 -82 46 -164 95 -81 48 -152 88 -156 88 -4 0 -13 7 -20 15 -7 8 -21 15 -31 15 -10 0 -22 6 -26 13 -4 7 -19 18 -33 24 -14 7 -47 26 -75 42 -27 17 -61 35 -74 41 -13 6 -38 21 -55 33 -35 25 -41 29 -138 81 -40 21 -80 45 -89 52 -8 8 -19 14 -23 14 -5 0 -28 14 -53 30 -24 17 -48 30 -52 30 -4 0 -27 14 -49 30 -23 17 -46 30 -51 30 -6 0 -29 13 -53 29 -24 16 -61 39 -83 50 -22 12 -47 26 -55 31 -31 19 -166 96 -180 103 -8 4 -28 16 -45 27 -16 11 -39 24 -50 29 -11 5 -37 21 -58 35 -21 14 -44 26 -52 26 -8 0 -17 5 -20 11 -4 5 -17 15 -28 20 -12 5 -35 18 -52 29 -16 11 -39 24 -50 30 -11 6 -33 19 -50 30 -16 11 -37 23 -45 27 -20 9 -235 134 -268 155 -15 10 -37 22 -49 27 -11 5 -24 15 -28 20 -3 6 -13 11 -22 11 -9 0 -24 6 -32 14 -9 7 -47 31 -86 51 -38 21 -71 42 -73 47 -2 4 -9 8 -15 8 -6 0 -18 6 -26 13 -42 35 -64 36 -121 6z"/>
              </g>
            </svg>
          </div>
          <h1 className="text-2xl mb-1" style={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}>{sub.project_name || 'Acceptance Criteria'}</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,89,0,0.15)' }}>
            <span className="text-xs font-mono" style={{ color: '#FF8C42', fontWeight: 600 }}>{sub.tracking_id}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl border-2 overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-sm text-white font-medium">Basic Project Information</h2>
          </div>
          <div className="px-6 py-5 space-y-1">
            <Row label="Client / Studio Name" value={sub.client_name} />
            <Row label="Project Name" value={sub.project_name} />
            <Row label="Point of Contact" value={sub.contact} />
            <Row label="Email" value={sub.email} />
            <Row label="Project Type" value={sub.project_type} />
            <MultiRow label="Target Platform" items={sub.target_platform} />
            <Row label="Timezone" value={sub.timezone} />
            <Row label="Expected Start Date" value={sub.start_date} />
            <Row label="Expected Deadline" value={sub.deadline} />
            <Row label="Budget Range" value={sub.budget} />
            <Row label="Project Document Link" value={sub.doc_link} />
          </div>
        </div>

        <div className="rounded-2xl border-2 overflow-hidden mt-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-sm text-white font-medium">What You Want Us to Create</h2>
          </div>
          <div className="px-6 py-5">
            {sub.deliverables && sub.deliverables.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                      <th className="p-2 text-left font-medium" style={{ color: '#6B7280' }}>Deliverable</th>
                      <th className="p-2 text-left font-medium" style={{ color: '#6B7280' }}>Description</th>
                      <th className="p-2 text-left font-medium" style={{ color: '#6B7280' }}>Criteria</th>
                      <th className="p-2 text-left font-medium" style={{ color: '#6B7280' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sub.deliverables.map((d: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }}>
                        <td className="p-2" style={{ color: '#1B1A1C' }}>{d.name || '—'}</td>
                        <td className="p-2" style={{ color: '#1B1A1C' }}>{d.description || '—'}</td>
                        <td className="p-2" style={{ color: '#1B1A1C' }}>{d.criteria || '—'}</td>
                        <td className="p-2" style={{ color: '#1B1A1C' }}>{d.quantity || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>No deliverables specified.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border-2 overflow-hidden mt-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-sm text-white font-medium">Review &amp; Approval</h2>
          </div>
          <div className="px-6 py-5 space-y-1">
            <MultiRow label="Reviewers" items={sub.reviewer} />
            <Row label="Review Rounds" value={sub.review_rounds} />
            <Row label="Expected Review Time" value={sub.review_time} />
            <MultiRow label="Basis for Approval" items={sub.approval_basis} />
          </div>
        </div>

        <div className="rounded-2xl border-2 overflow-hidden mt-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-sm text-white font-medium">Project Governance</h2>
          </div>
          <div className="px-6 py-5 space-y-1">
            <MultiRow label="Communication Tool" items={sub.comms_tool} />
            <MultiRow label="Weekly Meeting" items={sub.weekly_meeting} />
            <Row label="Meeting Time" value={sub.meeting_time} />
            <MultiRow label="Daily Sync" items={sub.daily_sync} />
            <Row label="Sync Time" value={sub.sync_time} />
            <MultiRow label="Training" items={sub.training} />
          </div>
        </div>

        <div className="rounded-2xl border-2 overflow-hidden mt-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-sm text-white font-medium">Technical Details</h2>
          </div>
          <div className="px-6 py-5 space-y-1">
            <MultiRow label="Game Engine" items={sub.game_engine} />
            <Row label="Technical Requirements" value={sub.tech_requirements} />
            <Row label="Tools &amp; Software" value={sub.tools_software} />
            <Row label="Performance Constraints" value={sub.performance_constraints} />
          </div>
        </div>

        <div className="rounded-2xl border-2 overflow-hidden mt-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <h2 className="text-sm text-white font-medium">Client Confirmation</h2>
          </div>
          <div className="px-6 py-5 space-y-1">
            <Row label="Signed by" value={sub.signature} />
            <Row label="Date" value={sub.signature_date || new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}>
            Submit Another Form
          </Link>
        </div>
      </div>

      <div className="py-6 px-4 text-center border-t-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF', fontWeight: 400 }}>Exodia Game Development &middot; Marketing Department</p>
      </div>
    </div>
  )
}