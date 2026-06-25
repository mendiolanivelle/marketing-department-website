import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const reloadOnStaleChunk = (message: unknown) => {
  const text = String(message)
  const isStaleChunk =
    text.includes('Failed to fetch dynamically imported module') ||
    text.includes('Importing a module script failed') ||
    text.includes('Expected a JavaScript-or-Wasm module script')

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
const origError = console.error
console.error = (...args) => {
  const msg = args.join(' ')
  if (msg.includes('message port closed') || msg.includes('runtime.lastError')) return
  origError.apply(console, args)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
