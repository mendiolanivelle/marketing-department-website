import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
              <span className="text-indigo-400">&#9670;</span>
              Marketing Department
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">
              Internal portal for the Marketing department. Access resources, submit requests, and stay up to date with team news.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Navigation</h4>
            <ul className="space-y-3">
              <li><Link to="/" className="text-sm text-gray-400 hover:text-indigo-400 transition">Dashboard</Link></li>
              <li><Link to="/about" className="text-sm text-gray-400 hover:text-indigo-400 transition">About Us</Link></li>
              <li><Link to="/services" className="text-sm text-gray-400 hover:text-indigo-400 transition">Services</Link></li>
              <li><Link to="/team" className="text-sm text-gray-400 hover:text-indigo-400 transition">Team</Link></li>
              <li><Link to="/contact" className="text-sm text-gray-400 hover:text-indigo-400 transition">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-gray-400 hover:text-indigo-400 transition">Brand Guidelines</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-indigo-400 transition">Template Library</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-indigo-400 transition">Campaign Calendar</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-indigo-400 transition">Performance Dashboard</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-indigo-400 transition">Team Wiki</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>marketing@company.com</li>
              <li>Slack: #marketing-requests</li>
              <li>Floor 4, Room 412</li>
              <li>Mon - Fri: 9AM - 5:30PM</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-sm text-gray-500">&copy; 2026 Marketing Department &middot; Internal Use Only</p>
        </div>
      </div>
    </footer>
  )
}
