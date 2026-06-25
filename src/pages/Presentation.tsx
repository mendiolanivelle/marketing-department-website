import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDE_COUNT = 85

const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = []

export default function Presentation() {
  const [current, setCurrent] = useState(1)
  const [loaded, setLoaded] = useState<Set<number>>(new Set([1, 2, 3]))
  const [overlay, setOverlay] = useState('')
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const [showParticles, setShowParticles] = useState(false)
  const [loginClicks, setLoginClicks] = useState(0)
  const [loginTimer, setLoginTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
    setShowParticles(false)
    requestAnimationFrame(() => setShowParticles(true))
    setOverlay(`Exodia — Slide ${target}`)
    setTimeout(() => setOverlay(''), 1200)
  }, [current, preloadAdjacent])

  useEffect(() => {
    preloadAdjacent(1)
  }, [preloadAdjacent])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(current - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [current, goTo])

  // Particle animation
  useEffect(() => {
    if (!showParticles || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 4,
        vy: -(Math.random() * 6 + 3),
        life: 0,
        maxLife: 60 + Math.random() * 60,
      })
    }

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++
      let alive = 0
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.life++
        if (p.life > p.maxLife) { particles.splice(i, 1); continue }
        alive++
        const alpha = 1 - p.life / p.maxLife
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 180, 50, ${alpha * 0.7})`
        ctx.fill()
      }
      if (alive > 0 || frame < 30) requestAnimationFrame(animate)
    }
    animate()
  }, [showParticles])

  // Secret login: triple-click on bottom-right invisible hotspot
  const handleSecretClick = useCallback(() => {
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

  const tiltStyle = {
    transform: `perspective(1200px) rotateX(${(mouse.y - 0.5) * -6}deg) rotateY(${(mouse.x - 0.5) * 6}deg) scale(1.02)`,
    transition: 'transform 0.15s ease-out',
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{ backgroundColor: '#0a0a0a' }}
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) setMouse({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height })
      }}
    >
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-20" />

      {/* Slide images — render only loaded slides, only current is visible */}
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
            style={n === current ? tiltStyle : undefined}
            draggable={false}
          />
        </div>
      ))}

      {/* Dark vignette overlay */}
      <div className="fixed inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }} />

      {/* Slide number overlay */}
      {overlay && (
        <div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none">
          <span className="text-white/15 text-[clamp(2rem,8vw,6rem)] font-light tracking-[0.3em] animate-pulse">
            {overlay}
          </span>
        </div>
      )}

      {/* Left arrow */}
      {current > 1 && (
        <button
          onClick={() => goTo(current - 1)}
          className="fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all duration-300"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}

      {/* Right arrow */}
      {current < SLIDE_COUNT && (
        <button
          onClick={() => goTo(current + 1)}
          className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all duration-300"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Progress dots */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
        {Array.from({ length: Math.min(9, Math.ceil(SLIDE_COUNT / 10)) }, (_, i) => {
          const segment = Math.ceil(SLIDE_COUNT / 9)
          const from = i * segment + 1
          const to = Math.min(SLIDE_COUNT, (i + 1) * segment)
          const isActive = current >= from && current <= to
          const isExact = current === from
          return (
            <button
              key={i}
              onClick={() => goTo(from)}
              className={`rounded-full transition-all duration-300 ${isActive ? 'w-3 h-3' : 'w-1.5 h-1.5'}`}
              style={{
                backgroundColor: isActive ? '#FF5900' : 'rgba(255,255,255,0.25)',
                boxShadow: isActive ? '0 0 12px rgba(255,89,0,0.6)' : 'none',
              }}
            />
          )
        })}
        <span className="text-white/30 text-[10px] ml-2 font-mono tracking-wider">{current}/{SLIDE_COUNT}</span>
      </div>

      {/* Hint text */}
      <div className="fixed bottom-6 right-6 z-30 text-white/15 text-[10px] tracking-widest uppercase pointer-events-none select-none">
        Arrow keys to navigate
      </div>

      {/* Secret login hotspot — bottom-right corner, barely visible ◈ symbol, triple-click to enter */}
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