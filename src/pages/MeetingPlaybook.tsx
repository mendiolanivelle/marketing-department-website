export default function MeetingPlaybook() {
  const runOfShow = [
    { time: '0:00 – 2:00', topic: 'Open & Welcome', speaker: 'Account Executive', action: 'Brief intro, set the agenda, confirm meeting length', tech: 'Screen share with agenda slide visible' },
    { time: '2:00 – 5:00', topic: 'Client Introductions', speaker: 'All', action: 'Each attendee shares their role and what they hope to get out of the meeting', tech: 'Keep slide on agenda' },
    { time: '5:00 – 7:00', topic: 'Context Recap', speaker: 'Account Executive', action: 'Briefly recap how we got here — previous conversations, submitted forms, etc.', tech: 'Show timeline or summary doc' },
    { time: '7:00 – 22:00', topic: 'Discovery Questions', speaker: 'Account Executive', action: 'Ask prepared questions about pain points, goals, timeline, budget, decision criteria', tech: 'Shared notes doc or CRM screen' },
    { time: '22:00 – 25:00', topic: 'Buffer / Follow-up Questions', speaker: 'All', action: 'Catch any missed topics, dig deeper on key answers', tech: 'Same as above' },
    { time: '25:00 – 35:00', topic: 'Exodia Capabilities Overview', speaker: 'Account Executive', action: 'Show 2-3 relevant case studies aligned to their needs. Connect features to their pain points.', tech: 'Slide deck with case studies ready' },
    { time: '35:00 – 38:00', topic: 'Q&A', speaker: 'All', action: 'Open floor for client questions', tech: 'Stay on slide deck or switch to blank' },
    { time: '38:00 – 42:00', topic: 'Next Steps & Timeline', speaker: 'Account Executive', action: 'Propose concrete next steps: proposal date, follow-up meeting, internal review', tech: 'Show timeline slide with milestones' },
    { time: '42:00 – 45:00', topic: 'Close', speaker: 'Account Executive', action: 'Summarize key takeaways, confirm next steps, thank attendees', tech: 'End screen with contact info' },
  ]

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

      {/* Run of Show */}
      <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Run of Show — 45-min Discovery Call</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Goal: Understand client pain points, qualify the lead, and set clear next steps</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>Template</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 100 }}>Time</th>
                <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Topic</th>
                <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)', width: 130 }}>Speaker</th>
                <th className="text-left py-2.5 pr-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Key Action / Goal</th>
                <th className="text-left py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Tech / Visual Cues</th>
              </tr>
            </thead>
            <tbody>
              {runOfShow.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <td className="py-2.5 pr-3 align-top whitespace-nowrap" style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'monospace' }}>{row.time}</td>
                  <td className="py-2.5 pr-3 align-top font-medium" style={{ color: 'var(--text-primary)' }}>{row.topic}</td>
                  <td className="py-2.5 pr-3 align-top" style={{ color: 'var(--text-secondary)' }}>{row.speaker}</td>
                  <td className="py-2.5 pr-3 align-top" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{row.action}</td>
                  <td className="py-2.5 align-top" style={{ color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>{row.tech}</td>
                </tr>
              ))}
            </tbody>
          </table>
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