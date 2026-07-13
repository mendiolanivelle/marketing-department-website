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
@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
`

type Phase = 'intro' | 'opening' | 'zoom-in' | 'ended'

const services = [
  { title: 'Game Development', desc: 'Full-cycle game development from concept to launch across PC, console, and mobile platforms.', icon: '🎮' },
  { title: 'Art & Animation', desc: '2D/3D character design, environment art, rigging, and high-quality animation pipelines.', icon: '🎨' },
  { title: 'UI/UX Design', desc: 'Intuitive user interfaces and seamless player experiences tailored to your game.', icon: '🖥️' },
  { title: 'Quality Assurance', desc: 'Comprehensive testing, bug tracking, and performance optimization for polished releases.', icon: '✅' },
  { title: 'Porting & Optimization', desc: 'Cross-platform porting and performance optimization for smooth gameplay everywhere.', icon: '⚡' },
  { title: 'Technical Consulting', desc: 'Expert guidance on game architecture, engine selection, and production pipelines.', icon: '🔧' },
]

const projects = [
  { title: 'Project Aethel', desc: 'Open-world RPG built in Unreal Engine 5. Dynamic weather, day/night cycle, and branching narrative.', tag: 'Unreal Engine 5' },
  { title: 'Neon Drift', desc: 'High-speed arcade racer with procedurally generated tracks and online multiplayer.', tag: 'Unity' },
  { title: 'Crystal Reckoning', desc: 'Turn-based strategy game with a deep crafting system and hand-painted 2D art.', tag: 'Custom Engine' },
  { title: 'Void Signal', desc: 'Co-op survival horror with procedural levels and asymmetric multiplayer.', tag: 'Unity' },
]

export default function PublicShowcase() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [showBtn, setShowBtn] = useState(false)
  const navigate = useNavigate()

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
      {phase !== 'ended' && (
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
      )}

      {phase === 'ended' && (
        <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: '#1B1A1C', color: '#FFFFFF', animation: 'fadeIn 0.8s ease-out' }}>
          {/* Hero */}
          <div className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
            <div className="absolute" style={{ width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,89,0,0.1) 0%, transparent 70%)', filter: 'blur(60px)', top: '10%', left: '50%', transform: 'translateX(-50%)' }} />
            <div className="text-center max-w-2xl" style={{ animation: 'fadeInUp 1s ease-out' }}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 tracking-tight" style={{ letterSpacing: '-1px' }}>
                Exodia Game Development
              </h1>
              <p className="text-lg sm:text-xl mb-10" style={{ color: '#9CA3AF', fontWeight: 300, lineHeight: 1.7 }}>
                We craft immersive gaming experiences from concept to launch. Partner with us to bring your vision to life.
              </p>
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
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2" style={{ animation: 'fadeIn 2s ease-out 1s both' }}>
              <svg className="w-6 h-6" style={{ color: '#4B5563' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            </div>
          </div>

          {/* Services */}
          <div className="px-6 py-24 sm:px-8 lg:px-16" style={{ backgroundColor: '#1F1F23' }}>
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ letterSpacing: '-0.5px' }}>What We Do</h2>
              <p className="text-center mb-16 max-w-xl mx-auto" style={{ color: '#9CA3AF', fontWeight: 300, fontSize: 16, lineHeight: 1.7 }}>From concept art to final build, we provide end-to-end game development services tailored to your project.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {services.map((s, i) => (
                  <div key={i} className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1" style={{ backgroundColor: '#2A2A2E', border: '1px solid #37373B', animation: `fadeInUp 0.6s ease-out ${i * 0.1}s both` }}>
                    <span className="text-3xl block mb-4">{s.icon}</span>
                    <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF', fontWeight: 300 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="px-6 py-24 sm:px-8 lg:px-16">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ letterSpacing: '-0.5px' }}>Featured Projects</h2>
              <p className="text-center mb-16 max-w-xl mx-auto" style={{ color: '#9CA3AF', fontWeight: 300, fontSize: 16, lineHeight: 1.7 }}>A glimpse of the worlds we've built and the stories we've brought to life.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {projects.map((p, i) => (
                  <div key={i} className="rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1" style={{ backgroundColor: '#1F1F23', border: '1px solid #2A2A2E', animation: `fadeInUp 0.6s ease-out ${i * 0.15}s both` }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold">{p.title}</h3>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,89,0,0.15)', color: '#FF5900' }}>{p.tag}</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF', fontWeight: 300 }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* About */}
          <div className="px-6 py-24 sm:px-8 lg:px-16" style={{ backgroundColor: '#1F1F23' }}>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ letterSpacing: '-0.5px' }}>Why Exodia?</h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: '#D1D5DB', fontWeight: 300, lineHeight: 1.8 }}>
                We are a passionate team of developers, artists, and designers dedicated to creating unforgettable gaming experiences. 
                With years of experience across multiple platforms and genres, we bring technical excellence and creative vision to every project we undertake.
              </p>
              <div className="flex flex-wrap justify-center gap-8 text-center">
                {[
                  { label: 'Years Experience', value: '8+' },
                  { label: 'Projects Delivered', value: '40+' },
                  { label: 'Team Members', value: '25+' },
                  { label: 'Happy Clients', value: '30+' },
                ].map((s, i) => (
                  <div key={i} style={{ animation: `fadeInUp 0.5s ease-out ${i * 0.1}s both` }}>
                    <div className="text-3xl font-extrabold" style={{ color: '#FF5900' }}>{s.value}</div>
                    <div className="text-sm mt-1" style={{ color: '#9CA3AF', fontWeight: 300 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contact / Footer */}
          <div className="px-6 py-16 sm:px-8 lg:px-16 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-4">Let's Build Together</h2>
              <p className="text-sm mb-8" style={{ color: '#9CA3AF', fontWeight: 300, lineHeight: 1.7 }}>
                Have a project in mind? Get in touch and let's discuss how we can bring your vision to life.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
                style={{ backgroundColor: '#FF5900', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(255,89,0,0.3)' }}
              >
                Get Started
              </button>
            </div>
            <div className="mt-16 pt-8" style={{ borderTop: '1px solid #2A2A2E' }}>
              <p className="text-sm" style={{ color: '#4B5563', fontWeight: 300 }}>Exodia Game Development &middot; Marketing Department</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}