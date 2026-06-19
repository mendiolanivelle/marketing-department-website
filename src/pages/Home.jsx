import { Link } from 'react-router-dom'
import './Home.css'

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">Award-Winning Marketing Agency</span>
          <h1>We Build Brands That <span className="gradient-text">Stand Out</span></h1>
          <p>Transform your business with data-driven marketing strategies, creative campaigns, and measurable results that drive growth.</p>
          <div className="hero-buttons">
            <Link to="/contact" className="btn btn-primary">Get Started</Link>
            <Link to="/services" className="btn btn-secondary">Our Services</Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-number">250+</span>
              <span className="stat-label">Projects Delivered</span>
            </div>
            <div className="stat">
              <span className="stat-number">98%</span>
              <span className="stat-label">Client Satisfaction</span>
            </div>
            <div className="stat">
              <span className="stat-number">15+</span>
              <span className="stat-label">Years Experience</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-container">
          <h2>Why Choose Us</h2>
          <p className="section-subtitle">We combine creativity with data to deliver marketing that works</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">&#127919;</div>
              <h3>Strategic Planning</h3>
              <p>Data-driven strategies tailored to your business goals and target audience.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#127912;</div>
              <h3>Creative Excellence</h3>
              <p>Compelling visuals and copy that capture attention and drive engagement.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#128200;</div>
              <h3>Measurable Results</h3>
              <p>Transparent reporting and analytics to track ROI and optimize performance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#129309;</div>
              <h3>Dedicated Support</h3>
              <p>A committed team that works alongside you as an extension of your business.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-container">
          <h2>Ready to Elevate Your Brand?</h2>
          <p>Let's discuss how we can help you achieve your marketing goals.</p>
          <Link to="/contact" className="btn btn-primary">Schedule a Consultation</Link>
        </div>
      </section>
    </div>
  )
}

export default Home
