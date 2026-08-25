import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, isSupabaseConfigured, setRememberMe } from '../lib/supabase'
import { isStaffUser } from '../lib/staff.js'
import { logActivity, setActivityUser } from '../lib/activityLogger'
import { signOutWithActivity } from '../lib/authActivity'
import {
  applyAuthEventSession,
  beginAuthSessionRead,
  createAuthSessionOrder,
  isAuthSessionReadCurrent,
  supersedeAuthSessionReads,
} from '../lib/authSessionOrder'
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
  const sessionOrderRef = useRef(createAuthSessionOrder())
  const configError = !isSupabaseConfigured
    ? 'Supabase is not configured. Please contact your administrator.'
    : null
  const applySession = useCallback((nextSession: Session | null) => {
    const authorized = Boolean(nextSession && isStaffUser(nextSession.user))
    setActivityUser(authorized ? nextSession!.user.id : null)
    setSession(authorized ? nextSession : null)
    setUser(authorized ? nextSession!.user : null)
    return authorized
  }, [])

  useEffect(() => {
    if (!supabase) {
      applySession(null)
      setLoading(false)
      return
    }

    let timedOut = false
    const sessionOrder = sessionOrderRef.current
    const initialSessionRevision = beginAuthSessionRead(sessionOrder)
    const timeout = setTimeout(() => {
      timedOut = true
      applySession(null)
      setLoading(false)
    }, 8000)

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (timedOut || !isAuthSessionReadCurrent(sessionOrder, initialSessionRevision)) return
      clearTimeout(timeout)
      if (error || (session && !applySession(session))) {
        await supabase?.auth.signOut({ scope: 'local' })
        if (!isAuthSessionReadCurrent(sessionOrder, initialSessionRevision)) return
        applySession(null)
      } else {
        applySession(session)
      }
      setLoading(false)
    }).catch(() => {
      if (timedOut || !isAuthSessionReadCurrent(sessionOrder, initialSessionRevision)) return
      clearTimeout(timeout)
      applySession(null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      supersedeAuthSessionReads(sessionOrder)
      clearTimeout(timeout)
      const authorized = applyAuthEventSession(session, applySession)
      if (session && !authorized) {
        window.setTimeout(() => void supabase?.auth.signOut({ scope: 'local' }), 0)
      }
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      supersedeAuthSessionReads(sessionOrder)
      subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = async (email: string, password: string, rememberMe?: boolean) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') }
    }
    supersedeAuthSessionReads(sessionOrderRef.current)
    setRememberMe(rememberMe ?? true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error as Error }
    if (!data.session || !isStaffUser(data.user)) {
      await supabase.auth.signOut({ scope: 'local' })
      applySession(null)
      return { error: new Error('This account is not authorized for the staff portal.') }
    }
    applySession(data.session)
    void logActivity('Authentication', 'Signed in')
    return { error: null }
  }

  const signOut = async () => {
    if (!supabase) return
    supersedeAuthSessionReads(sessionOrderRef.current)
    const client = supabase
    const result = await signOutWithActivity(
      async () => {
        const { error } = await client.auth.signOut()
        return { error: error as Error | null }
      },
      detail => { void logActivity('Authentication', detail) },
    )
    if (result.error) {
      console.error('Failed to sign out:', result.error)
      return
    }
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
