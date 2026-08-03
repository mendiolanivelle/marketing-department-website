import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const REMEMBER_ME_KEY = 'mb_remember_me'

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

const resilientFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method || 'GET').toUpperCase()

  if (url && url.includes('.supabase.co')) {
    const proxied = url.replace(/^https?:\/\/[^/]+/, '/api/supabase')
    if (input instanceof Request) {
      input = new Request(proxied, input as RequestInit)
    } else {
      input = new Request(proxied, init)
    }
  }

  const isReadOnly = method === 'GET' || method === 'HEAD'
  const maxRetries = isReadOnly ? 2 : 0
  let lastErr: unknown

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      lastErr = err
      if (i < maxRetries) {
        await new Promise(r => setTimeout(r, 800 * (i + 1)))
      }
    }
  }
  throw lastErr
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
        fetch: resilientFetch,
      },
    })
  : null

export function setRememberMe(value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REMEMBER_ME_KEY, String(value))
}
