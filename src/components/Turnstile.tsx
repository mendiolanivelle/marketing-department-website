import { useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  remove: (widgetId: string) => void
  render: (
    container: HTMLElement,
    options: {
      action: string
      appearance: 'interaction-only'
      callback: (token: string) => void
      'error-callback': () => void
      'expired-callback': () => void
      sitekey: string
      theme: 'auto'
    },
  ) => string
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]')
    const script = existing ?? document.createElement('script')
    const loaded = () => window.turnstile ? resolve() : reject(new Error('Turnstile unavailable'))
    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true })
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.turnstileScript = 'true'
      document.head.appendChild(script)
    }
  }).catch((error) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}

export default function Turnstile({
  action,
  onToken,
  resetKey,
}: {
  action: 'acceptance_form' | 'marketing_request'
  onToken: (token: string) => void
  resetKey: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const [unavailable, setUnavailable] = useState(
    !import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim(),
  )
  onTokenRef.current = onToken

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
    const container = containerRef.current
    if (!sitekey || !container) {
      onTokenRef.current('')
      return
    }

    let cancelled = false
    void loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(container, {
          action,
          appearance: 'interaction-only',
          callback: (token) => {
            setUnavailable(false)
            onTokenRef.current(token)
          },
          'error-callback': () => {
            setUnavailable(true)
            onTokenRef.current('')
          },
          'expired-callback': () => onTokenRef.current(''),
          sitekey,
          theme: 'auto',
        })
      })
      .catch(() => {
        setUnavailable(true)
        onTokenRef.current('')
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action])

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
      onTokenRef.current('')
    }
  }, [resetKey])

  return (
    <div>
      <div ref={containerRef} />
      {unavailable && (
        <p role="alert" className="text-sm text-red-700">
          Submission verification is unavailable. Please reload this page or try again later.
        </p>
      )}
    </div>
  )
}
