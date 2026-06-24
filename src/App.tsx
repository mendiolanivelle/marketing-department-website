import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'

const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Services = lazy(() => import('./pages/Services'))
const Team = lazy(() => import('./pages/Team'))
const Contact = lazy(() => import('./pages/Contact'))
const Timeline = lazy(() => import('./pages/Timeline'))
const MessageTemplates = lazy(() => import('./pages/MessageTemplates'))
const Calendar = lazy(() => import('./pages/Calendar'))
const LeadGeneration = lazy(() => import('./pages/LeadGeneration'))
const ReachOut = lazy(() => import('./pages/ReachOut'))

function RouteFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={`${fullScreen ? 'min-h-screen' : 'min-h-[60vh]'} flex items-center justify-center theme-transition`}
      style={{ backgroundColor: fullScreen ? 'var(--bg-secondary)' : 'transparent' }}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-solid"
        style={{ borderColor: 'var(--border-secondary)', borderTopColor: 'var(--accent)' }}
      />
      <span className="sr-only">Loading</span>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <Suspense fallback={<RouteFallback fullScreen />}>
                  <Login />
                </Suspense>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen flex theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <Sidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                      <main className="flex-1">
                        <Suspense fallback={<RouteFallback />}>
                          <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/team" element={<Team />} />
                            <Route path="/timeline" element={<Timeline />} />
                            <Route path="/templates" element={<MessageTemplates />} />
                            <Route path="/calendar" element={<Calendar />} />
                            <Route path="/leads" element={<LeadGeneration />} />
                            <Route path="/reach-out" element={<ReachOut />} />
                            <Route path="/contact" element={<Contact />} />
                          </Routes>
                        </Suspense>
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
