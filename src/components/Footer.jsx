import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h3><span className="logo-icon">&#9670;</span> Marketing Department</h3>
            <p>Internal portal for the Marketing department. Access resources, submit requests, and stay up to date with team news.</p>
          </div>
          <div className="footer-links">
            <h4>Navigation</h4>
            <ul>
              <li><Link to="/">Dashboard</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/team">Team</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Brand Guidelines</a></li>
              <li><a href="#">Template Library</a></li>
              <li><a href="#">Campaign Calendar</a></li>
              <li><a href="#">Performance Dashboard</a></li>
              <li><a href="#">Team Wiki</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Contact</h4>
            <ul>
              <li>marketing@company.com</li>
              <li>Slack: #marketing-requests</li>
              <li>Floor 4, Room 412</li>
              <li>Mon - Fri: 9AM - 5:30PM</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Marketing Department &middot; Internal Use Only</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
