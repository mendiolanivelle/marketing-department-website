import './Team.css'

const teamMembers = [
  {
    name: 'Sarah Chen',
    role: 'VP of Marketing',
    bio: 'Leads department strategy and oversees all marketing operations. 15 years of B2B marketing experience.',
    initials: 'SC'
  },
  {
    name: 'Marcus Johnson',
    role: 'Creative Director',
    bio: 'Manages the brand and creative team. Ensures visual consistency across all company materials.',
    initials: 'MJ'
  },
  {
    name: 'Emily Rodriguez',
    role: 'Digital Marketing Manager',
    bio: 'Owns paid media, SEO, and marketing automation. Drives our demand generation engine.',
    initials: 'ER'
  },
  {
    name: 'David Kim',
    role: 'Content Lead',
    bio: 'Oversees blog, whitepapers, case studies, and sales enablement content across all channels.',
    initials: 'DK'
  },
  {
    name: 'Lisa Patel',
    role: 'Social Media & Comms',
    bio: 'Manages company social channels, employee advocacy, and internal communications.',
    initials: 'LP'
  },
  {
    name: 'James Wilson',
    role: 'Marketing Analytics',
    bio: 'Builds dashboards, tracks KPIs, and provides data-driven insights to the team and leadership.',
    initials: 'JW'
  },
  {
    name: 'Anna Kowalski',
    role: 'Event Coordinator',
    bio: 'Plans and executes company events, webinars, trade shows, and conference participation.',
    initials: 'AK'
  },
  {
    name: 'Ryan Thompson',
    role: 'Marketing Operations',
    bio: 'Manages marketing tech stack, CRM integrations, and process automation for the department.',
    initials: 'RT'
  }
]

function Team() {
  return (
    <div className="team-page">
      <section className="page-hero">
        <h1>Our Team</h1>
        <p>Meet the Marketing department team members</p>
      </section>

      <section className="team-section">
        <div className="team-container">
          <div className="team-grid">
            {teamMembers.map((member, index) => (
              <div key={index} className="team-card">
                <div className="team-avatar">
                  <span>{member.initials}</span>
                </div>
                <h3>{member.name}</h3>
                <span className="team-role">{member.role}</span>
                <p>{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="join-section">
        <div className="team-container">
          <h2>Open Roles</h2>
          <p>We're currently hiring for the following positions within the Marketing department. Reach out to Sarah Chen or HR for more details.</p>
          <div className="open-roles">
            <div className="role-card">
              <h4>Marketing Coordinator</h4>
              <span>Full-time &middot; Hybrid</span>
            </div>
            <div className="role-card">
              <h4>Senior Content Strategist</h4>
              <span>Full-time &middot; Remote</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Team
