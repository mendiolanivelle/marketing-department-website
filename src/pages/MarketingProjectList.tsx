import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`
}

function formatDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toISOString().slice(0, 16)
}

function getFeasibilityDay(createdAt: string | null, referenceDate?: string | null): { text: string; color: string } {
  if (!createdAt) return { text: 'Feasibility Review - Day 1', color: 'bg-yellow-100 text-yellow-700' }
  const ref = referenceDate ? new Date(referenceDate) : new Date()
  const diffDays = Math.floor((ref.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays >= 3) return { text: 'Overdue: Feasibility Decision', color: 'bg-red-100 text-red-700' }
  if (diffDays >= 2) return { text: 'Pending Feasibility Decision', color: 'bg-blue-100 text-blue-700' }
  if (diffDays >= 1) return { text: 'Feasibility Review - Final Day', color: 'bg-orange-100 text-orange-700' }
  return { text: 'Feasibility Review - Day 1', color: 'bg-yellow-100 text-yellow-700' }
}

interface Project {
  id: number
  tracking_id: string
  project_name: string
  client_name: string
  status: string
  decision: string | null
  phase: string
  pillar: string | null
  meet_link: string | null
  event_id: string | null
  discovery_scheduled_at: string | null
  feasibility_decision_at: string | null
  created_at: string
  sent_at: string | null
}

function ScheduleMeetingModal({ project, onClose, onScheduled }: { project: Project; onClose: () => void; onScheduled: (event: any) => void }) {
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    return formatDateInput(d.toISOString())
  })
  const [attendees, setAttendees] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSchedule = () => {
    setSending(true)
    setError('')
    const client = google.accounts.oauth2.initTokenClient({
      client_id: '771932544725-5trevl51v4i49g8j0a0vnqkh7hnikd12.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: async (response) => {
        if (response.error) {
          setError('Access denied — please allow Calendar access')
          setSending(false)
          return
        }
        try {
          const startDate = new Date(date)
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
          const attendeeList = attendees.split(',').map(a => a.trim()).filter(Boolean)
            .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
            .map(email => ({ email }))

          if (attendeeList.length === 0) {
            setError('Please add at least one valid attendee email')
            setSending(false)
            return
          }

          const event = {
            summary: `Discovery Meeting - ${project.project_name || 'Untitled'}`,
            description: `Discovery call for project: ${project.project_name}\nTracking ID: ${project.tracking_id}`,
            start: { dateTime: startDate.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            end: { dateTime: endDate.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            attendees: attendeeList,
            conferenceData: { createRequest: { requestId: `${project.id}-${Date.now()}` } },
          }

          const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${response.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          })

          if (!res.ok) {
            const err = await res.json()
            setError(err.error?.message || 'Failed to create event')
            setSending(false)
            return
          }

          const created = await res.json()
          onScheduled(created)
        } catch {
          setError('Could not create meeting')
          setSending(false)
        }
      },
    })
    client.requestAccessToken()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[#1B1A1C] text-lg font-bold">Schedule Discovery Meeting</h3>
          <button onClick={onClose} className="text-[#3E4048] hover:text-[#1B1A1C] cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[#F9FAFB] border border-[#CACDD7]/30 rounded-xl p-4">
            <p className="text-xs text-[#3E4048] font-medium">Project</p>
            <p className="text-sm text-[#1B1A1C] font-semibold mt-0.5">{project.project_name || 'Untitled'}</p>
            <p className="text-xs text-[#3E4048] mt-1">Tracking: {project.tracking_id} | Client: {project.client_name || '-'}</p>
          </div>

          <div>
            <label className="text-[#1B1A1C] text-sm font-medium mb-1 block">Date & Time</label>
            <input
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#CACDD7] rounded-lg text-sm focus:outline-none focus:border-[#FF5900]"
            />
          </div>

          <div>
            <label className="text-[#1B1A1C] text-sm font-medium mb-1 block">Attendees (email, comma separated)</label>
            <input
              type="text"
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder="ops@exodiagamedev.com, manager@exodiagamedev.com"
              className="w-full px-4 py-2.5 border border-[#CACDD7] rounded-lg text-sm focus:outline-none focus:border-[#FF5900]"
            />
            <p className="text-xs text-[#3E4048] mt-1">Client will be automatically added</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="text-[#3E4048] text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={sending || !date}
            className="bg-[#1B1A1C] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Creating...' : 'Create Google Meet'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MarketingProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [detailDecidedProject, setDetailDecidedProject] = useState<Project | null>(null)
  const [successProject, setSuccessProject] = useState<Project | null>(null)

  const fetchProjects = async () => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('project_review_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      setProjects(data || [])
      setLoading(false)
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError(err.message || 'Failed to load projects')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('prt-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_review_tickets' }, () => {
          fetchProjects()
        })
        .subscribe()
      return () => { try { supabase?.removeChannel(channel) } catch {} }
    }
  }, [])

  const handleScheduled = async (event: any) => {
    if (!isSupabaseConfigured || !supabase) return
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('project_review_tickets')
      .update({
        status: 'discovery_scheduled',
        meet_link: event.hangoutLink,
        event_id: event.id,
        discovery_scheduled_at: now,
      })
      .eq('id', selectedProject?.id)
    if (err) {
      console.error('Failed to update project:', err)
      return
    }
    await fetchProjects()
    setSelectedProject(null)
    setSuccessProject({ ...selectedProject!, meetLink: event.hangoutLink } as any)
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
        <div className="rounded-2xl overflow-hidden mb-6 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }} />
          <div className="p-5 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Project List</h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Loading projects...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="rounded-2xl overflow-hidden mb-6 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }} />
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Project List</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>View all leads in the feasibility pipeline</p>
            </div>
          </div>
        </div>
      </div>

      {selectedProject && (
        <ScheduleMeetingModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onScheduled={handleScheduled}
        />
      )}

      {successProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSuccessProject(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-[#1B1A1C] text-lg font-bold mb-1">Schedule Sent!</h3>
            <p className="text-[#3E4048] text-sm mb-6">Meeting invitation has been sent to attendees.</p>
            <div className="bg-[#F9FAFB] border border-[#CACDD7]/30 rounded-xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-xs text-[#3E4048]">Tracking ID</span>
                <span className="text-xs text-[#1B1A1C] font-semibold">{successProject.tracking_id || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#3E4048]">Project</span>
                <span className="text-xs text-[#1B1A1C] font-semibold">{successProject.project_name || 'Untitled'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#3E4048]">Client</span>
                <span className="text-xs text-[#1B1A1C] font-semibold">{successProject.client_name || '-'}</span>
              </div>
              {successProject.meetLink && (
                <div className="pt-2 border-t border-[#CACDD7]/30">
                  <a href={successProject.meetLink} target="_blank" rel="noopener noreferrer" className="text-[#FF5900] text-xs font-semibold flex items-center gap-1 justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Open Google Meet
                  </a>
                </div>
              )}
            </div>
            <button
              onClick={() => setSuccessProject(null)}
              className="bg-[#1B1A1C] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Project List - Marketing View</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>View all leads in the feasibility pipeline</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
            {projects.length} projects
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{error ? error : 'No leads yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <th className="w-6 px-1 py-3"></th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Tracking ID</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Client</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Project</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Received</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Feasibility Started</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Phase</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Pillar</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects
                  .sort((a, b) => {
                    if (a.status === 'discovery_scheduled' && b.status !== 'discovery_scheduled') return -1
                    if (a.status !== 'discovery_scheduled' && b.status === 'discovery_scheduled') return 1
                    return 0
                  })
                  .map(p => {
                    const isScheduled = p.status === 'discovery_scheduled'
                    const day = getFeasibilityDay(p.created_at)
                    const diffDays = Math.floor((new Date() - new Date(p.created_at)) / (1000 * 60 * 60 * 24))
                    const isDecided = p.decision === 'accepted' || p.decision === 'declined'
                    return (
                      <tr
                        key={p.id}
                        onClick={isDecided ? () => setDetailDecidedProject(p) : !isScheduled ? () => setSelectedProject(p) : undefined}
                        className={`border-b transition-colors ${isScheduled || isDecided ? 'hover:bg-gray-50 cursor-pointer' : 'bg-[#1B1A1C] hover:bg-[#2a292c] cursor-pointer'}`}
                        style={{ borderColor: !isScheduled && !isDecided ? 'var(--border-secondary)' : 'inherit' }}
                      >
                        <td className="px-1 py-3">{!isScheduled && !isDecided && <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono" style={{ color: isScheduled || isDecided ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{p.tracking_id || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell" style={{ color: isScheduled || isDecided ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{p.client_name || '-'}</td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: isScheduled || isDecided ? 'var(--text-primary)' : '#FFFFFF' }}>{p.project_name || 'Untitled'}</td>
                        <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell" style={{ color: isScheduled || isDecided ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{formatDateTime(p.sent_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell" style={{ color: isScheduled || isDecided ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{p.created_at ? formatDateTime(p.created_at) : 'Today'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #ffffff, #d4d4d8)', color: '#1B1A1C' }}>{p.phase ? p.phase.charAt(0).toUpperCase() + p.phase.slice(1) : 'Initiation'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span style={{ color: 'var(--text-muted)' }} className="text-xs">{p.pillar || '-'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {p.decision === 'accepted' ? (
                              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FF5900] text-white">Feasibility - Accepted</span>
                            ) : p.decision === 'declined' ? (
                              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-600 text-white">Feasibility - Decline</span>
                            ) : (
                              <>
                                <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${day.color}`}>
                                  {day.text}
                                </span>
                                {isScheduled ? (
                                  <a
                                    href={p.meet_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                  >
                                    Discovery Call – Scheduled
                                  </a>
                                ) : diffDays >= 2 ? (
                                  <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                    Discovery Call – Overdue (Not Scheduled)
                                  </span>
                                ) : (
                                  <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    Discovery Call – Not Scheduled
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailDecidedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailDecidedProject(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[#1B1A1C] text-lg font-bold">Project Details</h3>
              <button onClick={() => setDetailDecidedProject(null)} className="text-[#3E4048] hover:text-[#1B1A1C] cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-[#F9FAFB] border border-[#CACDD7]/30 rounded-xl p-6">
              <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3">
                <span className="text-sm text-[#3E4048] font-medium">Tracking ID</span>
                <span className="text-sm text-[#1B1A1C] font-semibold font-mono">{detailDecidedProject.tracking_id || '-'}</span>
                <span className="text-sm text-[#3E4048] font-medium">Client</span>
                <span className="text-sm text-[#1B1A1C] font-semibold">{detailDecidedProject.client_name || '-'}</span>
                <span className="text-sm text-[#3E4048] font-medium">Project</span>
                <span className="text-sm text-[#1B1A1C] font-semibold">{detailDecidedProject.project_name || 'Untitled'}</span>
                <span className="text-sm text-[#3E4048] font-medium">Received</span>
                <span className="text-sm text-[#1B1A1C] font-semibold">{detailDecidedProject.sent_at ? formatDateTime(detailDecidedProject.sent_at) : '-'}</span>
              </div>

              <div className="border-t border-[#CACDD7]/30 mt-4 pt-4">
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3">
                  {(() => {
                    const refDate = detailDecidedProject.feasibility_decision_at || new Date().toISOString()
                    const origDay = getFeasibilityDay(detailDecidedProject.created_at, refDate)
                    return (
                      <>
                        <span className="text-sm text-[#3E4048] font-medium">Feasibility Started</span>
                        <span className="text-sm text-[#1B1A1C] font-semibold">{detailDecidedProject.created_at ? formatDateTime(detailDecidedProject.created_at) : 'Today'}</span>
                        <span className="text-sm text-[#3E4048] font-medium">Feasibility Status</span>
                        <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${origDay.color} w-fit`}>{origDay.text}</span>
                      </>
                    )
                  })()}
                  {(() => {
                    const refDate = detailDecidedProject.feasibility_decision_at || new Date().toISOString()
                    const ref = new Date(refDate)
                    const diffDays = Math.floor((ref - new Date(detailDecidedProject.created_at)) / (1000 * 60 * 60 * 24))
                    const isScheduled = detailDecidedProject.status === 'discovery_scheduled'
                    const isOverdue = !isScheduled && diffDays >= 2
                    const disLabel = isScheduled ? 'Discovery Call \u2013 Scheduled' : isOverdue ? 'Discovery Call \u2013 Overdue (Not Scheduled)' : 'Discovery Call \u2013 Not Scheduled'
                    const disColor = isScheduled ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    return (
                      <>
                        <span className="text-sm text-[#3E4048] font-medium">Discovery Call</span>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm text-[#1B1A1C] font-semibold">{detailDecidedProject.discovery_scheduled_at ? formatDateTime(detailDecidedProject.discovery_scheduled_at) : detailDecidedProject.meet_link ? 'Scheduled' : 'Not Scheduled'}</span>
                          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${disColor}`}>{disLabel}</span>
                        </div>
                      </>
                    )
                  })()}
                  {detailDecidedProject.feasibility_decision_at && (() => {
                    const ref = new Date(detailDecidedProject.feasibility_decision_at)
                    const diffDays = Math.floor((ref - new Date(detailDecidedProject.created_at)) / (1000 * 60 * 60 * 24))
                    return (
                      <>
                        <span className="text-sm text-[#3E4048] font-medium">Feasibility Decision</span>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm text-[#1B1A1C] font-semibold">{formatDateTime(detailDecidedProject.feasibility_decision_at)}</span>
                          {diffDays >= 3 ? (
                            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">Overdue: Feasibility Decision</span>
                          ) : detailDecidedProject.decision === 'accepted' ? (
                            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">Feasibility Decision - Accepted</span>
                          ) : (
                            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">Feasibility Decision - Decline</span>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>

              <div className="border-t border-[#CACDD7]/30 mt-4 pt-4">
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3">
                  <span className="text-sm text-[#3E4048] font-medium">Status</span>
                  {detailDecidedProject.decision === 'accepted' ? (
                    <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[#FF5900] text-white w-fit">Feasibility - Accepted</span>
                  ) : (
                    <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-red-600 text-white w-fit">Feasibility - Decline</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}