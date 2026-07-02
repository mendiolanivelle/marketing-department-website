const colors = [
  { bg: 'from-[#FF5900] to-[#FF8C33]', ring: 'ring-[#FF5900]/20' },
  { bg: 'from-[#2563EB] to-[#60A5FA]', ring: 'ring-[#2563EB]/20' },
  { bg: 'from-[#0B8043] to-[#34D399]', ring: 'ring-[#0B8043]/20' },
  { bg: 'from-[#7C3AED] to-[#A78BFA]', ring: 'ring-[#7C3AED]/20' },
  { bg: 'from-[#DC2626] to-[#F87171]', ring: 'ring-[#DC2626]/20' },
  { bg: 'from-[#0891B2] to-[#22D3EE]', ring: 'ring-[#0891B2]/20' },
  { bg: 'from-[#D97706] to-[#FBBF24]', ring: 'ring-[#D97706]/20' },
  { bg: 'from-[#BE185D] to-[#F472B6]', ring: 'ring-[#BE185D]/20' },
]

const teamMembers = [
  { name: 'Sarah Chen', role: 'VP of Marketing', bio: 'Leads department strategy and oversees all marketing operations. 15 years of B2B marketing experience.', initials: 'SC' },
  { name: 'Marcus Johnson', role: 'Creative Director', bio: 'Manages the brand and creative team. Ensures visual consistency across all company materials.', initials: 'MJ' },
  { name: 'Emily Rodriguez', role: 'Digital Marketing Manager', bio: 'Owns paid media, SEO, and marketing automation. Drives our demand generation engine.', initials: 'ER' },
  { name: 'David Kim', role: 'Content Lead', bio: 'Oversees blog, whitepapers, case studies, and sales enablement content across all channels.', initials: 'DK' },
  { name: 'Lisa Patel', role: 'Social Media & Comms', bio: 'Manages company social channels, employee advocacy, and internal communications.', initials: 'LP' },
  { name: 'James Wilson', role: 'Marketing Analytics', bio: 'Builds dashboards, tracks KPIs, and provides data-driven insights to the team and leadership.', initials: 'JW' },
  { name: 'Anna Kowalski', role: 'Event Coordinator', bio: 'Plans and executes company events, webinars, trade shows, and conference participation.', initials: 'AK' },
  { name: 'Ryan Thompson', role: 'Marketing Operations', bio: 'Manages marketing tech stack, CRM integrations, and process automation for the department.', initials: 'RT' },
]

export default function Team() {
  return (
    <div>
      {/* Header */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-20 px-4 sm:px-6 text-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #1B1A1C 0%, #2D2B2E 50%, #1B1A1C 100%)' }}>
        <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(circle at 30% 50%, #FF5900 0%, transparent 50%), radial-gradient(circle at 70% 50%, #2563EB 0%, transparent 50%)' }}></div>
        <div className="relative max-w-3xl mx-auto">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg, #FF5900, #FF8C33)' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-3 tracking-tight" style={{ color: '#FFFFFF' }}>Our Team</h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>
            Meet the Marketing department team members
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366, #FF8C33, #FF5900)' }}></div>
      </section>

      {/* Team Grid */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="group rounded-2xl p-6 sm:p-8 text-center transition-all duration-300 hover:-translate-y-1.5 cursor-default"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: '0 4px 20px rgba(27,26,28,0.06)',
                }}
              >
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${colors[index].bg} flex items-center justify-center mx-auto mb-5 ring-4 ${colors[index].ring} transition-transform duration-300 group-hover:scale-110`}>
                  <span className="text-white text-xl font-bold">{member.initials}</span>
                </div>
                <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{member.name}</h3>
                <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
                  {member.role}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Roles */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #FF5900, #FF8C33)' }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Open Roles</h2>
          <p className="text-sm sm:text-base mb-8 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            We're currently hiring for the following positions within the Marketing department. Reach out to Sarah Chen or HR for more details.
          </p>
          <div className="flex flex-col gap-3 max-w-lg mx-auto">
            {[
              { title: 'Marketing Coordinator', type: 'Full-time · Hybrid' },
              { title: 'Senior Content Strategist', type: 'Full-time · Remote' },
            ].map((role, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 rounded-xl transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: '0 2px 12px rgba(27,26,28,0.04)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent), #FF8C33)' }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{role.title}</h4>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{role.type}</span>
                  </div>
                </div>
                <button
                  className="px-4 py-2 text-xs text-white rounded-lg font-medium transition hover:opacity-90 flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}