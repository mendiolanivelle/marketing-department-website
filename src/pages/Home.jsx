import { Link } from 'react-router-dom'
import './Home.css'

const announcements = [
  { id: 1, title: 'Q3 Campaign Planning Kickoff', date: 'Jun 25, 2026', tag: 'Meeting' },
  { id: 2, title: 'New Brand Guidelines v2.0 Released', date: 'Jun 20, 2026', tag: 'Update' },
  { id: 3, title: 'Marketing Offsite - July 10-12', date: 'Jun 18, 2026', tag: 'Event' },
  { id: 4, title: 'Annual Review Submissions Due July 1', date: 'Jun 15, 2026', tag: 'Deadline' },
]

const quickLinks = [
  { label: 'Submit Campaign Request', icon: '&#128221;', href: '/contact' },
  { label: 'Brand Assets & Guidelines', icon: '&#128193;', href: '/resources' },
  { label: 'Campaign Calendar', icon: '&#128197;', href: '#' },
  { label: 'Performance Dashboard', icon: '&#128200;', href: '#' },
  { label: 'Content Templates', icon: '&#128196;', href: '#' },
  { label: 'Team Wiki', icon: '&#128218;', href: '#' },
]

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to the <span className="gradient-text">Marketing Hub</span></h1>
          <p>Your central portal for department resources, campaign requests, brand assets, and team updates.</p>
          <div className="hero-buttons">
            <Link to="/contact" className="btn btn-primary">Submit a Request</Link>
            <Link to="/services" className="btn btn-secondary">Our Services</Link>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-container">
          <div className="dashboard-grid">
            <div className="dashboard-card announcements-card">
              <h2>&#128227; Announcements</h2>
              <ul className="announcements-list">
                {announcements.map((item) => (
                  <li key={item.id}>
                    <div className="announcement-info">
                      <span className="announcement-tag">{item.tag}</span>
                      <span className="announcement-title">{item.title}</span>
                    </div>
                    <span className="announcement-date">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="dashboard-card quick-links-card">
              <h2>&#128279; Quick Links</h2>
              <div className="quick-links-grid">
                {quickLinks.map((link, i) => (
                  <a key={i} href={link.href} className="quick-link">
                    <span className="quick-link-icon" dangerouslySetInnerHTML={{ __html: link.icon }}></span>
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-container">
          <h2>Department Highlights</h2>
          <p className="section-subtitle">Key metrics and focus areas for this quarter</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">&#127919;</div>
              <h3>Active Campaigns</h3>
              <p>12 campaigns currently running across digital, print, and event channels.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#127912;</div>
              <h3>Brand Refresh</h3>
              <p>New brand guidelines v2.0 are live. Review the updated assets and templates.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#128200;</div>
              <h3>Q2 Results</h3>
              <p>Lead generation up 23% and engagement rate improved by 18% quarter-over-quarter.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#129309;</div>
              <h3>Cross-Team Collab</h3>
              <p>Working with Sales, Product, and Customer Success on the Q3 go-to-market plan.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
