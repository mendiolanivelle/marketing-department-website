import { useState, useEffect } from 'react'

interface TalkScriptBlock {
  key: string
  label: string
  text: string
}

interface RunOfShowRow {
  time: string
  topic: string
  speaker: string
  action: string
  tech: string
}

interface MeetingType {
  key: string
  label: string
  duration: string
  goal: string
  rows: RunOfShowRow[]
}

const defaultMeetings: MeetingType[] = [
  {
    key: 'discovery',
    label: 'Discovery Call',
    duration: '45 min',
    goal: 'Understand client pain points, qualify the lead, and set clear next steps',
    rows: [
      { time: '0:00 – 2:00', topic: 'Open & Welcome', speaker: 'Account Executive', action: 'Brief intro, set the agenda, confirm meeting length', tech: 'Screen share with agenda slide visible' },
      { time: '2:00 – 5:00', topic: 'Client Introductions', speaker: 'All', action: 'Each attendee shares their role and what they hope to get out of the meeting', tech: 'Keep slide on agenda' },
      { time: '5:00 – 7:00', topic: 'Context Recap', speaker: 'Account Executive', action: 'Briefly recap how we got here — previous conversations, submitted forms, etc.', tech: 'Show timeline or summary doc' },
      { time: '7:00 – 22:00', topic: 'Discovery Questions', speaker: 'Account Executive', action: 'Ask prepared questions about pain points, goals, timeline, budget, decision criteria', tech: 'Shared notes doc or CRM screen' },
      { time: '22:00 – 25:00', topic: 'Buffer / Follow-up Questions', speaker: 'All', action: 'Catch any missed topics, dig deeper on key answers', tech: 'Same as above' },
      { time: '25:00 – 35:00', topic: 'Exodia Capabilities Overview', speaker: 'Account Executive', action: 'Show 2-3 relevant case studies aligned to their needs. Connect features to their pain points.', tech: 'Slide deck with case studies ready' },
      { time: '35:00 – 38:00', topic: 'Q&A', speaker: 'All', action: 'Open floor for client questions', tech: 'Stay on slide deck or switch to blank' },
      { time: '38:00 – 42:00', topic: 'Next Steps & Timeline', speaker: 'Account Executive', action: 'Propose concrete next steps: proposal date, follow-up meeting, internal review', tech: 'Show timeline slide with milestones' },
      { time: '42:00 – 45:00', topic: 'Close', speaker: 'Account Executive', action: 'Summarize key takeaways, confirm next steps, thank attendees', tech: 'End screen with contact info' },
    ],
  },
  {
    key: 'proposal',
    label: 'Proposal Presentation',
    duration: '60 min',
    goal: 'Present the proposed solution, timeline, and pricing',
    rows: [
      { time: '0:00 – 3:00', topic: 'Open & Agenda', speaker: 'Account Executive', action: 'Welcome, set expectations for the presentation', tech: 'Agenda slide' },
      { time: '3:00 – 8:00', topic: 'Needs Recap', speaker: 'Account Executive', action: 'Summarize the client\'s stated needs and goals from discovery', tech: 'Show previous notes or summary' },
      { time: '8:00 – 30:00', topic: 'Proposal Walkthrough', speaker: 'Account Executive', action: 'Present solution, scope, timeline, deliverables, and pricing', tech: 'Proposal deck with clear sections' },
      { time: '30:00 – 40:00', topic: 'Q&A', speaker: 'All', action: 'Address questions, clarify scope, discuss concerns', tech: 'Open floor' },
      { time: '40:00 – 50:00', topic: 'Pricing Deep Dive', speaker: 'Account Executive', action: 'Break down pricing structure, payment terms, and ROI', tech: 'Pricing page on deck' },
      { time: '50:00 – 55:00', topic: 'Next Steps', speaker: 'Account Executive', action: 'Review decision timeline, internal review process, follow-up date', tech: 'Next steps slide' },
      { time: '55:00 – 60:00', topic: 'Close', speaker: 'Account Executive', action: 'Summarize, confirm understanding, thank them', tech: 'Contact info slide' },
    ],
  },
  {
    key: 'kickoff',
    label: 'Project Kickoff',
    duration: '60 min',
    goal: 'Align on project goals, timeline, team roles, and communication plan',
    rows: [
      { time: '0:00 – 5:00', topic: 'Welcome & Introductions', speaker: 'Project Manager', action: 'Introduce team members, their roles, and what they bring to the project', tech: 'Team introduction slide' },
      { time: '5:00 – 15:00', topic: 'Project Scope & Goals', speaker: 'Project Manager', action: 'Review the agreed-upon scope, objectives, and success criteria', tech: 'Scope document or SOW' },
      { time: '15:00 – 25:00', topic: 'Timeline & Milestones', speaker: 'Project Manager', action: 'Walk through the project timeline, key milestones, and deliverables', tech: 'Timeline/Gantt chart view' },
      { time: '25:00 – 30:00', topic: 'Roles & Responsibilities', speaker: 'Project Manager', action: 'Clarify who does what, escalation paths, and points of contact', tech: 'RACI chart or team org slide' },
      { time: '30:00 – 35:00', topic: 'Communication Plan', speaker: 'Project Manager', action: 'Set meeting cadence, communication channels, reporting format', tech: 'Communication plan slide' },
      { time: '35:00 – 45:00', topic: 'Tools & Access', speaker: 'Project Manager', action: 'Grant access to project management tools, shared drives, collaboration platforms', tech: 'Screen share of tool setup' },
      { time: '45:00 – 52:00', topic: 'Q&A / Discussion', speaker: 'All', action: 'Open discussion for questions, concerns, clarifications', tech: 'Open floor' },
      { time: '52:00 – 57:00', topic: 'Action Items & Next Steps', speaker: 'Project Manager', action: 'Assign immediate action items, set first deliverable date', tech: 'Action items list' },
      { time: '57:00 – 60:00', topic: 'Close', speaker: 'Project Manager', action: 'Summarize, confirm understanding, share meeting notes', tech: 'Contact and resource links' },
    ],
  },
  {
    key: 'sprint',
    label: 'Weekly Sprint Review',
    duration: '30 min',
    goal: 'Review progress, demo completed work, and adjust priorities',
    rows: [
      { time: '0:00 – 2:00', topic: 'Open & Check-in', speaker: 'Project Manager', action: 'Quick round of how everyone is doing, set the tone', tech: 'Agenda visible' },
      { time: '2:00 – 12:00', topic: 'Sprint Demo', speaker: 'Lead Developer', action: 'Demo completed features, show progress against goals', tech: 'Screen share of working product' },
      { time: '12:00 – 17:00', topic: 'Metrics & Progress', speaker: 'Project Manager', action: 'Show sprint metrics: velocity, completed vs planned, blockers', tech: 'Dashboard or tracking tool' },
      { time: '17:00 – 22:00', topic: 'Blockers & Risks', speaker: 'All', action: 'Discuss any blockers, risks, or dependencies that need attention', tech: 'Board view highlighting blocked items' },
      { time: '22:00 – 27:00', topic: 'Next Sprint Planning', speaker: 'Project Manager', action: 'Review upcoming priorities, adjust based on feedback', tech: 'Next sprint backlog' },
      { time: '27:00 – 30:00', topic: 'Close', speaker: 'Project Manager', action: 'Confirm action items, share meeting notes, schedule next meeting', tech: 'Notes doc' },
    ],
  },
]

const defaultTalkScripts: TalkScriptBlock[] = [
  {
    key: 'hook',
    label: 'The Hook / Opener',
    text: `Hey everyone, thanks for making the time. I know calendars are full, so I'll be direct — this [Meeting Type] is about [specific outcome]. By the time we're done, you'll walk away with [key takeaway]. My goal is to make this worth your while. Let's jump in.`,
  },
  {
    key: 'context',
    label: 'The Context Setter',
    text: `Before we go deeper, let me quickly set the stage. [Brief background — what happened before this meeting, what's been discussed, what's at stake]. That's the reason we're sitting down today. So here's where things stand…`,
  },
  {
    key: 'pivot',
    label: 'The Core Pivot',
    text: `Alright — we've laid out where we are. Now let's talk about where we can go. I want to walk you through [solution / proposal], and I think it'll make a lot of sense given what we've just covered.`,
  },
  {
    key: 'close',
    label: 'The Close & Call to Action',
    text: `Here's where we land. Today we covered [summary point 1], [point 2], and [point 3]. Next steps: [action 1], [action 2], and [action 3]. I'll send a recap within the hour. Thanks for the real conversation — let's keep the momentum going.`,
  },
]

const STORAGE_KEY = 'exodia-meeting-playbook'
const TALK_SCRIPT_KEY = 'exodia-talk-script'

export default function MeetingPlaybook() {
  const [meetings, setMeetings] = useState<MeetingType[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) { try { return JSON.parse(saved) } catch {} }
    return defaultMeetings
  })
  const [activeKey, setActiveKey] = useState(meetings[0]?.key || 'discovery')
  const [editingRow, setEditingRow] = useState<{ meetingKey: string; rowIndex: number; field: keyof RunOfShowRow } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [talkScripts, setTalkScripts] = useState<TalkScriptBlock[]>(() => {
    const saved = localStorage.getItem(TALK_SCRIPT_KEY)
    if (saved) { try { return JSON.parse(saved) } catch {} }
    return defaultTalkScripts
  })
  const [editingScript, setEditingScript] = useState<string | null>(null)
  const [scriptEditValue, setScriptEditValue] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings))
  }, [meetings])

  useEffect(() => {
    localStorage.setItem(TALK_SCRIPT_KEY, JSON.stringify(talkScripts))
  }, [talkScripts])

  const activeMeeting = meetings.find(m => m.key === activeKey) || meetings[0]

  const saveEdit = () => {
    if (!editingRow) return
    setMeetings(prev => prev.map(m => {
      if (m.key !== editingRow.meetingKey) return m
      const newRows = [...m.rows]
      newRows[editingRow.rowIndex] = { ...newRows[editingRow.rowIndex], [editingRow.field]: editValue }
      return { ...m, rows: newRows }
    }))
    setEditingRow(null)
    setEditValue('')
  }

  const startEdit = (meetingKey: string, rowIndex: number, field: keyof RunOfShowRow, value: string) => {
    setEditingRow({ meetingKey, rowIndex, field })
    setEditValue(value)
  }

  const saveScriptEdit = () => {
    if (!editingScript) return
    setTalkScripts(prev => prev.map(s => s.key === editingScript ? { ...s, text: scriptEditValue } : s))
    setEditingScript(null)
    setScriptEditValue('')
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
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Client meeting guides and best practices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Type Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {meetings.map(m => (
          <button
            key={m.key}
            onClick={() => setActiveKey(m.key)}
            className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap"
            style={{
              backgroundColor: activeKey === m.key ? 'var(--accent)' : 'var(--bg-card)',
              color: activeKey === m.key ? '#FFFFFF' : 'var(--text-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Run of Show Table */}
      {activeMeeting && (
        <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Run of Show — {activeMeeting.duration} {activeMeeting.label}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Goal: {activeMeeting.goal}</p>
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
                {activeMeeting.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    {(['time', 'topic', 'speaker', 'action', 'tech'] as (keyof RunOfShowRow)[]).map(field => (
                      <td key={field} className="py-2 pr-3 align-top" style={{ cursor: 'pointer' }} onClick={() => startEdit(activeMeeting.key, i, field, row[field])}>
                        {editingRow?.meetingKey === activeMeeting.key && editingRow?.rowIndex === i && editingRow?.field === field ? (
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

      {/* Modular Talk Script */}
      <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Modular Talk Script</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>Click to edit</span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
          Customize these blocks for your — replace anything in <span style={{ color: 'var(--accent)' }}>[brackets]</span> with your own details.
        </p>
        <div className="space-y-4">
          {talkScripts.map(script => (
            <div key={script.key} className="rounded-lg border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }}></div>
                <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{script.label}</h3>
              </div>
              {editingScript === script.key ? (
                <div>
                  <textarea
                    autoFocus
                    value={scriptEditValue}
                    onChange={e => setScriptEditValue(e.target.value)}
                    onBlur={saveScriptEdit}
                    onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveScriptEdit() }; if (e.key === 'Escape') { setEditingScript(null); setScriptEditValue('') } }}
                    className="w-full px-3 py-2 rounded border outline-none resize-y text-xs leading-relaxed"
                    style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 80 }}
                    rows={3}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Shift+Enter to save — Esc to cancel</p>
                </div>
              ) : (
                <div onClick={() => { setEditingScript(script.key); setScriptEditValue(script.text) }} style={{ cursor: 'pointer' }}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{script.text}</p>
                </div>
              )}
              <button
                className="text-xs mt-2 font-medium transition"
                style={{ color: 'var(--accent)' }}
                onClick={() => { navigator.clipboard.writeText(script.text) }}
              >
                Copy block
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Playbook Sections */}
      <div className="space-y-4">
        {[
          { title: 'Discovery Call', desc: 'First meeting with a potential client. Goal: understand their needs, showcase expertise, and qualify the lead.', items: ['Research the client and their industry beforehand', 'Prepare a list of discovery questions', 'Demonstrate relevant past work', 'Discuss timeline and budget expectations', 'Set clear next steps before ending the call'] },
          { title: 'Proposal Presentation', desc: 'Presenting the proposed solution, timeline, and pricing to the client.', items: ['Start with a recap of their needs', 'Walk through the proposed solution step by step', 'Be transparent about pricing and scope', 'Address objections proactively', 'End with a clear call to action'] },
          { title: 'Project Kickoff', desc: 'First meeting after the project is won. Align on goals, timeline, and communication.', items: ['Introduce the team and roles', 'Review the project scope and milestones', 'Set communication channels and frequency', 'Define success criteria and KPIs', 'Schedule regular check-in meetings'] },
        ].map((section, i) => (
          <div key={i} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{section.title}</h3>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{section.desc}</p>
            <ul className="space-y-1.5">
              {section.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}