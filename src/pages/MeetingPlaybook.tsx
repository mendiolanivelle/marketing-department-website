import { useState } from 'react'

export default function MeetingPlaybook() {
  const [activeTab, setActiveTab] = useState<'playbook' | 'templates' | 'notes'>('playbook')

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
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Client meeting guides, templates, and best practices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'playbook', label: 'Playbook', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
          { key: 'templates', label: 'Email Templates', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
          { key: 'notes', label: 'Meeting Notes', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition"
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--accent)' : 'var(--bg-card)',
              color: activeTab === tab.key ? '#FFFFFF' : 'var(--text-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} /></svg>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'playbook' && (
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
      )}

      {activeTab === 'templates' && (
        <div className="text-center py-16 rounded-2xl border-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Email templates coming soon</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Use the Messaging page to create and manage email templates.</p>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="text-center py-16 rounded-2xl border-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Meeting notes coming soon</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Save and organize notes from client meetings here.</p>
        </div>
      )}
    </div>
  )
}