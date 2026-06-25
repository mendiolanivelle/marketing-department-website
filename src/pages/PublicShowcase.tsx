import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDE_COUNT = 85

const styles = `
@keyframes float1 {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { transform: translate(70px, -50px) rotate(5deg) scale(1.05); }
  50% { transform: translate(-40px, 30px) rotate(-3deg) scale(0.95); }
  75% { transform: translate(50px, 40px) rotate(4deg) scale(1.02); }
}
@keyframes float2 {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  33% { transform: translate(-60px, 40px) rotate(-6deg) scale(0.97); }
  66% { transform: translate(50px, -30px) rotate(4deg) scale(1.06); }
}
@keyframes float3 {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(-50px, -40px) rotate(-4deg); }
  50% { transform: translate(40px, 50px) rotate(6deg); }
  75% { transform: translate(-30px, -20px) rotate(-2deg); }
}
@keyframes pulseGlow {
  0%, 100% { opacity: 0.08; transform: scale(1); }
  50% { opacity: 0.18; transform: scale(1.1); }
}
`

const sectionLabels: Record<string, string> = {
  '1': 'ABOUT EXODIA',
  '15': 'OUR SERVICES',
  '25': 'PORTFOLIO',
  '40': 'TIMELINE',
  '55': 'LEAD GENERATION',
  '70': 'CONTACT',
}

function getLabel(n: number): string {
  const keys = Object.keys(sectionLabels).map(Number).sort((a, b) => a - b)
  let label = ''
  for (const k of keys) {
    if (n >= k) label = sectionLabels[k]
  }
  return label
}

export default function PublicShowcase() {
  const [current, setCurrent] = useState(1)
  const [loaded, setLoaded] = useState<Set<number>>(new Set([1, 2, 3]))
  const [loginClicks, setLoginClicks] = useState(0)
  const [loginTimer, setLoginTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const preloadAdjacent = useCallback((n: number) => {
    setLoaded(prev => {
      const next = new Set(prev)
      for (let i = Math.max(1, n - 2); i <= Math.min(SLIDE_COUNT, n + 2); i++) next.add(i)
      return next
    })
  }, [])

  const goTo = useCallback((n: number) => {
    const target = Math.max(1, Math.min(SLIDE_COUNT, n))
    if (target === current) return
    setCurrent(target)
    preloadAdjacent(target)
  }, [current, preloadAdjacent])

  useEffect(() => { preloadAdjacent(1) }, [preloadAdjacent])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(current - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [current, goTo])

  // Click left/right halves
  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    if (x < rect.width / 2) goTo(current - 1)
    else goTo(current + 1)
  }, [current, goTo])

  // Secret login: triple-click on bottom-right hotspot
  const handleSecretClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setLoginClicks(prev => {
      const next = prev + 1
      if (next >= 3) {
        setLoginClicks(0)
        navigate('/login')
        return 0
      }
      if (loginTimer) clearTimeout(loginTimer)
      setLoginTimer(setTimeout(() => setLoginClicks(0), 1000))
      return next
    })
  }, [navigate, loginTimer])

  return (
    <>
      <style>{styles}</style>
      <div
        ref={containerRef}
        className="fixed inset-0 overflow-hidden select-none"
        style={{ backgroundColor: '#1B1A1C', cursor: 'pointer' }}
        onClick={handleClick}
      >
        {/* Kinetic background shapes */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '50%', borderRadius: '40% 60% 70% 30% / 50% 40% 60% 50%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.25, filter: 'blur(80px)', animation: 'float1 20s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '-8%', width: '45%', height: '55%', borderRadius: '60% 40% 30% 70% / 40% 60% 40% 60%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.2, filter: 'blur(90px)', animation: 'float2 25s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '20%', right: '-5%', width: '30%', height: '60%', borderRadius: '50% 50% 30% 70% / 60% 30% 70% 40%', background: 'radial-gradient(ellipse, #3E404860 0%, transparent 70%)', opacity: 0.15, filter: 'blur(70px)', animation: 'float3 22s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '25%', height: '30%', borderRadius: '30% 70% 50% 50% / 40% 40% 60% 60%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.12, filter: 'blur(60px)', animation: 'float1 28s ease-in-out infinite reverse' }} />
          <div style={{ position: 'absolute', top: '40%', left: '40%', width: '20%', height: '20%', borderRadius: '50%', background: 'radial-gradient(circle, #3E4048 0%, transparent 70%)', opacity: 0.1, filter: 'blur(50px)', animation: 'pulseGlow 6s ease-in-out infinite' }} />
        </div>

        {/* Slides */}
        {Array.from(loaded).map(n => (
          <div
            key={n}
            className={`fixed inset-0 transition-all duration-700 ease-in-out ${n === current ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 pointer-events-none z-0'}`}
          >
            <img
              src={`/portfolio/${n}.jpg`}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
        ))}

        {/* Dark gradient overlay for text readability */}
        <div className="fixed inset-0 pointer-events-none z-20" style={{ background: 'linear-gradient(180deg, rgba(27,26,28,0.3) 0%, transparent 30%, transparent 70%, rgba(27,26,28,0.6) 100%)' }} />

        {/* Section label - large typography */}
        {getLabel(current) && (
          <div className="fixed top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <span className="inline-block text-xs tracking-[0.4em] font-light" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.4em' }}>
              {getLabel(current)}
            </span>
          </div>
        )}

        {/* Slide counter */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <span className="text-white/20 text-xs font-mono tracking-widest">
            {String(current).padStart(2, '0')} / {String(SLIDE_COUNT).padStart(2, '0')}
          </span>
        </div>

        {/* Progress bar */}
        <div className="fixed bottom-0 left-0 right-0 h-[2px] z-30" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full transition-all duration-500 ease-out" style={{ width: `${(current / SLIDE_COUNT) * 100}%`, backgroundColor: 'rgba(255,89,0,0.5)' }} />
        </div>

        {/* Secret login hotspot */}
        <div
          onClick={handleSecretClick}
          className="fixed bottom-0 right-0 z-40 w-8 h-8 flex items-center justify-center cursor-crosshair"
          title=""
        >
          <span className="text-white/[0.07] text-[10px] hover:text-white/20 transition-colors duration-500 select-none">◈</span>
        </div>
      </div>
    </>
  )
}