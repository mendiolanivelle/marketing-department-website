import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'

const PublicShowcase = lazy(() => import('./pages/PublicShowcase'))
const PublicAcceptanceForm = lazy(() => import('./pages/PublicAcceptanceForm'))
const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Timeline = lazy(() => import('./pages/Timeline'))
const Messaging = lazy(() => import('./pages/Messaging'))
const Calendar = lazy(() => import('./pages/Calendar'))
const FileTracker = lazy(() => import('./pages/FileTracker'))
const LeadGeneration = lazy(() => import('./pages/LeadGeneration'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const AcceptanceCriteria = lazy(() => import('./pages/AcceptanceCriteria'))
const MarketingRequests = lazy(() => import('./pages/MarketingRequests'))
const ViewAcceptanceForm = lazy(() => import('./pages/ViewAcceptanceForm'))
const SubmitRequestForm = lazy(() => import('./pages/SubmitRequestForm'))
const Workspace = lazy(() => import('./pages/Workspace'))
const WebsiteRequests = lazy(() => import('./pages/WebsiteRequests'))

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
              path="/"
              element={
                <Suspense fallback={<RouteFallback fullScreen />}>
                  <PublicShowcase />
                </Suspense>
              }
            />
            <Route
              path="/acceptance-form"
              element={
                <Suspense fallback={<RouteFallback fullScreen />}>
                  <PublicAcceptanceForm />
                </Suspense>
              }
            />
            <Route
              path="/view-acceptance/:id"
              element={
                <Suspense fallback={<RouteFallback fullScreen />}>
                  <ViewAcceptanceForm />
                </Suspense>
              }
            />
            <Route
              path="/submit-request"
              element={
                <Suspense fallback={<RouteFallback fullScreen />}>
                  <SubmitRequestForm />
                </Suspense>
              }
            />
            <Route
              path="/edit-request/:token"
              element={
                <Suspense fallback={<RouteFallback fullScreen />}>
                  <SubmitRequestForm />
                </Suspense>
              }
            />
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
                      <main className="flex-1 flex flex-col min-h-0">
                        <Suspense fallback={<RouteFallback />}>
                          <Routes>
                            <Route path="/dashboard" element={<Home />} />
                            <Route path="/team" element={<About />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/timeline" element={<Timeline />} />
                            <Route path="/templates" element={<Messaging />} />
                            <Route path="/calendar" element={<Calendar />} />
<Route path="/files" element={<FileTracker />} />
                            <Route path="/leads" element={<LeadGeneration />} />
                            <Route path="/campaigns" element={<Campaigns />} />
                            <Route path="/acceptance-criteria" element={<AcceptanceCriteria />} />
                            <Route path="/requests" element={<MarketingRequests />} />
                            <Route path="/website-requests" element={<WebsiteRequests />} />
<Route path="/workspace" element={<div className="flex-1 min-h-0"><Workspace /></div>} />
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
