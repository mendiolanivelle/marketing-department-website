import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()

  const isActive = (path: string) => location.pathname === path ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'

  return (
    <nav className="bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-18">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <span className="text-indigo-600 text-2xl">&#9670;</span>
            Marketing Dept
          </Link>

          <button
            className="md:hidden flex flex-col gap-1.5 p-1"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className={`w-6 h-0.5 bg-gray-700 rounded transition-transform ${isOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`w-6 h-0.5 bg-gray-700 rounded transition-opacity ${isOpen ? 'opacity-0' : ''}`}></span>
            <span className={`w-6 h-0.5 bg-gray-700 rounded transition-transform ${isOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>

          <ul className={`${isOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row absolute md:relative top-18 md:top-0 left-0 right-0 bg-white md:bg-transparent border-b md:border-0 border-gray-200 md:gap-2 p-4 md:p-0`}>
            <li>
              <Link to="/" className={`block px-4 py-2 rounded-lg font-medium text-sm transition ${isActive('/')}`} onClick={() => setIsOpen(false)}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/about" className={`block px-4 py-2 rounded-lg font-medium text-sm transition ${isActive('/about')}`} onClick={() => setIsOpen(false)}>
                About
              </Link>
            </li>
            <li>
              <Link to="/services" className={`block px-4 py-2 rounded-lg font-medium text-sm transition ${isActive('/services')}`} onClick={() => setIsOpen(false)}>
                Services
              </Link>
            </li>
            <li>
              <Link to="/team" className={`block px-4 py-2 rounded-lg font-medium text-sm transition ${isActive('/team')}`} onClick={() => setIsOpen(false)}>
                Team
              </Link>
            </li>
            <li>
              <Link to="/contact" className={`block px-4 py-2 rounded-lg font-medium text-sm transition ${isActive('/contact')}`} onClick={() => setIsOpen(false)}>
                Contact
              </Link>
            </li>
            {user && (
              <li>
                <button
                  onClick={() => signOut()}
                  className="block w-full text-left px-4 py-2 rounded-lg font-medium text-sm text-red-600 hover:bg-red-50 transition"
                >
                  Sign Out
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  )
}
