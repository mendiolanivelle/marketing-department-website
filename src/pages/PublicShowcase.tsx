import { useState, useEffect } from 'react'

const styles = `
@keyframes folderIn {
  0% { opacity: 0; transform: scale(0.6); }
  100% { opacity: 1; transform: scale(1); }
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

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('opening'), 2000)
    const t2 = setTimeout(() => setPhase('zoom-in'), 3400)
    const t3 = setTimeout(() => setPhase('ended'), 5000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const showFolder = phase === 'intro' || phase === 'opening'
  const folderAnim = 'folderIn 1.2s ease-out forwards'

  return (
    <>
      <style>{styles}</style>
      <div className="fixed inset-0 overflow-hidden select-none" style={{ backgroundColor: '#1B1A1C' }}>
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

        {phase === 'zoom-in' && (
          <div className="fixed inset-0 z-50" style={{ backgroundColor: '#FF5900', animation: 'zoomInBurst 1.6s ease-in-out forwards' }} />
        )}
      </div>
    </>
  )
}
