import { useState, useEffect } from 'react'

interface RunOfShowRow {
  time: string
  topic: string
  speaker: string
  action: string
  tech: string
}

interface ColumnPlaybook {
  columnKey: string
  columnLabel: string
  duration: string
  goal: string
  rows: RunOfShowRow[]
}

const defaultPlaybooks: ColumnPlaybook[] = [
  {
    columnKey: 'col-1',
    columnLabel: 'Initial Contact',
    duration: '30 min',
    goal: 'Make first contact, introduce Exodia, and schedule a discovery call',
    rows: [
      { time: '0:00 – 2:00', topic: 'Open & Purpose', speaker: 'Account Executive', action: 'Brief intro, explain why you\'re reaching out', tech: 'None needed' },
      { time: '2:00 – 10:00', topic: 'Company Introduction', speaker: 'Account Executive', action: 'Quick overview of Exodia, services, and relevant experience', tech: 'Short pitch deck or website' },
      { time: '10:00 – 15:00', topic: 'Client Needs Assessment', speaker: 'Account Executive', action: 'Ask about their current challenges, projects, or goals', tech: 'Notes doc' },
      { time: '15:00 – 20:00', topic: 'Value Proposition', speaker: 'Account Executive', action: 'Connect Exodia\'s capabilities to their specific needs', tech: 'Relevant case study' },
      { time: '20:00 – 25:00', topic: 'Next Steps', speaker: 'Account Executive', action: 'Propose a discovery call, send calendar invite', tech: 'Calendar scheduling link' },
      { time: '25:00 – 30:00', topic: 'Q&A & Close', speaker: 'All', action: 'Answer questions, confirm interest, end with clear action', tech: 'None' },
    ],
  },
  {
    columnKey: 'col-2',
    columnLabel: 'Discovery Call',
    duration: '45 min',
    goal: 'Understand client pain points, showcase expertise, and qualify the lead',
    rows: [
      { time: '0:00 – 2:00', topic: 'Open & Welcome', speaker: 'Account Executive', action: 'Set agenda, confirm meeting length', tech: 'Agenda slide' },
      { time: '2:00 – 5:00', topic: 'Client Introductions', speaker: 'All', action: 'Each attendee shares their role and goals', tech: 'Keep on agenda' },
      { time: '5:00 – 7:00', topic: 'Context Recap', speaker: 'Account Executive', action: 'Briefly recap how we got here', tech: 'Timeline or summary doc' },
      { time: '7:00 – 22:00', topic: 'Discovery Questions', speaker: 'Account Executive', action: 'Ask about pain points, goals, timeline, budget, decision criteria', tech: 'Shared notes doc or CRM' },
      { time: '22:00 – 25:00', topic: 'Buffer / Follow-up', speaker: 'All', action: 'Catch missed topics, dig deeper', tech: 'Same as above' },
      { time: '25:00 – 35:00', topic: 'Exodia Capabilities', speaker: 'Account Executive', action: 'Show 2-3 relevant case studies aligned to their needs', tech: 'Slide deck with case studies' },
      { time: '35:00 – 38:00', topic: 'Q&A', speaker: 'All', action: 'Open floor for client questions', tech: 'Stay on deck or blank' },
      { time: '38:00 – 42:00', topic: 'Next Steps', speaker: 'Account Executive', action: 'Propose concrete next steps, proposal date, follow-up', tech: 'Timeline slide' },
      { time: '42:00 – 45:00', topic: 'Close', speaker: 'Account Executive', action: 'Summarize, confirm next steps, thank attendees', tech: 'Contact info screen' },
    ],
  },
  {
    columnKey: 'col-3',
    columnLabel: 'Proposal Sent',
    duration: '60 min',
    goal: 'Present the proposal, walk through solution, timeline, and pricing',
    rows: [
      { time: '0:00 – 3:00', topic: 'Open & Agenda', speaker: 'Account Executive', action: 'Welcome, set expectations', tech: 'Agenda slide' },
      { time: '3:00 – 8:00', topic: 'Needs Recap', speaker: 'Account Executive', action: 'Summarize their stated needs from discovery', tech: 'Previous notes' },
      { time: '8:00 – 30:00', topic: 'Proposal Walkthrough', speaker: 'Account Executive', action: 'Present solution, scope, timeline, deliverables, pricing', tech: 'Proposal deck' },
      { time: '30:00 – 40:00', topic: 'Q&A', speaker: 'All', action: 'Address questions, clarify scope', tech: 'Open floor' },
      { time: '40:00 – 50:00', topic: 'Pricing Deep Dive', speaker: 'Account Executive', action: 'Break down pricing, payment terms, ROI', tech: 'Pricing page' },
      { time: '50:00 – 55:00', topic: 'Next Steps', speaker: 'Account Executive', action: 'Review decision timeline, follow-up date', tech: 'Next steps slide' },
      { time: '55:00 – 60:00', topic: 'Close', speaker: 'Account Executive', action: 'Summarize, confirm understanding', tech: 'Contact info' },
    ],
  },
  {
    columnKey: 'col-4',
    columnLabel: 'SOW & Pricing Finalization',
    duration: '45 min',
    goal: 'Finalize scope of work, pricing, and contract terms',
    rows: [
      { time: '0:00 – 5:00', topic: 'Open & Review', speaker: 'Sales / PM', action: 'Review agreed-upon scope from proposal', tech: 'SOW document' },
      { time: '5:00 – 20:00', topic: 'SOW Walkthrough', speaker: 'Project Manager', action: 'Go through each section of the SOW in detail', tech: 'SOW doc screen share' },
      { time: '20:00 – 30:00', topic: 'Pricing & Terms', speaker: 'Sales', action: 'Confirm pricing, payment schedule, contract terms', tech: 'Pricing section of SOW' },
      { time: '30:00 – 35:00', topic: 'Questions & Clarifications', speaker: 'All', action: 'Address any concerns about scope or terms', tech: 'Open floor' },
      { time: '35:00 – 40:00', topic: 'Next Steps', speaker: 'Sales', action: 'Discuss signing process, deposit, kickoff scheduling', tech: 'Contract steps' },
      { time: '40:00 – 45:00', topic: 'Close', speaker: 'Sales / PM', action: 'Confirm alignment, send contract, schedule kickoff', tech: 'Email draft visible' },
    ],
  },
  {
    columnKey: 'col-5',
    columnLabel: 'Closed Won',
    duration: '60 min',
    goal: 'Kick off the project, align team, set communication plan',
    rows: [
      { time: '0:00 – 5:00', topic: 'Welcome & Introductions', speaker: 'Project Manager', action: 'Introduce team members and their roles', tech: 'Team intro slide' },
      { time: '5:00 – 15:00', topic: 'Project Scope & Goals', speaker: 'Project Manager', action: 'Review scope, objectives, success criteria', tech: 'Scope document' },
      { time: '15:00 – 25:00', topic: 'Timeline & Milestones', speaker: 'Project Manager', action: 'Walk through timeline, milestones, deliverables', tech: 'Timeline/Gantt chart' },
      { time: '25:00 – 30:00', topic: 'Roles & Responsibilities', speaker: 'Project Manager', action: 'Clarify who does what, escalation paths', tech: 'RACI chart' },
      { time: '30:00 – 35:00', topic: 'Communication Plan', speaker: 'Project Manager', action: 'Set meeting cadence, channels, reporting', tech: 'Communication plan slide' },
      { time: '35:00 – 45:00', topic: 'Tools & Access', speaker: 'Project Manager', action: 'Grant access to PM tools, shared drives', tech: 'Screen share of tool setup' },
      { time: '45:00 – 52:00', topic: 'Q&A', speaker: 'All', action: 'Open discussion for questions and concerns', tech: 'Open floor' },
      { time: '52:00 – 57:00', topic: 'Action Items', speaker: 'Project Manager', action: 'Assign immediate action items, first deliverable', tech: 'Action items list' },
      { time: '57:00 – 60:00', topic: 'Close', speaker: 'Project Manager', action: 'Summarize, share meeting notes', tech: 'Contact and resource links' },
    ],
  },
]

const STORAGE_KEY = 'exodia-meeting-playbook'

export default function MeetingPlaybook() {
  const [playbooks, setPlaybooks] = useState<ColumnPlaybook[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed } catch {} }
    return defaultPlaybooks
  })
  const [activeKey, setActiveKey] = useState(playbooks[0]?.columnKey || 'col-1')
  const [editingRow, setEditingRow] = useState<{ colKey: string; rowIndex: number; field: keyof RunOfShowRow } | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playbooks))
  }, [playbooks])

  const activePlaybook = playbooks.find(p => p.columnKey === activeKey) || playbooks[0]

  const saveEdit = () => {
    if (!editingRow) return
    setPlaybooks(prev => prev.map(p => {
      if (p.columnKey !== editingRow.colKey) return p
      const newRows = [...p.rows]
      newRows[editingRow.rowIndex] = { ...newRows[editingRow.rowIndex], [editingRow.field]: editValue }
      return { ...p, rows: newRows }
    }))
    setEditingRow(null)
    setEditValue('')
  }

  const startEdit = (colKey: string, rowIndex: number, field: keyof RunOfShowRow, value: string) => {
    setEditingRow({ colKey, rowIndex, field })
    setEditValue(value)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Meeting Playbook</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Run of Show aligned with the Client Onboarding process</p>
            </div>
          </div>
        </div>
      </div>

      {/* Column Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {playbooks.map(p => (
          <button
            key={p.columnKey}
            onClick={() => setActiveKey(p.columnKey)}
            className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap"
            style={{
              backgroundColor: activeKey === p.columnKey ? 'var(--accent)' : 'var(--bg-card)',
              color: activeKey === p.columnKey ? '#FFFFFF' : 'var(--text-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            {p.columnLabel}
          </button>
        ))}
      </div>

      {/* Run of Show Table */}
      {activePlaybook && (
        <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Run of Show — {activePlaybook.duration} {activePlaybook.columnLabel}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Goal: {activePlaybook.goal}</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>Click to edit</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 110 }}>Time</th>
                  <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Topic</th>
                  <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 140 }}>Speaker</th>
                  <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Key Action / Goal</th>
                  <th className="text-left py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Tech / Visual Cues</th>
                </tr>
              </thead>
              <tbody>
                {activePlaybook.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    {(['time', 'topic', 'speaker', 'action', 'tech'] as (keyof RunOfShowRow)[]).map(field => (
                      <td key={field} className="py-2 pr-3 align-top" style={{ cursor: 'pointer' }} onClick={() => startEdit(activePlaybook.columnKey, i, field, row[field])}>
                        {editingRow?.colKey === activePlaybook.columnKey && editingRow?.rowIndex === i && editingRow?.field === field ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingRow(null); setEditValue('') } }}
                            className="w-full px-2 py-1 rounded border outline-none text-xs"
                            style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                          />
                        ) : (
                          <span style={{
                            color: field === 'time' ? 'var(--accent)' : field === 'topic' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: field === 'time' ? 600 : field === 'topic' ? 500 : 300,
                            fontFamily: field === 'time' ? 'monospace' : 'inherit',
                            fontStyle: field === 'tech' ? 'italic' : 'inherit',
                          }}>{row[field]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Playbook Guides */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Meeting Guides</h2>
        {playbooks.map((p, i) => (
          <div key={i} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{p.columnLabel}</h3>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Goal: {p.goal}</p>
            <ul className="space-y-1.5">
              {p.rows.map((row, j) => (
                <li key={j} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                  <span className="text-[10px] font-semibold whitespace-nowrap flex-shrink-0" style={{ color: 'var(--accent)', fontFamily: 'monospace', marginTop: 1 }}>{row.time}</span>
                  <span>{row.topic} — <span style={{ fontStyle: 'italic' }}>{row.speaker}</span>: {row.action}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}