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
          .eq('tracking_id', id)
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAFA' }}>
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-solid" style={{ borderColor: '#E5E7EB', borderTopColor: '#FF5900' }} />
      </div>
    )
  }

  if (error || !sub) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#FAFAFA' }}>
        <p className="text-sm mb-4" style={{ color: '#EF4444' }}>{error || 'Form not found'}</p>
        <Link to="/acceptance-form" className="text-sm underline" style={{ color: '#FF5900' }}>Go to Acceptance Criteria Form</Link>
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
    <div style={{ backgroundColor: '#FAFAFA', minHeight: '100vh' }}>
      <div className="py-6 px-4 text-center border-b" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl mb-1" style={{ color: '#1B1A1C', fontWeight: 700 }}>{sub.project_name || 'Acceptance Criteria Form'}</h1>
          <p className="text-xs font-mono" style={{ color: '#FF5900', fontWeight: 500 }}>{sub.tracking_id}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="px-6 py-4 border-b" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Section 1: Basic Project Information</h2>
          </div>
          <div className="px-6 py-4 space-y-1">
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

        <div className="rounded-xl border overflow-hidden mt-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="px-6 py-4 border-b" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Section 2: What You Want Us to Create</h2>
          </div>
          <div className="px-6 py-4">
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

        <div className="rounded-xl border overflow-hidden mt-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="px-6 py-4 border-b" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Section 3: Review & Approval</h2>
          </div>
          <div className="px-6 py-4 space-y-1">
            <MultiRow label="Reviewers" items={sub.reviewer} />
            <Row label="Review Rounds" value={sub.review_rounds} />
            <Row label="Expected Review Time" value={sub.review_time} />
            <MultiRow label="Basis for Approval" items={sub.approval_basis} />
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden mt-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="px-6 py-4 border-b" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Section 4: Project Governance</h2>
          </div>
          <div className="px-6 py-4 space-y-1">
            <MultiRow label="Communication Tool" items={sub.comms_tool} />
            <MultiRow label="Weekly Meeting" items={sub.weekly_meeting} />
            <Row label="Meeting Time" value={sub.meeting_time} />
            <MultiRow label="Daily Sync" items={sub.daily_sync} />
            <Row label="Sync Time" value={sub.sync_time} />
            <MultiRow label="Training" items={sub.training} />
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden mt-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="px-6 py-4 border-b" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Section 5: Technical Details</h2>
          </div>
          <div className="px-6 py-4 space-y-1">
            <MultiRow label="Game Engine" items={sub.game_engine} />
            <Row label="Technical Requirements" value={sub.tech_requirements} />
            <Row label="Tools & Software" value={sub.tools_software} />
            <Row label="Performance Constraints" value={sub.performance_constraints} />
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden mt-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
          <div className="px-6 py-4 border-b" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Section 6: Client Confirmation</h2>
          </div>
          <div className="px-6 py-4 space-y-1">
            <Row label="Signed by" value={sub.signature} />
            <Row label="Date" value={sub.signature_date || new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/acceptance-form" className="text-sm underline" style={{ color: '#FF5900' }}>Submit another Acceptance Criteria Form</Link>
        </div>
      </div>

      <div className="py-4 px-4 text-center border-t" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>Exodia Game Development &middot; Marketing Department</p>
      </div>
    </div>
  )
}