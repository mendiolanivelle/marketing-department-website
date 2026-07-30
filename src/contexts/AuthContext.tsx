import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, isSupabaseConfigured, setRememberMe } from '../lib/supabase'
import { isStaffUser } from '../lib/staff.js'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  isStaff: boolean
  loading: boolean
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
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
  const applySession = useCallback((nextSession: Session | null) => {
    const authorized = Boolean(nextSession && isStaffUser(nextSession.user))
    setSession(authorized ? nextSession : null)
    setUser(authorized ? nextSession!.user : null)
    return authorized
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || (session && !applySession(session))) {
        await supabase?.auth.signOut({ scope: 'local' })
        applySession(null)
      } else {
        applySession(session)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        applySession(null)
      } else if (session) {
        const authorized = applySession(session)
        if (!authorized) {
          window.setTimeout(() => void supabase?.auth.signOut({ scope: 'local' }), 0)
        }
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [applySession])

  const signIn = async (email: string, password: string, rememberMe?: boolean) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') }
    }
    setRememberMe(rememberMe ?? true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error as Error }
    if (!data.session || !isStaffUser(data.user)) {
      await supabase.auth.signOut({ scope: 'local' })
      applySession(null)
      return { error: new Error('This account is not authorized for the staff portal.') }
    }
    applySession(data.session)
    return { error: null }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase?.auth.signOut()
    applySession(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isStaff: isStaffUser(user),
      loading,
      signIn,
      signOut,
      configError,
    }}>
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
