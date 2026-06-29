import { useNavigate } from 'react-router-dom'

export default function Presentation() {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="fixed inset-0 flex items-center justify-center z-10">
        <button
          onClick={() => navigate('/login')}
          className="relative transition-all duration-500 hover:scale-110 group"
        >
          <div className="absolute inset-0 rounded-2xl transition-all duration-500" style={{ backgroundColor: 'rgba(255,89,0,0.1)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,89,0,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 60px rgba(255,89,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)' }} />
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500" style={{ backgroundColor: 'rgba(255,89,0,0.08)', boxShadow: '0 0 80px rgba(255,89,0,0.3)' }} />
          <div className="relative flex items-center gap-3 px-10 py-5">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
              <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span className="text-lg font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Get Started
            </span>
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
              <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  )
}