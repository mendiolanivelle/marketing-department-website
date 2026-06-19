import './Services.css'

const services = [
  {
    icon: '&#127919;',
    title: 'Brand Strategy',
    description: 'We develop comprehensive brand strategies that define your positioning, messaging, and visual identity to resonate with your target audience.',
    features: ['Brand Positioning', 'Market Research', 'Competitive Analysis', 'Brand Guidelines']
  },
  {
    icon: '&#128187;',
    title: 'Digital Marketing',
    description: 'Full-service digital marketing campaigns across search, display, and programmatic channels to maximize your online presence.',
    features: ['SEO/SEM', 'PPC Advertising', 'Email Marketing', 'Marketing Automation']
  },
  {
    icon: '&#128241;',
    title: 'Social Media Management',
    description: 'Strategic social media management that builds communities, drives engagement, and converts followers into customers.',
    features: ['Content Calendar', 'Community Management', 'Influencer Partnerships', 'Paid Social']
  },
  {
    icon: '&#9997;',
    title: 'Content Creation',
    description: 'Compelling content that tells your brand story and engages your audience across all channels and formats.',
    features: ['Copywriting', 'Video Production', 'Graphic Design', 'Blog & Articles']
  },
  {
    icon: '&#128200;',
    title: 'Analytics & Reporting',
    description: 'Data-driven insights and comprehensive reporting to measure performance and optimize your marketing ROI.',
    features: ['Performance Dashboards', 'ROI Tracking', 'A/B Testing', 'Conversion Optimization']
  },
  {
    icon: '&#127758;',
    title: 'Web Development',
    description: 'Modern, responsive websites and landing pages designed to convert visitors into leads and customers.',
    features: ['UI/UX Design', 'Responsive Development', 'E-commerce', 'CMS Integration']
  }
]

function Services() {
  return (
    <div className="services-page">
      <section className="page-hero">
        <h1>Our Services</h1>
        <p>Comprehensive marketing solutions tailored to your business needs</p>
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
          <h2>Our Process</h2>
          <p className="section-subtitle">A proven approach to delivering exceptional results</p>
          <div className="process-steps">
            <div className="process-step">
              <div className="step-number">01</div>
              <h3>Discovery</h3>
              <p>We learn about your business, goals, and target audience to build a solid foundation.</p>
            </div>
            <div className="process-step">
              <div className="step-number">02</div>
              <h3>Strategy</h3>
              <p>We develop a customized marketing strategy aligned with your objectives and budget.</p>
            </div>
            <div className="process-step">
              <div className="step-number">03</div>
              <h3>Execution</h3>
              <p>Our team brings the strategy to life with creative campaigns and precision targeting.</p>
            </div>
            <div className="process-step">
              <div className="step-number">04</div>
              <h3>Optimization</h3>
              <p>We continuously monitor, analyze, and refine to maximize performance and ROI.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Services
