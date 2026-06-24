import { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/about', label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/services', label: 'Services', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { path: '/timeline', label: 'Timeline', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { path: '/leads', label: 'Lead Generation', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { path: '/contact', label: 'Contact', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { path: '/templates', label: 'Message Templates', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/reach-out', label: 'Reach Out', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
]

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const saved = localStorage.getItem('user-avatar')
    return saved || null
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const { user, signOut } = useAuth()

  const isActive = (path: string) => location.pathname === path

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setAvatarUrl(result)
        localStorage.setItem('user-avatar', result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl(null)
    localStorage.removeItem('user-avatar')
    setShowAvatarModal(false)
  }

  const getDisplayName = () => {
    if (!user?.email) return 'User'
    const email = user.email.split('@')[0]
    const parts = email.split(/[._-]/)
    if (parts.length >= 2) {
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
    }
    return email.charAt(0).toUpperCase() + email.slice(1)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg border theme-transition"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
      >
        <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg>
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ backgroundColor: 'var(--bg-overlay)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen border-r z-40 theme-transition
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:sticky lg:top-0 lg:translate-x-0 lg:z-0
        ${isCollapsed ? 'w-16' : 'w-64'}
      `} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="flex flex-col h-full">
          {/* Logo + Profile section */}
          <div className="px-4 py-6 border-b theme-transition" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                  style={{ backgroundColor: 'var(--logo-bg)' }}
                >
                  <span className="text-white text-xl" style={{ fontWeight: 700 }}>&#9670;</span>
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <h1 className="text-lg truncate" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Marketing Dept</h1>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Internal Portal</p>
                  </div>
                )}
              </div>
              {/* Collapse toggle - only visible on desktop */}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex p-1.5 rounded-lg transition flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCollapsed ? 'M13 5l7 7-7 7' : 'M11 19l-7-7 7-7'} />
                </svg>
              </button>
            </div>

            {/* Profile - moved below logo */}
            {user && (
              <div className="relative">
                <div
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className={`flex items-center gap-3 rounded-lg cursor-pointer transition-all theme-transition ${isCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2'}`}
                  style={{ backgroundColor: 'var(--bg-hover)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-light)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
                >
                  <div className="relative flex-shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full object-cover cursor-pointer border-2"
                        style={{ borderColor: 'var(--accent)' }}
                        onClick={(e) => { e.stopPropagation(); setShowAvatarModal(true) }}
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-2"
                        style={{ backgroundColor: 'var(--btn-primary-bg)', borderColor: 'var(--accent)' }}
                        onClick={(e) => { e.stopPropagation(); setShowAvatarModal(true) }}
                      >
                        <span className="text-sm" style={{ color: 'var(--btn-primary-text)', fontWeight: 500 }}>
                          {getDisplayName().charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </div>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {getDisplayName()}
                        </p>
                      </div>
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showProfileDropdown ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                      </svg>
                    </>
                  )}
                </div>

                {/* Avatar Modal */}
                {showAvatarModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)' }} onClick={() => setShowAvatarModal(false)}>
                    <div className="relative rounded-2xl border p-6 max-w-sm w-full theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
                      <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Profile Photo</h3>
                      <div className="flex justify-center mb-4">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Current Avatar" className="w-24 h-24 rounded-full object-cover border-4" style={{ borderColor: 'var(--accent)' }} />
                        ) : (
                          <div className="w-24 h-24 rounded-full flex items-center justify-center border-4" style={{ backgroundColor: 'var(--btn-primary-bg)', borderColor: 'var(--accent)' }}>
                            <span className="text-3xl" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>{getDisplayName().charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <button onClick={() => { fileInputRef.current?.click(); setShowAvatarModal(false) }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ backgroundColor: 'var(--accent)', color: 'white', fontWeight: 500 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                        </button>
                        {avatarUrl && (
                          <button onClick={handleRemoveAvatar} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Remove Photo
                          </button>
                        )}
                        <button onClick={() => setShowAvatarModal(false)} className="w-full px-4 py-2.5 rounded-lg transition-all" style={{ backgroundColor: 'transparent', color: 'var(--text-tertiary)', fontWeight: 500 }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div
                    className="absolute top-full left-4 right-4 mt-2 rounded-lg border shadow-lg theme-transition z-50"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}
                  >
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all"
                      style={{ color: 'var(--accent)', fontWeight: 500 }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-light)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg transition-all theme-transition ${isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'}`}
                  style={active
                    ? {
                        borderLeft: isCollapsed ? 'none' : '3px solid var(--accent)',
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--accent-light)',
                        fontWeight: 500,
                      }
                    : {
                        color: 'var(--text-secondary)',
                        fontWeight: 300,
                      }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>
    </>
  )
}