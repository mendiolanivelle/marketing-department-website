import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const REMEMBER_ME_KEY = 'mb_remember_me'

function retryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const attempt = (retries: number) => {
      fetch(input, init)
        .then(resolve)
        .catch(err => {
          if (retries > 0) {
            setTimeout(() => attempt(retries - 1), 1000)
          } else {
            reject(err)
          }
        })
    }
    attempt(2)
  })
}

function getRememberMe(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(REMEMBER_ME_KEY) !== 'false'
}

function getSupabaseStorage() {
  const remember = getRememberMe()
  return remember ? window.localStorage : window.sessionStorage
}

const customStorage = {
  getItem(key: string) {
    return getSupabaseStorage().getItem(key)
  },
  setItem(key: string, value: string) {
    const storage = getSupabaseStorage()
    storage.setItem(key, value)
    if (storage === window.localStorage) {
      window.sessionStorage.removeItem(key)
    } else {
      window.localStorage.removeItem(key)
    }
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
      },
      realtime: {
        params: { log_level: 'silent' },
      },
      global: {
        fetch: retryFetch,
      },
    })
  : null

export function setRememberMe(value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REMEMBER_ME_KEY, String(value))
}
