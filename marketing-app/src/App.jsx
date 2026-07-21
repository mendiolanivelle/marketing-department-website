import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import MarketingProjectList from './components/MarketingProjectList'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#CACDD7]/20">
        <p className="text-[#3E4048] text-lg">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#CACDD7]/20 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <div className="text-center mb-6">
            <img src="/logo.png" alt="Exodia" className="h-10 mx-auto mb-3" />
            <h1 className="text-[#1B1A1C] text-xl font-bold">Marketing Projects</h1>
            <p className="text-[#3E4048] text-sm mt-1">Sign in to continue</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#CACDD7] rounded-lg text-sm focus:outline-none focus:border-[#FF5900]"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#CACDD7] rounded-lg text-sm focus:outline-none focus:border-[#FF5900]"
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="bg-[#1B1A1C] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#CACDD7]/20">
      <header className="bg-[#1B1A1C] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Exodia" className="h-8" />
          <span className="text-white text-lg font-bold">Marketing Projects</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#CACDD7] text-sm">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-[#CACDD7] hover:text-red-400 transition-colors cursor-pointer text-sm"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="p-6">
        <MarketingProjectList />
      </main>
    </div>
  )
}

export default App