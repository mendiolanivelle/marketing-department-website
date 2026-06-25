import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDE_COUNT = 85

export default function Presentation() {
  const [phase, setPhase] = useState<'collage' | 'slideshow'>('collage')
  const [current, setCurrent] = useState(1)
  const [loaded, setLoaded] = useState<Set<number>>(new Set([1, 2, 3]))
  const [loginClicks, setLoginClicks] = useState(0)
  const [loginTimer, setLoginTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const preloadAdjacent = useCallback((n: number) => {
    setLoaded(prev => {
      const next = new Set(prev)
      for (let i = Math.max(1, n - 1); i <= Math.min(SLIDE_COUNT, n + 1); i++) next.add(i)
      return next
    })
  }, [])

  const goTo = useCallback((n: number) => {
    const target = Math.max(1, Math.min(SLIDE_COUNT, n))
    if (target === current) return
    setCurrent(target)
    preloadAdjacent(target)
  }, [current, preloadAdjacent])

  // Auto-transition from collage to slideshow after 10s
  useEffect(() => {
    if (phase !== 'collage') return
    preloadAdjacent(1)
    const timer = setTimeout(() => {
      setPhase('slideshow')
      setCurrent(1)
    }, 10000)
    return () => clearTimeout(timer)
  }, [phase, preloadAdjacent])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase !== 'slideshow') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(current - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [phase, current, goTo])

  // Click left/right halves to navigate
  const handleScreenClick = useCallback((e: React.MouseEvent) => {
    if (phase !== 'slideshow') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    if (x < rect.width / 2) {
      goTo(current - 1)
    } else {
      goTo(current + 1)
    }
  }, [phase, current, goTo])

  // Secret login: triple-click on bottom-right invisible hotspot
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

  // Collage grid dimensions
  const cols = 10
  const rows = Math.ceil(SLIDE_COUNT / cols)

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{ backgroundColor: '#0a0a0a' }}
      onClick={handleScreenClick}
    >
      {/* ============ COLLAGE PHASE ============ */}
      {phase === 'collage' && (
        <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
          <div
            className="grid gap-1 w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
            }}
          >
            {Array.from({ length: SLIDE_COUNT }, (_, i) => i + 1).map(n => (
              <div key={n} className="overflow-hidden rounded" style={{ opacity: 0.7 }}>
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-white/40 text-3xl sm:text-5xl font-light tracking-[0.2em] animate-pulse">
              EXODIA
            </span>
          </div>
        </div>
      )}

      {/* ============ SLIDESHOW PHASE ============ */}
      {phase === 'slideshow' && (
        <>
          {Array.from(loaded).map(n => (
            <div
              key={n}
              className={`fixed inset-0 transition-all duration-700 ease-in-out ${n === current ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}
              style={{ zIndex: n === current ? 10 : 1 }}
            >
              <img
                src={`/portfolio/${n}.jpg`}
                alt={`Exodia Portfolio Slide ${n}`}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
          ))}

          <div className="fixed inset-0 pointer-events-none z-5" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }} />
        </>
      )}

      {/* Secret login hotspot — bottom-right corner */}
      <div
        onClick={handleSecretClick}
        className="fixed bottom-0 right-0 z-40 w-8 h-8 flex items-center justify-center cursor-crosshair"
        title=""
      >
        <span className="text-white/10 text-[10px] hover:text-white/30 transition-colors duration-500 select-none">◈</span>
      </div>
    </div>
  )
}