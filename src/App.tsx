import { lazy, Suspense } from 'react'
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

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1B1A1C] transition-colors">
      <div className="h-10 w-10 rounded-full border-2 border-[#CACDD7] border-t-[#FF5900] animate-spin" />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen flex bg-white dark:bg-[#1B1A1C] transition-colors">
                      <Sidebar />
                      <div className="flex-1 flex flex-col min-w-0">
                        <main className="flex-1">
                          <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/team" element={<Team />} />
                            <Route path="/timeline" element={<Timeline />} />
                            <Route path="/templates" element={<MessageTemplates />} />
                            <Route path="/calendar" element={<Calendar />} />
                            <Route path="/leads" element={<LeadGeneration />} />
                            <Route path="/contact" element={<Contact />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
