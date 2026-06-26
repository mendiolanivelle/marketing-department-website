import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDE_COUNT = 85
const AUTO_ADVANCE_MS = 15000

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
@keyframes folderIn {
  0% { opacity: 0; transform: scale(0.6); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes folderOut {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.6); }
}
@keyframes flapOpen {
  0% { transform: perspective(800px) rotateX(0deg); }
  100% { transform: perspective(800px) rotateX(-120deg); }
}
@keyframes flapClose {
  0% { transform: perspective(800px) rotateX(-120deg); }
  100% { transform: perspective(800px) rotateX(0deg); }
}
@keyframes glowPulse {
  0% { opacity: 0; transform: scale(1); }
  30% { opacity: 0.8; transform: scale(1.2); }
  60% { opacity: 0.3; transform: scale(1.5); }
  100% { opacity: 0; transform: scale(2); }
}
@keyframes flashIn {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes btnAppear {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes folderClose {
  0% { transform: perspective(800px) rotateX(-120deg); }
  100% { transform: perspective(800px) rotateX(0deg); }
}
@keyframes cursorAppear {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes cursorMoveToFolder {
  0% { transform: translate(0, 0); }
  100% { transform: translate(-30vw, 30vh); }
}
@keyframes cursorClick {
  0%, 100% { transform: translate(-30vw, 30vh) scale(1); }
  40% { transform: translate(-30vw, calc(30vh + 4px)) scale(0.9); }
  60% { transform: translate(-30vw, calc(30vh + 4px)) scale(0.9); }
}
`

type Phase = 'intro' | 'opening' | 'slideshow' | 'closing' | 'flash' | 'ended'

export default function PublicShowcase() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [current, setCurrent] = useState(1)
  const [loaded, setLoaded] = useState<Set<number>>(new Set([1, 2, 3]))
  const [loginClicks, setLoginClicks] = useState(0)
  const [loginTimer, setLoginTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [autoPaused, setAutoPaused] = useState(false)
  const [restartCount, setRestartCount] = useState(0)
  const [imagesReady, setImagesReady] = useState(false)
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const [showLeftHint, setShowLeftHint] = useState(false)
  const [showRightHint, setShowRightHint] = useState(false)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Preload actual images using browser Image API
  useEffect(() => {
    let cancelled = false
    let loaded = 0
    const total = 3
    const check = () => { loaded++; if (loaded >= total && !cancelled) setImagesReady(true) }
    for (let i = 1; i <= total; i++) {
      const img = new Image()
      img.onload = check
      img.onerror = check
      img.src = `/portfolio/${i}.jpg`
    }
    return () => { cancelled = true }
  }, [restartCount])

  const preloadAll = useCallback(() => {
    setLoaded(prev => {
      const next = new Set(prev)
      for (let i = 1; i <= SLIDE_COUNT; i++) next.add(i)
      return next
    })
  }, [])

  const preloadAdjacent = useCallback((n: number) => {
    setLoaded(prev => {
      const next = new Set(prev)
      for (let i = Math.max(1, n - 2); i <= Math.min(SLIDE_COUNT, n + 2); i++) next.add(i)
      return next
    })
  }, [])

  const goTo = useCallback((n: number) => {
    if (phase !== 'slideshow') return
    const target = Math.max(1, Math.min(SLIDE_COUNT, n))
    if (target === current) return
    setCurrent(target)
    preloadAdjacent(target)
    setAutoPaused(true)
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    autoTimerRef.current = setTimeout(() => setAutoPaused(false), 8000)
  }, [phase, current, preloadAdjacent])

  // Start sequence ΓÇö wait for images to actually load before slideshow
  useEffect(() => {
    preloadAll()
    const t1 = setTimeout(() => setPhase('opening'), 4000)
    const t2 = setTimeout(() => {
      if (imagesReady) setPhase('slideshow')
      else {
        const poll = setInterval(() => {
          if (imagesReady) { clearInterval(poll); setPhase('slideshow') }
        }, 100)
        setTimeout(() => clearInterval(poll), 10000)
      }
    }, 5200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [restartCount, preloadAll, imagesReady])

  // Auto-advance during slideshow ΓÇö stays on last slide, does not auto-close
  useEffect(() => {
    if (phase !== 'slideshow' || autoPaused) return
    const timer = setInterval(() => {
      setCurrent(prev => {
        if (prev >= SLIDE_COUNT) return prev
        const next = prev + 1
        preloadAdjacent(next)
        return next
      })
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [phase, autoPaused, preloadAdjacent])

  // After last slide, wait 3s then flash
  useEffect(() => {
    if (phase !== 'slideshow' || current < SLIDE_COUNT) return
    const timer = setTimeout(() => setPhase('flash'), 3000)
    return () => clearTimeout(timer)
  }, [phase, current])

  // Flash animation ΓåÆ closing folder
  useEffect(() => {
    if (phase !== 'flash') return
    const t1 = setTimeout(() => setPhase('closing'), 1200)
    return () => clearTimeout(t1)
  }, [phase])

  // Closing folder ΓåÆ ended button
  useEffect(() => {
    if (phase !== 'closing') return
    const t1 = setTimeout(() => setPhase('ended'), 2000)
    return () => clearTimeout(t1)
  }, [phase])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase !== 'slideshow') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(current + 1) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(current - 1) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [phase, current, goTo])

  // Click left/right thirds during slideshow
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (phase !== 'slideshow') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const third = rect.width / 3
    if (x < third) goTo(current - 1)
    else if (x > rect.width - third) goTo(current + 1)
  }, [phase, current, goTo])

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

  // Mouse parallax + edge hints
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (phase !== 'slideshow') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMouse({ x, y })
    const third = rect.width / 3
    const cx = e.clientX - rect.left
    if (cx < third) { setShowLeftHint(true); setShowRightHint(false) }
    else if (cx > rect.width - third) { setShowLeftHint(false); setShowRightHint(true) }
    else { setShowLeftHint(false); setShowRightHint(false) }
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    hintTimerRef.current = setTimeout(() => { setShowLeftHint(false); setShowRightHint(false) }, 2000)
  }, [phase])

  // Drag/swipe to navigate
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (phase !== 'slideshow') return
    setDragStart(e.clientX)
  }, [phase])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (phase !== 'slideshow' || dragStart === null) return
    const diff = e.clientX - dragStart
    if (Math.abs(diff) > 50) {
      if (diff < 0) goTo(current + 1)
      else goTo(current - 1)
    }
    setDragStart(null)
  }, [phase, dragStart, current, goTo])

  const restartShowcase = () => {
    setPhase('intro')
    setCurrent(1)
    setRestartCount(c => c + 1)
  }

  const showFolder = phase === 'intro' || phase === 'opening'
  const folderAnim = 'folderIn 1.2s ease-out forwards'

  return (
    <>
      <style>{styles}</style>
      <div
        ref={containerRef}
        className="fixed inset-0 overflow-hidden select-none"
        style={{ backgroundColor: '#1B1A1C' }}
        onClick={handleClick}
      >
        {/* Kinetic background (visible during slideshow) */}
        {phase === 'slideshow' && (
          <div className="fixed inset-0 z-0 pointer-events-none">
            <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '50%', borderRadius: '40% 60% 70% 30% / 50% 40% 60% 50%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.25, filter: 'blur(80px)', animation: 'float1 20s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', bottom: '-10%', right: '-8%', width: '45%', height: '55%', borderRadius: '60% 40% 30% 70% / 40% 60% 40% 60%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.2, filter: 'blur(90px)', animation: 'float2 25s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', top: '20%', right: '-5%', width: '30%', height: '60%', borderRadius: '50% 50% 30% 70% / 60% 30% 70% 40%', background: 'radial-gradient(ellipse, #3E404860 0%, transparent 70%)', opacity: 0.15, filter: 'blur(70px)', animation: 'float3 22s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '25%', height: '30%', borderRadius: '30% 70% 50% 50% / 40% 40% 60% 60%', background: 'radial-gradient(ellipse, #3E4048 0%, transparent 70%)', opacity: 0.12, filter: 'blur(60px)', animation: 'float1 28s ease-in-out infinite reverse' }} />
          </div>
        )}

        {/* ====== FOLDER ANIMATION ====== */}
        {showFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div
              style={{
                width: 220,
                height: 170,
                animation: folderAnim,
                position: 'relative',
              }}
            >
            {/* Folder body */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-br-2xl rounded-bl-2xl"
              style={{
                height: '80%',
                backgroundColor: '#FF5900',
                borderRadius: '0 0 16px 16px',
                boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.2)',
              }}
            />
            {/* Folder flap */}
            <div
              className="absolute top-0 left-0 right-0"
              style={{
                height: '55%',
                backgroundColor: '#FF5900',
                borderRadius: '16px 16px 0 0',
                transformOrigin: 'bottom center',
                transform: phase === 'opening' ? 'perspective(800px) rotateX(-120deg)' : 'perspective(800px) rotateX(0deg)',
                transition: 'transform 1.2s ease-in-out',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 2,
              }}
            />
            {/* Folder tab */}
            <div
              className="absolute"
              style={{
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 50,
                height: 16,
                backgroundColor: '#FF5900',
                borderRadius: '6px 6px 0 0',
                zIndex: 3,
              }}
            />
            {/* Mouse cursor that clicks the folder to open it */}
            {phase === 'intro' && (
              <div
                className="fixed"
                style={{
                  top: '20%',
                  left: '80%',
                  zIndex: 60,
                  animation: 'cursorAppear 0.3s ease-out 1.8s both, cursorMoveToFolder 1.2s ease-in-out 2.1s both, cursorClick 0.4s ease-in-out 3.3s both',
                  pointerEvents: 'none',
                }}
              >
                <svg viewBox="0 0 24 24" fill="rgba(255,89,0,0.95)" width="36" height="36" style={{ filter: 'drop-shadow(0 0 10px rgba(255,89,0,0.6))' }}>
                  <path d="M5.5 2.5v19l5.5-5.5H18l-5-5.5 5-5.5H11L5.5 2.5z" />
                </svg>
              </div>
            )}
            </div>
          </div>
        )}

        {/* ====== SLIDESHOW ====== */}
        {phase === 'slideshow' && (
          <div
            className="fixed inset-0"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setShowLeftHint(false); setShowRightHint(false); setDragStart(null) }}
          >
            {Array.from(loaded).map(n => (
              <div
                key={n}
                className={`fixed inset-0 transition-all duration-700 ease-in-out ${n === current ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 pointer-events-none z-0'}`}
              >
                <img
                  src={`/portfolio/${n}.jpg`}
                  alt=""
                  className="w-full h-full object-contain transition-transform duration-200 ease-out"
                  draggable={false}
                  style={n === current ? {
                    transform: `perspective(1200px) rotateX(${(mouse.y - 0.5) * -4}deg) rotateY(${(mouse.x - 0.5) * 4}deg) scale(1.03)`,
                  } : undefined}
                />
              </div>
            ))}
            <div className="fixed inset-0 pointer-events-none z-20" style={{ background: 'linear-gradient(180deg, rgba(27,26,28,0.15) 0%, transparent 20%, transparent 80%, rgba(27,26,28,0.4) 100%)' }} />
            <div className="fixed bottom-0 left-0 right-0 h-[2px] z-30" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full transition-all duration-500 ease-out" style={{ width: `${(current / SLIDE_COUNT) * 100}%`, backgroundColor: 'rgba(255,89,0,0.5)' }} />
            </div>
            {/* Left arrow hint */}
            <div
              className="fixed left-6 top-1/2 -translate-y-1/2 z-30 transition-all duration-400 pointer-events-none"
              style={{
                opacity: showLeftHint && current > 1 ? 1 : 0,
                transform: `translateY(-50%) translateX(${showLeftHint ? 0 : -10}px)`,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><path d="M15 19l-7-7 7-7"/></svg>
            </div>
            {/* Right arrow hint */}
            <div
              className="fixed right-6 top-1/2 -translate-y-1/2 z-30 transition-all duration-400 pointer-events-none"
              style={{
                opacity: showRightHint && current < SLIDE_COUNT ? 1 : 0,
                transform: `translateY(-50%) translateX(${showRightHint ? 0 : 10}px)`,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><path d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>
        )}

        {/* ====== CLOSING ΓÇö zoom back to folder ====== */}
        {phase === 'closing' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ backgroundColor: '#1B1A1C' }}>
            {/* Behind-folder glow */}
            <div
              className="absolute"
              style={{
                width: 280,
                height: 230,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,89,0,0.3) 0%, transparent 70%)',
                filter: 'blur(30px)',
                animation: 'folderOut 1.2s ease-in forwards',
                animationDelay: '0.3s',
              }}
            />
            <div
              style={{
                width: 220,
                height: 170,
                animation: 'folderOut 1.2s ease-in forwards',
                animationDelay: '0.3s',
                position: 'relative',
              }}
            >
              <div className="absolute bottom-0 left-0 right-0 rounded-br-2xl rounded-bl-2xl" style={{ height: '80%', backgroundColor: '#FF5900', borderRadius: '0 0 16px 16px' }} />
              <div className="absolute top-0 left-0 right-0" style={{ height: '55%', backgroundColor: '#FF5900', borderRadius: '16px 16px 0 0', transformOrigin: 'bottom center', animation: 'flapClose 1s ease-in-out forwards' }} />
              <div className="absolute" style={{ top: -12, left: '50%', transform: 'translateX(-50%)', width: 50, height: 16, backgroundColor: '#FF5900', borderRadius: '6px 6px 0 0', zIndex: 3 }} />
              {/* Orange glow burst when closing ΓÇö fades as flap closes */}
              <div
                className="absolute"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 320,
                  height: 220,
                  background: 'radial-gradient(ellipse, rgba(255,89,0,0.4) 0%, transparent 65%)',
                  opacity: 0.6,
                  transition: 'opacity 0.8s ease-in',
                }}
              />
            </div>
          </div>
        )}

        {/* ====== FLASH ====== */}
        {phase === 'flash' && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              backgroundColor: '#FF5900',
              animation: 'flashIn 1.2s ease-in-out forwards',
            }}
          >
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,89,0,0.8) 40%, transparent 70%)',
                filter: 'blur(30px)',
              }}
            />
          </div>
        )}

        {/* ====== ENDED ====== */}
        {phase === 'ended' && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10" style={{ backgroundColor: '#1B1A1C' }}>
            {/* Ambient glow behind button */}
            <div className="absolute" style={{ width: 500, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,89,0,0.12) 0%, transparent 70%)', filter: 'blur(50px)' }} />
            <button
              onClick={restartShowcase}
              className="relative transition-all duration-500 hover:scale-110 group"
              style={{
                animation: 'btnAppear 2s ease-out',
              }}
            >
              {/* Glass-morphism background */}
              <div
                className="absolute inset-0 rounded-2xl transition-all duration-500"
                style={{
                  backgroundColor: 'rgba(255,89,0,0.1)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,89,0,0.25)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 60px rgba(255,89,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              />
              {/* Hover glow overlay */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"
                style={{
                  backgroundColor: 'rgba(255,89,0,0.08)',
                  boxShadow: '0 0 80px rgba(255,89,0,0.3)',
                }}
              />
              {/* Content */}
              <div className="relative flex items-center gap-3 px-10 py-5">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-lg font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  See Exodia&apos;s Portfolio
                </span>
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* Secret login hotspot */}
        <div
          onClick={handleSecretClick}
          className="fixed bottom-0 right-0 z-50 w-8 h-8 flex items-center justify-center cursor-crosshair"
          title=""
        >
          <span className="text-white/[0.06] text-[10px] hover:text-white/20 transition-colors duration-500 select-none">Γùê</span>
        </div>
      </div>
    </>
  )
}
