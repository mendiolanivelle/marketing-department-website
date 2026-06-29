import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const styles = `
@keyframes folderIn {
  0% { opacity: 0; transform: scale(0.6); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes btnAppear {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes zoomInBurst {
  0% { opacity: 0; }
  30% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
`

type Phase = 'intro' | 'opening' | 'zoom-in' | 'ended'

export default function PublicShowcase() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [showBtn, setShowBtn] = useState(false)
  const navigate = useNavigate()

  // Start sequence: intro -> opening -> zoom-in -> ended
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('opening'), 2000)
    const t2 = setTimeout(() => setPhase('zoom-in'), 3400)
    const t3 = setTimeout(() => {
      setPhase('ended')
      setShowBtn(true)
    }, 5000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const showFolder = phase === 'intro' || phase === 'opening'
  const folderAnim = 'folderIn 1.2s ease-out forwards'

  return (
    <>
      <style>{styles}</style>
      <div className="fixed inset-0 overflow-hidden select-none" style={{ backgroundColor: '#1B1A1C' }}>
        {/* ====== FOLDER ANIMATION ====== */}
        {showFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div
              style={{
                width: 220,
                height: 170,
                animation: folderAnim,
                position: 'relative',
                filter: phase === 'intro'
                  ? 'drop-shadow(0 0 40px rgba(255,89,0,0.4)) drop-shadow(0 0 80px rgba(255,89,0,0.2))'
                  : 'drop-shadow(0 0 60px rgba(255,89,0,0.7)) drop-shadow(0 0 120px rgba(255,89,0,0.4))',
                transition: 'filter 1.2s ease-in-out',
              }}
            >
              <div className="absolute bottom-0 left-0 right-0 rounded-br-2xl rounded-bl-2xl" style={{ height: '80%', backgroundColor: '#FF5900', borderRadius: '0 0 16px 16px', boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.2)' }} />
              <div className="absolute top-0 left-0 right-0" style={{ height: '55%', backgroundColor: '#FF5900', borderRadius: '16px 16px 0 0', transformOrigin: 'bottom center', transform: phase === 'opening' ? 'perspective(800px) rotateX(-120deg)' : 'perspective(800px) rotateX(0deg)', transition: 'transform 1.2s ease-in-out', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.15)', zIndex: 2 }} />
              <div className="absolute" style={{ top: -12, left: '50%', transform: 'translateX(-50%)', width: 50, height: 16, backgroundColor: '#FF5900', borderRadius: '6px 6px 0 0', zIndex: 3 }} />
            </div>
          </div>
        )}

        {/* ====== ZOOM-IN TRANSITION ====== */}
        {phase === 'zoom-in' && (
          <div className="fixed inset-0 z-50" style={{ backgroundColor: '#FF5900', animation: 'zoomInBurst 1.6s ease-in-out forwards' }} />
        )}

        {/* ====== GET STARTED ====== */}
        {phase === 'ended' && showBtn && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10" style={{ backgroundColor: '#1B1A1C' }}>
            <div className="absolute" style={{ width: 500, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,89,0,0.12) 0%, transparent 70%)', filter: 'blur(50px)' }} />
            <button
              onClick={() => navigate('/login')}
              className="relative transition-all duration-500 hover:scale-110 group"
              style={{ animation: 'btnAppear 2s ease-out' }}
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
        )}
      </div>
    </>
  )
}