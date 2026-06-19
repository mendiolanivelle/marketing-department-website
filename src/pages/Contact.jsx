import { useState } from 'react'
import './Contact.css'

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    requestType: '',
    priority: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    setFormData({ name: '', department: '', requestType: '', priority: '', message: '' })
    setTimeout(() => setSubmitted(false), 5000)
  }

  return (
    <div className="contact-page">
      <section className="page-hero">
        <h1>Contact the Team</h1>
        <p>Submit a request, ask a question, or get in touch with the Marketing department</p>
      </section>

      <section className="contact-section">
        <div className="contact-container">
          <div className="contact-info">
            <h2>Reach Out</h2>
            <p>Need marketing support? Have a question about brand guidelines? Want to discuss a campaign idea? Use the form or reach us through the channels below.</p>
            
            <div className="contact-details">
              <div className="contact-item">
                <div className="contact-icon">&#128231;</div>
                <div>
                  <h4>Email</h4>
                  <p>marketing@company.com</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">&#128172;</div>
                <div>
                  <h4>Slack Channel</h4>
                  <p>#marketing-requests</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">&#128205;</div>
                <div>
                  <h4>Office Location</h4>
                  <p>Floor 4, Room 412</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">&#128336;</div>
                <div>
                  <h4>Office Hours</h4>
                  <p>Mon - Fri: 9:00 AM - 5:30 PM</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">&#128197;</div>
                <div>
                  <h4>Book a Meeting</h4>
                  <p> calendly.com/company/marketing</p>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-form-wrapper">
            {submitted && (
              <div className="success-message">
                Request submitted! We'll review it and get back to you within 1-2 business days.
              </div>
            )}
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Your Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="department">Your Department</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g. Sales, Product, Engineering"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="requestType">Request Type</label>
                <select
                  id="requestType"
                  name="requestType"
                  value={formData.requestType}
                  onChange={handleChange}
                >
                  <option value="">Select a request type</option>
                  <option value="campaign">Campaign Support</option>
                  <option value="content">Content / Copywriting</option>
                  <option value="brand">Brand Assets / Guidelines</option>
                  <option value="social">Social Media</option>
                  <option value="event">Event / Webinar</option>
                  <option value="analytics">Analytics / Reporting</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="">Select priority</option>
                  <option value="low">Low - No rush</option>
                  <option value="medium">Medium - Within 2 weeks</option>
                  <option value="high">High - Within 1 week</option>
                  <option value="urgent">Urgent - ASAP</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">Details</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Describe your request, goals, timeline, and any relevant context..."
                  rows="5"
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary submit-btn">Submit Request</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
