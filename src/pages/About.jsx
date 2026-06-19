import './About.css'

function About() {
  return (
    <div className="about-page">
      <section className="page-hero">
        <h1>About Our Department</h1>
        <p>Learn about the Marketing department's mission, structure, and how we support the organization</p>
      </section>

      <section className="about-section">
        <div className="about-container">
          <div className="about-content">
            <h2>Who We Are</h2>
            <p>The Marketing Department is the internal team responsible for building and protecting the company brand, driving demand generation, and supporting all go-to-market initiatives across the organization.</p>
            <p>We partner with Sales, Product, Customer Success, and Leadership to develop strategies that align with company objectives and deliver measurable results. Our team of specialists covers brand, digital, content, analytics, and creative disciplines.</p>
          </div>
          <div className="about-image">
            <div className="placeholder-img">
              <span>&#127970;</span>
              <p>Marketing Department - Floor 4</p>
            </div>
          </div>
        </div>
      </section>

      <section className="values-section">
        <div className="about-container">
          <h2>Our Values</h2>
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon">&#128161;</div>
              <h3>Innovation</h3>
              <p>We experiment with new channels, tools, and approaches to stay ahead of market trends.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">&#129309;</div>
              <h3>Collaboration</h3>
              <p>We work cross-functionally and believe the best results come from diverse perspectives.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">&#127919;</div>
              <h3>Impact</h3>
              <p>Every initiative we undertake is tied to measurable business outcomes and company goals.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">&#128172;</div>
              <h3>Transparency</h3>
              <p>We share our plans, results, and learnings openly with the entire organization.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mission-section">
        <div className="about-container">
          <div className="mission-grid">
            <div className="mission-card">
              <h3>Our Mission</h3>
              <p>To drive growth and brand awareness through data-driven marketing strategies that support every team in the organization and deliver measurable business impact.</p>
            </div>
            <div className="mission-card">
              <h3>Our Vision</h3>
              <p>To be recognized as a strategic partner within the company, setting the standard for marketing excellence and contributing directly to company-wide success.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="structure-section">
        <div className="about-container">
          <h2>Department Structure</h2>
          <div className="structure-grid">
            <div className="structure-card">
              <h3>Brand & Creative</h3>
              <p>Visual identity, design systems, brand guidelines, and creative asset production.</p>
            </div>
            <div className="structure-card">
              <h3>Digital & Growth</h3>
              <p>SEO, paid media, email marketing, marketing automation, and performance optimization.</p>
            </div>
            <div className="structure-card">
              <h3>Content & Communications</h3>
              <p>Blog, social media, internal communications, PR, and content strategy.</p>
            </div>
            <div className="structure-card">
              <h3>Analytics & Operations</h3>
              <p>Marketing analytics, reporting, budget management, and tool administration.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
