import './Services.css'

const services = [
  {
    icon: '&#127919;',
    title: 'Brand Guidelines & Assets',
    description: 'Access approved brand templates, logos, color palettes, typography, and usage guidelines for all internal and external materials.',
    features: ['Logo Files', 'Template Library', 'Style Guides', 'Presentation Templates']
  },
  {
    icon: '&#128187;',
    title: 'Campaign Support',
    description: 'Submit a request and our team will help plan, create, and execute marketing campaigns for your product launches or initiatives.',
    features: ['Campaign Planning', 'Asset Creation', 'Channel Strategy', 'Launch Support']
  },
  {
    icon: '&#128241;',
    title: 'Social Media',
    description: 'We manage all company social channels. Submit content requests or coordinate with us for team announcements and thought leadership.',
    features: ['Content Requests', 'LinkedIn Posts', 'Employee Advocacy', 'Crisis Comms']
  },
  {
    icon: '&#9997;',
    title: 'Content & Copywriting',
    description: 'Need blog posts, whitepapers, case studies, or sales collateral? Our content team creates compelling materials for every stage of the funnel.',
    features: ['Blog Posts', 'Case Studies', 'Sales Collateral', 'Whitepapers']
  },
  {
    icon: '&#128200;',
    title: 'Analytics & Reporting',
    description: 'Access marketing dashboards, request custom reports, or schedule a walkthrough of our performance data and KPIs.',
    features: ['Performance Dashboards', 'Custom Reports', 'KPI Tracking', 'Data Walkthroughs']
  },
  {
    icon: '&#127758;',
    title: 'Event & Webinar Support',
    description: 'Planning an internal event, webinar, or conference presence? We handle promotion, logistics, and post-event follow-up.',
    features: ['Event Promotion', 'Webinar Setup', 'Conference Planning', 'Post-Event Reports']
  }
]

function Services() {
  return (
    <div className="services-page">
      <section className="page-hero">
        <h1>Department Services</h1>
        <p>What the Marketing team can do for you and your team</p>
      </section>

      <section className="services-section">
        <div className="services-container">
          <div className="services-grid">
            {services.map((service, index) => (
              <div key={index} className="service-card">
                <div className="service-icon" dangerouslySetInnerHTML={{ __html: service.icon }}></div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <ul className="service-features">
                  {service.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="process-section">
        <div className="services-container">
          <h2>How to Request Our Help</h2>
          <p className="section-subtitle">Our standard workflow for handling internal requests</p>
          <div className="process-steps">
            <div className="process-step">
              <div className="step-number">01</div>
              <h3>Submit a Request</h3>
              <p>Fill out the contact form with details about your project, timeline, and goals.</p>
            </div>
            <div className="process-step">
              <div className="step-number">02</div>
              <h3>Intake Meeting</h3>
              <p>We'll schedule a brief call to align on scope, deliverables, and expectations.</p>
            </div>
            <div className="process-step">
              <div className="step-number">03</div>
              <h3>Execution</h3>
              <p>Our team gets to work. You'll receive regular updates and review checkpoints.</p>
            </div>
            <div className="process-step">
              <div className="step-number">04</div>
              <h3>Delivery & Review</h3>
              <p>We deliver final assets and gather feedback to improve future collaborations.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Services
