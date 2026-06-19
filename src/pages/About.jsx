import './About.css'

function About() {
  return (
    <div className="about-page">
      <section className="page-hero">
        <h1>About Us</h1>
        <p>Learn about our mission, values, and the story behind Exodia Marketing</p>
      </section>

      <section className="about-section">
        <div className="about-container">
          <div className="about-content">
            <h2>Our Story</h2>
            <p>Founded in 2010, Exodia Marketing began with a simple belief: every brand has a unique story worth telling. What started as a small team of passionate marketers has grown into a full-service agency serving clients across the globe.</p>
            <p>Over the past 15 years, we've helped hundreds of businesses transform their digital presence, build meaningful connections with their audiences, and achieve sustainable growth through innovative marketing strategies.</p>
          </div>
          <div className="about-image">
            <div className="placeholder-img">
              <span>&#127970;</span>
              <p>Our Office</p>
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
              <p>We stay ahead of trends and embrace new technologies to deliver cutting-edge solutions.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">&#129309;</div>
              <h3>Partnership</h3>
              <p>We work as an extension of your team, committed to your success every step of the way.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">&#127919;</div>
              <h3>Excellence</h3>
              <p>We hold ourselves to the highest standards in everything we do, from strategy to execution.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">&#128172;</div>
              <h3>Transparency</h3>
              <p>Open communication and honest reporting are the foundation of our client relationships.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mission-section">
        <div className="about-container">
          <div className="mission-grid">
            <div className="mission-card">
              <h3>Our Mission</h3>
              <p>To empower brands with innovative marketing solutions that drive measurable growth and create lasting impact in the digital landscape.</p>
            </div>
            <div className="mission-card">
              <h3>Our Vision</h3>
              <p>To be the most trusted and innovative marketing partner for businesses worldwide, setting new standards for creativity and results.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
