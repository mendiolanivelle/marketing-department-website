import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDE_COUNT = 85
const AUTO_ADVANCE_MS = 5000

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
@keyframes thumbEnter {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: translateY(0); }
}
`

export default function PublicShowcase() {
  const [current, setCurrent] = useState(1)
  const [loaded, setLoaded] = useState<Set<number>>(new Set([1, 2, 3]))
  const [loginClicks, setLoginClicks] = useState(0)
  const [loginTimer, setLoginTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [showGrid, setShowGrid] = useState(false)
  const [autoPaused, setAutoPaused] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setAutoPaused(true)
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    autoTimerRef.current = setTimeout(() => setAutoPaused(false), 8000)
  }, [current, preloadAdjacent])

  useEffect(() => { preloadAdjacent(1) }, [preloadAdjacent])

  // Auto-advance
  useEffect(() => {
    if (showGrid || autoPaused) return
    const timer = setInterval(() => {
      setCurrent(prev => {
        const next = prev >= SLIDE_COUNT ? 1 : prev + 1
        preloadAdjacent(next)
        return next
      })
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [showGrid, autoPaused, preloadAdjacent])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(current + 1) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(current - 1) }
      if (e.key === 'g' || e.key === 'G') setShowGrid(prev => !prev)
      if (e.key === 'Escape') setShowGrid(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [current, goTo])

  // Click left/right thirds
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (showGrid) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const third = rect.width / 3
    if (x < third) goTo(current - 1)
    else if (x > rect.width - third) goTo(current + 1)
  }, [showGrid, current, goTo])

  const handleSecretClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setLoginClicks(prev => {
      const next = prev + 1
      if (next >= 3) { setLoginClicks(0); navigate('/login'); return 0 }
      if (loginTimer) clearTimeout(loginTimer)
      setLoginTimer(setTimeout(() => setLoginClicks(0), 1000))
      return next
    })
  }, [navigate, loginTimer])

  const thumbnailCols = 10
  const thumbnailRows = Math.ceil(SLIDE_COUNT / thumbnailCols)

  return (
    <>
      <style>{styles}</style>
      <div
        ref={containerRef}
        className="fixed inset-0 overflow-hidden select-none"
        style={{ backgroundColor: '#1B1A1C' }}
        onClick={handleClick}
      >
        {/* Kinetic background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '50%', borderRadius: '40% 60% 70% 30% / 50% 40% 60% 50%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.25, filter: 'blur(80px)', animation: 'float1 20s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '-8%', width: '45%', height: '55%', borderRadius: '60% 40% 30% 70% / 40% 60% 40% 60%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.2, filter: 'blur(90px)', animation: 'float2 25s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '20%', right: '-5%', width: '30%', height: '60%', borderRadius: '50% 50% 30% 70% / 60% 30% 70% 40%', background: 'radial-gradient(ellipse, #3E404860 0%, transparent 70%)', opacity: 0.15, filter: 'blur(70px)', animation: 'float3 22s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '25%', height: '30%', borderRadius: '30% 70% 50% 50% / 40% 40% 60% 60%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.12, filter: 'blur(60px)', animation: 'float1 28s ease-in-out infinite reverse' }} />
          <div style={{ position: 'absolute', top: '40%', left: '40%', width: '20%', height: '20%', borderRadius: '50%', background: 'radial-gradient(circle, #3E4048 0%, transparent 70%)', opacity: 0.1, filter: 'blur(50px)', animation: 'pulseGlow 6s ease-in-out infinite' }} />
        </div>

        {/* ====== GRID OVERVIEW MODE ====== */}
        {showGrid ? (
          <div
            className="fixed inset-0 z-50 overflow-y-auto p-4"
            style={{ backgroundColor: 'rgba(27,26,28,0.95)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="grid gap-2 mx-auto"
              style={{
                gridTemplateColumns: `repeat(${thumbnailCols}, 1fr)`,
                maxWidth: `${thumbnailCols * 100 + (thumbnailCols - 1) * 8}px`,
                animation: 'thumbEnter 0.3s ease-out',
              }}
            >
              {Array.from({ length: SLIDE_COUNT }, (_, i) => i + 1).map(n => (
                <div
                  key={n}
                  onClick={() => { setShowGrid(false); goTo(n) }}
                  className="aspect-square overflow-hidden rounded-lg cursor-pointer transition-transform duration-200 hover:scale-105 hover:ring-2 hover:ring-[#FF5900]/50"
                  style={{ opacity: n === current ? 1 : 0.6 }}
                >
                  <img
                    src={`/portfolio/${n}.jpg`}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
              <button
                onClick={() => setShowGrid(false)}
                className="px-5 py-2 text-xs tracking-widest uppercase rounded-full border transition"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' }}
              >
                Close Grid
              </button>
            </div>
          </div>
        ) : (
          <>
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

            {/* Subtle edge gradient — no text overlay */}
            <div className="fixed inset-0 pointer-events-none z-20" style={{ background: 'linear-gradient(180deg, rgba(27,26,28,0.15) 0%, transparent 20%, transparent 80%, rgba(27,26,28,0.4) 100%)' }} />

            {/* Left nav hint — only visible on hover */}
            <div className="fixed left-0 top-0 bottom-0 w-1/3 z-30 pointer-events-none" />

            {/* Right nav hint */}
            <div className="fixed right-0 top-0 bottom-0 w-1/3 z-30 pointer-events-none" />

            {/* Progress bar */}
            <div className="fixed bottom-0 left-0 right-0 h-[2px] z-30" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full transition-all duration-500 ease-out" style={{ width: `${(current / SLIDE_COUNT) * 100}%`, backgroundColor: 'rgba(255,89,0,0.5)' }} />
            </div>

            {/* Grid toggle hint — tiny pill bottom-center */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <span className="text-white/[0.06] text-[9px] tracking-[0.3em] uppercase select-none">Press G for grid</span>
            </div>
          </>
        )}

        {/* Secret login hotspot */}
        <div
          onClick={handleSecretClick}
          className="fixed bottom-0 right-0 z-40 w-8 h-8 flex items-center justify-center cursor-crosshair"
          title=""
        >
          <span className="text-white/[0.06] text-[10px] hover:text-white/20 transition-colors duration-500 select-none">◈</span>
        </div>
      </div>
    </>
  )
}