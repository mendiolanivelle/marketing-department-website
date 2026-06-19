import './Team.css'

const teamMembers = [
  {
    name: 'Sarah Chen',
    role: 'Chief Executive Officer',
    bio: '15+ years leading marketing teams at Fortune 500 companies. Passionate about brand innovation.',
    initials: 'SC'
  },
  {
    name: 'Marcus Johnson',
    role: 'Creative Director',
    bio: 'Award-winning designer with a keen eye for visual storytelling and brand identity.',
    initials: 'MJ'
  },
  {
    name: 'Emily Rodriguez',
    role: 'Head of Digital Strategy',
    bio: 'Data-driven marketer specializing in performance marketing and growth strategies.',
    initials: 'ER'
  },
  {
    name: 'David Kim',
    role: 'Head of Content',
    bio: 'Former journalist turned content strategist. Expert in narrative-driven marketing.',
    initials: 'DK'
  },
  {
    name: 'Lisa Patel',
    role: 'Social Media Manager',
    bio: 'Community builder with expertise in influencer marketing and viral campaigns.',
    initials: 'LP'
  },
  {
    name: 'James Wilson',
    role: 'Analytics Director',
    bio: 'Data scientist turned marketer. Turns complex data into actionable marketing insights.',
    initials: 'JW'
  },
  {
    name: 'Anna Kowalski',
    role: 'Account Director',
    bio: 'Client relationship expert ensuring every project exceeds expectations.',
    initials: 'AK'
  },
  {
    name: 'Ryan Thompson',
    role: 'Web Development Lead',
    bio: 'Full-stack developer creating stunning, high-performance digital experiences.',
    initials: 'RT'
  }
]

function Team() {
  return (
    <div className="team-page">
      <section className="page-hero">
        <h1>Our Team</h1>
        <p>Meet the talented people behind our success</p>
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
          <h2>Join Our Team</h2>
          <p>We're always looking for talented, passionate people to join our growing team. If you love marketing and want to make an impact, we'd love to hear from you.</p>
          <a href="mailto:careers@exodiamarketing.com" className="btn btn-primary">View Open Positions</a>
        </div>
      </section>
    </div>
  )
}

export default Team
