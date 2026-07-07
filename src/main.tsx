import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const reloadOnStaleChunk = (message: unknown) => {
  const text = String(message)
  const isStaleChunk =
    text.includes('Failed to fetch dynamically imported module') ||
    text.includes('Importing a module script failed') ||
    text.includes('Expected a JavaScript-or-Wasm module script') ||
    text.includes('Strict MIME type checking is enforced for module scripts')

  if (!isStaleChunk || sessionStorage.getItem('stale-chunk-reloaded') === 'true') return

  sessionStorage.setItem('stale-chunk-reloaded', 'true')
  window.location.reload()
}

window.addEventListener('error', (event) => {
  reloadOnStaleChunk(event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  reloadOnStaleChunk(event.reason?.message || event.reason)
})

// Suppress harmless browser extension noise in console
const extNoise = ['message port closed', 'runtime.lastError', 'i18next', 'Locize', 'pendingMailEnrichStorage', 'AuthUtils']
;['log', 'warn', 'error'].forEach(method => {
  const orig = (console as any)[method]
  ;(console as any)[method] = (...args: any[]) => {
    const msg = args.join(' ')
    if (extNoise.some(n => msg.includes(n))) return
    orig.apply(console, args)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
