import { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const categories = [
  {
    name: 'General',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { path: '/team', label: 'Team & Directory', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { path: '/calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { path: '/files', label: 'File Tracker', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
  {
    name: 'Client Acquisition',
    items: [
      { path: '/timeline', label: 'Timeline', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { path: '/leads', label: 'Lead Generation', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
      { path: '/templates', label: 'Messaging', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
      { path: '/acceptance-criteria', label: 'Acceptance Criteria Form', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    name: 'Talent Acquisition',
    items: [
      { path: '/campaigns', label: 'Campaigns', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z' },
      { path: '/requests', label: 'Marketing Requests', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl shadow-lg border theme-transition hover:scale-105 active:scale-95 transition-transform duration-150"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        <svg className="w-5 h-5" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg>
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 transition-opacity duration-300"
          style={{ backgroundColor: 'var(--bg-overlay)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen border-r z-40 theme-transition
        transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:sticky lg:top-0 lg:translate-x-0 lg:z-0
        ${isCollapsed ? 'w-16' : 'w-64'}
      `} style={{ backgroundColor: '#1B1A1C', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex flex-col h-full">
          {/* Logo + Profile section */}
          <div className="px-3 pt-5 pb-4 border-b theme-transition" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 transition-transform duration-200 hover:scale-105"
                  style={{ backgroundColor: '#FF5900' }}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <h1 className="text-base truncate" style={{ color: '#FFFFFF', fontWeight: 700 }}>Marketing Dept</h1>
                    <p className="text-[11px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>Internal Portal</p>
                  </div>
                )}
              </div>
              {/* Collapse toggle */}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden group lg:flex p-1.5 rounded-lg transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95"
                style={{ color: 'rgba(255,255,255,0.5)' }}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCollapsed ? 'M13 5l7 7-7 7' : 'M11 19l-7-7 7-7'} />
                </svg>
              </button>
            </div>

            {/* Profile */}
            {user && (
              <div className="relative px-1">
                <div
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className={`flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-200 theme-transition ${
                    isCollapsed ? 'justify-center py-2.5' : 'px-3 py-2'
                  }`}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,89,0,0.2)'
                    e.currentTarget.style.transform = 'scale(1.01)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  <div className="relative flex-shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-9 h-9 rounded-full object-cover cursor-pointer border-2 transition-transform duration-200 hover:scale-105"
                        style={{ borderColor: '#FF5900' }}
                        onClick={(e) => { e.stopPropagation(); setShowAvatarModal(true) }}
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 transition-transform duration-200 hover:scale-105"
                        style={{ backgroundColor: '#FF5900', borderColor: '#FF5900' }}
                        onClick={(e) => { e.stopPropagation(); setShowAvatarModal(true) }}
                      >
                        <span className="text-sm text-white" style={{ fontWeight: 600 }}>
                          {getDisplayName().charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </div>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: '#FFFFFF', fontWeight: 500 }}>
                          {getDisplayName()}
                        </p>
                        <p className="text-[10px] truncate tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>
                          {user.email}
                        </p>
                      </div>
                      <svg className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200" style={{ color: 'rgba(255,255,255,0.5)', transform: showProfileDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
                          <div className="w-24 h-24 rounded-full flex items-center justify-center border-4" style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}>
                            <span className="text-3xl text-white" style={{ fontWeight: 700 }}>{getDisplayName().charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <button onClick={() => { fileInputRef.current?.click(); setShowAvatarModal(false) }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98]" style={{ backgroundColor: 'var(--accent)', color: 'white', fontWeight: 500 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                        </button>
                        {avatarUrl && (
                          <button onClick={handleRemoveAvatar} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 hover:opacity-80 active:scale-[0.98]" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Remove Photo
                          </button>
                        )}
                        <button onClick={() => setShowAvatarModal(false)} className="w-full px-4 py-2.5 rounded-xl transition-all duration-200" style={{ backgroundColor: 'transparent', color: 'var(--text-tertiary)', fontWeight: 500 }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div
                    className="absolute top-full left-4 right-4 mt-2 rounded-xl border shadow-lg theme-transition z-50 overflow-hidden"
                    style={{ backgroundColor: '#1B1A1C', borderColor: 'rgba(255,255,255,0.12)', boxShadow: 'var(--shadow-lg)' }}
                  >
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:pl-5"
                      style={{ color: '#FF5900', fontWeight: 500 }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <nav className="flex-1 px-2.5 py-5 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.name} className="mb-4">
                {!isCollapsed && (
                  <p className="px-4 pb-1 text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                    {category.name}
                  </p>
                )}
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const active = isActive(item.path)
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`group flex items-center gap-3 rounded-xl transition-all duration-200 theme-transition relative ${
                          isCollapsed ? 'justify-center py-3' : 'px-4 py-2.5'
                        }`}
                        style={{
                          color: active ? '#FF5900' : 'rgba(255,255,255,0.7)',
                          backgroundColor: active ? 'rgba(255,89,0,0.15)' : 'transparent',
                          fontWeight: active ? 500 : 300,
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.color = '#FFFFFF'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                          }
                        }}
                        title={isCollapsed ? item.label : undefined}
                      >
                        {active && !isCollapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                            style={{ backgroundColor: '#FF5900' }}
                          />
                        )}
                        <svg className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${!active && 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                        {!isCollapsed && (
                          <span className="text-xs truncate">{item.label}</span>
                        )}
                        {active && isCollapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                            style={{ backgroundColor: '#FF5900' }}
                          />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom accent bar */}
          <div className="px-3 pb-4">
            <div className="h-px rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      </aside>
    </>
  )
}