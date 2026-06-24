import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Home from './pages/Home'
import About from './pages/About'
import Services from './pages/Services'
import Team from './pages/Team'
import Contact from './pages/Contact'
import Timeline from './pages/Timeline'
import MessageTemplates from './pages/MessageTemplates'
import Calendar from './pages/Calendar'
import LeadGeneration from './pages/LeadGeneration'
import ReachOut from './pages/ReachOut'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen flex theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }}>
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
                          <Route path="/reach-out" element={<ReachOut />} />
                          <Route path="/contact" element={<Contact />} />
                        </Routes>
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
