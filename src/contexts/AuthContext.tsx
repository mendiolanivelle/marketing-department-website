import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, isSupabaseConfigured, setRememberMe } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  sendOtp: (email: string) => Promise<{ error: Error | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  configError: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const configError = !isSupabaseConfigured
    ? 'Supabase is not configured. Please contact your administrator.'
    : null

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        await supabase.auth.signOut({ scope: 'local' })
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
      } else if (session) {
        setSession(session)
        setUser(session.user ?? null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string, rememberMe?: boolean) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') }
    }
    setRememberMe(rememberMe ?? true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const sendOtp = async (email: string) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') }
    }
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error: error as Error | null }
  }

  const verifyOtp = async (email: string, token: string) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') }
    }
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut, sendOtp, verifyOtp, configError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
