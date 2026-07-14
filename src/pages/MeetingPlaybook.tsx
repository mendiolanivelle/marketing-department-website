import { useState, useEffect } from 'react'

interface TalkScriptBlock {
  key: string
  label: string
  text: string
}

interface QuickLink {
  id: string
  label: string
  url: string
}

interface RunOfShowRow {
  time: string
  topic: string
  speaker: string
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
      { time: '0:00 – 2:00', topic: 'Open & Welcome — brief intro, set agenda, confirm meeting length', speaker: 'Account Executive', tech: 'Screen share with agenda slide visible' },
      { time: '2:00 – 5:00', topic: 'Client Introductions — each attendee shares their role and what they hope to get out of the meeting', speaker: 'All', tech: 'Keep slide on agenda' },
      { time: '5:00 – 7:00', topic: 'Context Recap — briefly recap how we got here, previous conversations, submitted forms', speaker: 'Account Executive', tech: 'Show timeline or summary doc' },
      { time: '7:00 – 22:00', topic: 'Discovery Questions — pain points, goals, timeline, budget, decision criteria', speaker: 'Account Executive', tech: 'Shared notes doc or CRM screen' },
      { time: '22:00 – 25:00', topic: 'Buffer / Follow-up Questions — catch missed topics, dig deeper on key answers', speaker: 'All', tech: 'Same as above' },
      { time: '25:00 – 35:00', topic: 'Exodia Capabilities Overview — 2-3 case studies aligned to their needs, connect features to pain points', speaker: 'Account Executive', tech: 'Slide deck with case studies ready' },
      { time: '35:00 – 38:00', topic: 'Q&A — open floor for client questions', speaker: 'All', tech: 'Stay on slide deck or switch to blank' },
      { time: '38:00 – 42:00', topic: 'Next Steps & Timeline — proposal date, follow-up meeting, internal review', speaker: 'Account Executive', tech: 'Show timeline slide with milestones' },
      { time: '42:00 – 45:00', topic: 'Close — summarize key takeaways, confirm next steps, thank attendees', speaker: 'Account Executive', tech: 'End screen with contact info' },
    ],
  },
  {
    key: 'proposal',
    label: 'Proposal Presentation',
    duration: '60 min',
    goal: 'Present the proposed solution, timeline, and pricing',
    rows: [
      { time: '0:00 – 3:00', topic: 'Open & Agenda — welcome, set expectations for the presentation', speaker: 'Account Executive', tech: 'Agenda slide' },
      { time: '3:00 – 8:00', topic: 'Needs Recap — summarize the client\'s stated needs and goals from discovery', speaker: 'Account Executive', tech: 'Show previous notes or summary' },
      { time: '8:00 – 30:00', topic: 'Proposal Walkthrough — solution, scope, timeline, deliverables, and pricing', speaker: 'Account Executive', tech: 'Proposal deck with clear sections' },
      { time: '30:00 – 40:00', topic: 'Q&A — address questions, clarify scope, discuss concerns', speaker: 'All', tech: 'Open floor' },
      { time: '40:00 – 50:00', topic: 'Pricing Deep Dive — break down pricing structure, payment terms, and ROI', speaker: 'Account Executive', tech: 'Pricing page on deck' },
      { time: '50:00 – 55:00', topic: 'Next Steps — review decision timeline, internal review process, follow-up date', speaker: 'Account Executive', tech: 'Next steps slide' },
      { time: '55:00 – 60:00', topic: 'Close — summarize, confirm understanding, thank them', speaker: 'Account Executive', tech: 'Contact info slide' },
    ],
  },
  {
    key: 'kickoff',
    label: 'Project Kickoff',
    duration: '60 min',
    goal: 'Align on project goals, timeline, team roles, and communication plan',
    rows: [
      { time: '0:00 – 5:00', topic: 'Welcome & Introductions — introduce team, their roles, and what they bring', speaker: 'Project Manager', tech: 'Team introduction slide' },
      { time: '5:00 – 15:00', topic: 'Project Scope & Goals — review agreed-upon scope, objectives, and success criteria', speaker: 'Project Manager', tech: 'Scope document or SOW' },
      { time: '15:00 – 25:00', topic: 'Timeline & Milestones — walk through the project timeline, key milestones, deliverables', speaker: 'Project Manager', tech: 'Timeline/Gantt chart view' },
      { time: '25:00 – 30:00', topic: 'Roles & Responsibilities — who does what, escalation paths, points of contact', speaker: 'Project Manager', tech: 'RACI chart or team org slide' },
      { time: '30:00 – 35:00', topic: 'Communication Plan — meeting cadence, communication channels, reporting format', speaker: 'Project Manager', tech: 'Communication plan slide' },
      { time: '35:00 – 45:00', topic: 'Tools & Access — grant access to project management tools, shared drives, platforms', speaker: 'Project Manager', tech: 'Screen share of tool setup' },
      { time: '45:00 – 52:00', topic: 'Q&A / Discussion — open discussion for questions, concerns, clarifications', speaker: 'All', tech: 'Open floor' },
      { time: '52:00 – 57:00', topic: 'Action Items & Next Steps — assign immediate action items, set first deliverable date', speaker: 'Project Manager', tech: 'Action items list' },
      { time: '57:00 – 60:00', topic: 'Close — summarize, confirm understanding, share meeting notes', speaker: 'Project Manager', tech: 'Contact and resource links' },
    ],
  },
  {
    key: 'sprint',
    label: 'Weekly Sprint Review',
    duration: '30 min',
    goal: 'Review progress, demo completed work, and adjust priorities',
    rows: [
      { time: '0:00 – 2:00', topic: 'Open & Check-in — quick round of how everyone is doing, set the tone', speaker: 'Project Manager', tech: 'Agenda visible' },
      { time: '2:00 – 12:00', topic: 'Sprint Demo — demo completed features, show progress against goals', speaker: 'Lead Developer', tech: 'Screen share of working product' },
      { time: '12:00 – 17:00', topic: 'Metrics & Progress — sprint metrics: velocity, completed vs planned, blockers', speaker: 'Project Manager', tech: 'Dashboard or tracking tool' },
      { time: '17:00 – 22:00', topic: 'Blockers & Risks — discuss any blockers, risks, or dependencies needing attention', speaker: 'All', tech: 'Board view highlighting blocked items' },
      { time: '22:00 – 27:00', topic: 'Next Sprint Planning — review upcoming priorities, adjust based on feedback', speaker: 'Project Manager', tech: 'Next sprint backlog' },
      { time: '27:00 – 30:00', topic: 'Close — confirm action items, share meeting notes, schedule next meeting', speaker: 'Project Manager', tech: 'Notes doc' },
    ],
  },
]

const defaultQuickLinks: QuickLink[] = [
  { id: 'deck', label: 'Master Deck', url: '' },
  { id: 'miro', label: 'Miro Board', url: '' },
  { id: 'polling', label: 'Polling Link', url: '' },
  { id: 'recording', label: 'Recording', url: '' },
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

const objectionHandlingRows = [
  { objection: 'It\'s too expensive.', response: 'Break down the ROI. Ask: "Compared to what?" Show how the cost of inaction adds up.' },
  { objection: 'We need to think about it.', response: 'Set a clear follow-up date. Ask: "What specific concerns do you need to address?" Offer to join the internal discussion.' },
  { objection: 'We\'re already working with someone.', response: 'Acknowledge. Ask: "What\'s working well? What isn\'t?" Position yourself as a complement or alternative — not a replacement.' },
  { objection: 'Now isn\'t the right time.', response: 'Get specific. Ask: "What needs to change for it to become the right time?" Propose a future check-in date.' },
  { objection: 'Can you send me the deck?', response: 'Politely deflect. Say: "I\'d love to walk you through it live so I can answer your questions — how about a 15-minute call?"' },
]

const techFailureGuide = [
  { problem: 'Screen share won\'t work', fix: 'Have a PDF of the deck ready to email. Share your screen via a second link (Google Meet / Zoom backup).' },
  { problem: 'Audio cuts out', fix: 'Switch to phone audio. Dial-in number should be in the calendar invite. Pause and ask if everyone can hear.' },
  { problem: 'Miro / Mural not loading', fix: 'Take screenshots of the board beforehand. Share via screen share or email as a fallback.' },
  { problem: 'Link doesn\'t open', fix: 'Keep all links in a single pinned doc you can share in chat. Have a backup polling tool (e.g., Slido vs Menti).' },
  { problem: 'Camera fails', fix: 'Keep going — audio-only is fine. Announce "I\'ll turn my camera back on when it\'s working."' },
]

const STORAGE_KEY = 'exodia-meeting-playbook'
const TALK_SCRIPT_KEY = 'exodia-talk-script'
const QUICK_LINKS_KEY = 'exodia-quick-links'

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
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [labelEditValue, setLabelEditValue] = useState('')
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(() => {
    const saved = localStorage.getItem(QUICK_LINKS_KEY)
    if (saved) { try { return JSON.parse(saved) } catch {} }
    return defaultQuickLinks
  })
  const [editingLink, setEditingLink] = useState<string | null>(null)
  const [linkEditValue, setLinkEditValue] = useState('')
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings))
  }, [meetings])

  useEffect(() => {
    localStorage.setItem(TALK_SCRIPT_KEY, JSON.stringify(talkScripts))
  }, [talkScripts])

  useEffect(() => {
    localStorage.setItem(QUICK_LINKS_KEY, JSON.stringify(quickLinks))
  }, [quickLinks])

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

  const addScript = () => {
    const key = 'custom-' + Date.now()
    setTalkScripts(prev => [...prev, { key, label: 'New Block', text: 'Write your script here...' }])
  }

  const deleteScript = (key: string) => {
    if (talkScripts.length <= 1) return
    setTalkScripts(prev => prev.filter(s => s.key !== key))
    if (editingScript === key) { setEditingScript(null); setScriptEditValue('') }
    if (editingLabel === key) { setEditingLabel(null); setLabelEditValue('') }
  }

  const saveLabelEdit = () => {
    if (!editingLabel) return
    setTalkScripts(prev => prev.map(s => s.key === editingLabel ? { ...s, label: labelEditValue } : s))
    setEditingLabel(null)
    setLabelEditValue('')
  }

  const saveLinkEdit = () => {
    if (!editingLink) return
    setQuickLinks(prev => prev.map(l => l.id === editingLink ? { ...l, url: linkEditValue } : l))
    setEditingLink(null)
    setLinkEditValue('')
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

      {/* ZONE 1: THE LIVE COCKPIT */}
      {activeMeeting && (
        <div className="rounded-xl border mb-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          

          {/* Meeting Goal & North Star */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>North Star / Goal</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{activeMeeting.goal}</p>
          </div>

          {/* Run of Show */}
          <div className="px-5 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Run of Show — {activeMeeting.duration}</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>Click to edit</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 100 }}>Time</th>
                    <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Topic</th>
                    <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 130 }}>Speaker</th>
                    <th className="text-left py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Visual Cue</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMeeting.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                      {(['time', 'topic', 'speaker', 'tech'] as (keyof RunOfShowRow)[]).map(field => (
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

          {/* Quick-Link Asset Bar */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Quick-Link Assets</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map(link => (
                <div key={link.id} className="relative group">
                  <a
                    href={link.url || '#'}
                    target={link.url ? '_blank' : undefined}
                    rel={link.url ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: link.url ? 'var(--accent)' : 'var(--text-muted)',
                      border: '1px solid var(--border-primary)',
                      cursor: link.url ? 'pointer' : 'default',
                    }}
                    onClick={e => { if (!link.url) { e.preventDefault(); setEditingLink(link.id); setLinkEditValue(link.url) } }}
                  >
                    {link.label}
                    {link.url && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                  </a>
                  {editingLink === link.id ? (
                    <div className="absolute top-full left-0 mt-1 z-10 w-64">
                      <input
                        autoFocus
                        value={linkEditValue}
                        onChange={e => setLinkEditValue(e.target.value)}
                        onBlur={saveLinkEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveLinkEdit(); if (e.key === 'Escape') { setEditingLink(null); setLinkEditValue('') } }}
                        placeholder="Paste URL here..."
                        className="w-full px-3 py-2 rounded border outline-none text-xs"
                        style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  ) : (
                    <button
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                      style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                      onClick={() => { setEditingLink(link.id); setLinkEditValue(link.url) }}
                      title="Edit link"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* The Cheat Sheet (Collapsible) */}
          <div className="border-t" style={{ borderColor: 'var(--border-secondary)' }}>
            <button
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium transition"
              style={{ color: 'var(--text-primary)' }}
              onClick={() => setCheatSheetOpen(!cheatSheetOpen)}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>The Cheat Sheet</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Objection handling &amp; tech fails</span>
              </div>
              <svg className="w-4 h-4 transition" style={{ color: 'var(--text-muted)', transform: cheatSheetOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {cheatSheetOpen && (
              <div className="px-5 pb-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Objection Handling</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                          <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 200 }}>Objection</th>
                          <th className="text-left py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Response</th>
                        </tr>
                      </thead>
                      <tbody>
                        {objectionHandlingRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                            <td className="py-2 pr-3 align-top font-medium" style={{ color: 'var(--text-primary)' }}>{row.objection}</td>
                            <td className="py-2 align-top" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{row.response}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>What to Do If Tech Fails</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                          <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 200 }}>Problem</th>
                          <th className="text-left py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Fix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {techFailureGuide.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                            <td className="py-2 pr-3 align-top font-medium" style={{ color: 'var(--text-primary)' }}>{row.problem}</td>
                            <td className="py-2 align-top" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{row.fix}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
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
                {editingLabel === script.key ? (
                  <input
                    autoFocus
                    value={labelEditValue}
                    onChange={e => setLabelEditValue(e.target.value)}
                    onBlur={saveLabelEdit}
                    onKeyDown={e => { if (e.key === 'Enter') saveLabelEdit(); if (e.key === 'Escape') { setEditingLabel(null); setLabelEditValue('') } }}
                    className="px-2 py-0.5 rounded border outline-none text-xs font-semibold"
                    style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                ) : (
                  <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => { setEditingLabel(script.key); setLabelEditValue(script.label) }}>{script.label}</h3>
                )}
                {talkScripts.length > 1 && (
                  <button
                    className="ml-auto p-1 rounded transition hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => deleteScript(script.key)}
                    title="Delete block"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
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
        <button
          className="mt-4 w-full py-2 rounded-lg text-xs font-medium transition border border-dashed"
          style={{ color: 'var(--accent)', borderColor: 'var(--border-primary)', backgroundColor: 'transparent' }}
          onClick={addScript}
        >
          + Add block
        </button>
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