import { useState } from 'react'
import './Contact.css'

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    service: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    setFormData({ name: '', email: '', company: '', service: '', message: '' })
    setTimeout(() => setSubmitted(false), 5000)
  }

  return (
    <div className="contact-page">
      <section className="page-hero">
        <h1>Contact Us</h1>
        <p>Ready to start your next project? Get in touch with our team</p>
      </section>

      <section className="contact-section">
        <div className="contact-container">
          <div className="contact-info">
            <h2>Get In Touch</h2>
            <p>Have a question or want to discuss a project? We'd love to hear from you. Fill out the form or reach out directly.</p>
            
            <div className="contact-details">
              <div className="contact-item">
                <div className="contact-icon">&#128205;</div>
                <div>
                  <h4>Visit Us</h4>
                  <p>123 Creative Ave, Suite 400<br />New York, NY 10001</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">&#128231;</div>
                <div>
                  <h4>Email Us</h4>
                  <p>hello@exodiamarketing.com</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">&#128222;</div>
                <div>
                  <h4>Call Us</h4>
                  <p>+1 (555) 123-4567</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">&#128336;</div>
                <div>
                  <h4>Business Hours</h4>
                  <p>Mon - Fri: 9:00 AM - 6:00 PM EST</p>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-form-wrapper">
            {submitted && (
              <div className="success-message">
                Thank you! Your message has been sent. We'll get back to you soon.
              </div>
            )}
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@company.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="company">Company</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Your Company"
                />
              </div>
              <div className="form-group">
                <label htmlFor="service">Service Interested In</label>
                <select
                  id="service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                >
                  <option value="">Select a service</option>
                  <option value="brand-strategy">Brand Strategy</option>
                  <option value="digital-marketing">Digital Marketing</option>
                  <option value="social-media">Social Media Management</option>
                  <option value="content-creation">Content Creation</option>
                  <option value="analytics">Analytics & Reporting</option>
                  <option value="web-development">Web Development</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us about your project..."
                  rows="5"
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary submit-btn">Send Message</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
