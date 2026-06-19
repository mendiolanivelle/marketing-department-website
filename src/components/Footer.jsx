import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h3><span className="logo-icon">&#9670;</span> Exodia Marketing</h3>
            <p>Transforming brands through innovative marketing strategies and creative excellence.</p>
            <div className="social-links">
              <a href="#" aria-label="Twitter">&#120143;</a>
              <a href="#" aria-label="LinkedIn">in</a>
              <a href="#" aria-label="Instagram">&#9737;</a>
            </div>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/team">Our Team</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Services</h4>
            <ul>
              <li><Link to="/services">Brand Strategy</Link></li>
              <li><Link to="/services">Digital Marketing</Link></li>
              <li><Link to="/services">Content Creation</Link></li>
              <li><Link to="/services">Social Media</Link></li>
              <li><Link to="/services">Analytics</Link></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Contact</h4>
            <ul>
              <li>hello@exodiamarketing.com</li>
              <li>+1 (555) 123-4567</li>
              <li>123 Creative Ave, Suite 400</li>
              <li>New York, NY 10001</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Exodia Marketing. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
