import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isStaffUser } from '../src/lib/staff.js'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(rootDir, 'dist')
const portConfig = integerConfig('PORT', 3000, process.env.NODE_ENV === 'production' ? 1 : 0, 65_535)
const openRouterTimeoutConfig = integerConfig('OPENROUTER_TIMEOUT_MS', 45_000, 1_000, 300_000)
const port = portConfig.value
const openRouterTimeoutMs = openRouterTimeoutConfig.value
const imageBodyLimit = 16_000_000
const shutdownTimeoutMs = 10_000
// ponytail: per-process limit; use a shared limiter only when the app runs multiple replicas.
const aiRateLimits = new Map()
const aiRateLimit = 5
const aiRateWindowMs = 60_000
const maxAiRateLimitUsers = 1_000

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self' https://accounts.google.com https://challenges.cloudflare.com https://*.googleapis.com https://*.supabase.co wss://*.supabase.co",
    "font-src 'self' data: https://fonts.gstatic.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'frame-src https://accounts.google.com https://challenges.cloudflare.com',
    "img-src 'self' data: blob: https:",
    "object-src 'none'",
    "script-src 'self' https://accounts.google.com https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

function cleanEnv(value = '') {
  const trimmed = String(value).trim()
  return trimmed
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
}

function getEnv(...names) {
  for (const name of names) {
    const value = cleanEnv(process.env[name])
    if (value) return value
  }
  return ''
}

function integerConfig(name, fallback, min, max) {
  const raw = cleanEnv(process.env[name])
  if (!raw) return { valid: true, value: fallback }
  const value = Number(raw)
  const valid = Number.isInteger(value) && value >= min && value <= max
  return { valid, value: valid ? value : fallback }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

function setSecurityHeaders(res) {
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value)
}

function normalizePublicUrl(value) {
  const clean = cleanEnv(value)
  if (!clean) return ''
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(clean) ? clean : `https://${clean}`
  return withScheme.replace(/\/$/, '')
}

function isLoopback(hostname) {
  return hostname === 'localhost'
    || hostname === '[::1]'
    || hostname === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname)
}

function isSecureHttpEndpoint(value) {
  try {
    const url = new URL(normalizePublicUrl(value))
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url.hostname))
  } catch {
    return false
  }
}

function runtimeReadiness() {
  const issues = []
  const publicSiteUrl = normalizePublicUrl(getEnv('PUBLIC_SITE_URL'))
  const supabaseUrl = normalizePublicUrl(getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL'))
  const openRouterBaseUrl = getEnv('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1'

  try {
    if (!publicSiteUrl || new URL(publicSiteUrl).protocol !== 'https:') issues.push('PUBLIC_SITE_URL')
  } catch {
    issues.push('PUBLIC_SITE_URL')
  }
  if (!isSecureHttpEndpoint(supabaseUrl)) issues.push('SUPABASE_URL')
  if (!getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')) issues.push('SUPABASE_ANON_KEY')
  if (!getEnv('OPENROUTER_API_KEY', 'OPENROUTER_KEY')) issues.push('OPENROUTER_API_KEY')
  if (!isSecureHttpEndpoint(openRouterBaseUrl)) issues.push('OPENROUTER_BASE_URL')
  if (!portConfig.valid) issues.push('PORT')
  if (!openRouterTimeoutConfig.valid) issues.push('OPENROUTER_TIMEOUT_MS')

  return { ready: issues.length === 0, issues }
}

async function authenticateRequest(req) {
  const supabaseUrl = normalizePublicUrl(getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL'))
  const apikey = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  if (!isSecureHttpEndpoint(supabaseUrl) || !apikey) {
    throw Object.assign(new Error('Authentication is not configured'), { statusCode: 503 })
  }

  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : ''
  const match = authorization.match(/^Bearer\s+(\S+)$/i)
  if (!match) throw Object.assign(new Error('Authentication required'), { statusCode: 401 })

  let response
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey, Authorization: `Bearer ${match[1]}` },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw Object.assign(new Error('Authentication service unavailable'), { statusCode: 503 })
  }
  if (response.status >= 500) {
    throw Object.assign(new Error('Authentication service unavailable'), { statusCode: 503 })
  }
  if (!response.ok) throw Object.assign(new Error('Authentication required'), { statusCode: 401 })

  const user = await response.json().catch(() => null)
  if (!user?.id || typeof user.id !== 'string') {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
  }
  if (!isStaffUser(user)) {
    throw Object.assign(new Error('Staff access required'), { statusCode: 403 })
  }
  return { apikey, authorization: `Bearer ${match[1]}`, supabaseUrl, userId: user.id }
}

async function requireAuthentication(req, res) {
  try {
    return await authenticateRequest(req)
  } catch (error) {
    const status = error?.statusCode === 503 ? 503 : error?.statusCode === 403 ? 403 : 401
    sendJson(res, status, {
      error: status === 503
        ? 'Authentication service unavailable'
        : status === 403 ? 'Staff access required' : 'Authentication required',
    })
    return null
  }
}

function consumeAiRateLimit(userId) {
  const now = Date.now()
  const current = aiRateLimits.get(userId)
  if (current?.resetAt > now) {
    if (current.count >= aiRateLimit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
    }
    current.count += 1
    return { allowed: true }
  }

  if (current) aiRateLimits.delete(userId)
  if (aiRateLimits.size >= maxAiRateLimitUsers) {
    for (const [id, entry] of aiRateLimits) {
      if (entry.resetAt <= now) aiRateLimits.delete(id)
    }
  }
  if (aiRateLimits.size >= maxAiRateLimitUsers) return { allowed: false, retryAfter: 60 }

  aiRateLimits.set(userId, { count: 1, resetAt: now + aiRateWindowMs })
  return { allowed: true }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let rejected = false

    req.on('data', chunk => {
      if (rejected) return
      size += chunk.length
      if (size > limit) {
        rejected = true
        chunks.length = 0
        reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

async function readJsonBody(req, limit) {
  const body = await readBody(req, limit)
  try {
    return JSON.parse(body)
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })
  }
}

function validateLead(lead) {
  const fields = ['name', 'company', 'role', 'email', 'contact_number', 'address', 'notes', 'raw_text']
  return fields.reduce((acc, field) => {
    acc[field] = typeof lead?.[field] === 'string' ? lead[field] : ''
    return acc
  }, {})
}

function extractJson(content = '') {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1] || content
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start >= 0 && end > start) return source.slice(start, end + 1)
  return source
}

async function callOpenRouter({ apiKey, model, siteUrl, appName, openRouterBaseUrl, image }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), openRouterTimeoutMs)
  const requestBody = {
    model,
    temperature: 0,
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content: 'Extract business card lead details from the image. Return only valid JSON with exactly these string keys: name, company, role, email, contact_number, address, notes, raw_text. Use empty strings for missing fields. Do not guess names, phone numbers, emails, companies, or addresses. raw_text should contain the visible text you can read from the card.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this calling card and return only the JSON object.' },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
  }

  try {
    const response = await fetch(`${openRouterBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(siteUrl ? { 'HTTP-Referer': siteUrl } : {}),
        'X-Title': appName,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })
    const payload = await response.json()
    return { response, payload }
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`OpenRouter extraction timed out after ${Math.round(openRouterTimeoutMs / 1000)} seconds`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

async function extractCallingCard(req, res, userId) {
  try {
    const apiKey = getEnv('OPENROUTER_API_KEY', 'OPENROUTER_KEY')
    if (!apiKey) return sendJson(res, 503, { error: 'Calling-card extraction is not configured' })
    const openRouterBaseUrl = getEnv('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1'
    if (!openRouterTimeoutConfig.valid || !isSecureHttpEndpoint(openRouterBaseUrl)) {
      return sendJson(res, 503, { error: 'Calling-card extraction is not configured' })
    }

    const body = await readJsonBody(req, imageBodyLimit)
    if (!body.image || typeof body.image !== 'string' || !body.image.startsWith('data:image/')) {
      return sendJson(res, 400, { error: 'Missing image data URL' })
    }
    if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(body.image)) {
      return sendJson(res, 400, { error: 'Image must be a PNG, JPEG, WebP, or GIF base64 data URL' })
    }
    const rateLimit = consumeAiRateLimit(userId)
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', rateLimit.retryAfter)
      return sendJson(res, 429, { error: 'Calling-card extraction rate limit exceeded' })
    }
    const model = getEnv('OPENROUTER_MODEL', 'OPENROUTER_MODEL_NAME') || 'openai/gpt-4o-mini'
    const siteUrl = getEnv('OPENROUTER_SITE_URL', 'PUBLIC_SITE_URL')
    const appName = getEnv('OPENROUTER_APP_NAME') || 'Marketing Department Website'
    const { response, payload } = await callOpenRouter({
      apiKey,
      model,
      siteUrl,
      appName,
      openRouterBaseUrl,
      image: body.image,
    })

    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502
      return sendJson(res, status, { error: 'Calling-card extraction provider failed' })
    }

    const content = payload.choices?.[0]?.message?.content || ''
    const lead = validateLead(JSON.parse(extractJson(content)))
    if (!['name', 'company', 'role', 'email', 'contact_number', 'address'].some(field => lead[field].trim())) {
      return sendJson(res, 422, { error: 'AI could not read usable lead details from this calling card. Please try a clearer, closer photo.', model })
    }
    return sendJson(res, 200, { lead, model })
  } catch (err) {
    const status = err?.statusCode === 400 || err?.statusCode === 413 ? err.statusCode : 500
    return sendJson(res, status, { error: status === 500 ? 'Failed to extract calling card' : err.message })
  }
}

function serveStatic(req, res, pathname) {
  const rawPath = decodeURIComponent(pathname)
  const cleanPath = normalize(rawPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
  const requested = cleanPath === '' || cleanPath === '.' ? 'index.html' : cleanPath
  const filePath = join(distDir, requested)
  const fallbackPath = join(distDir, 'index.html')
  const isAsset = rawPath.startsWith('/assets/')
  if (isAsset && (!filePath.startsWith(distDir) || !existsSync(filePath))) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end('Asset not found')
    return
  }

  const safeFilePath = filePath.startsWith(distDir) && existsSync(filePath) ? filePath : fallbackPath
  const type = contentTypes[extname(safeFilePath)] || 'application/octet-stream'
  const cacheControl = isAsset
    ? 'public, max-age=31536000, immutable'
    : safeFilePath === fallbackPath || extname(safeFilePath) === '.html'
      ? 'no-cache'
      : 'public, max-age=3600'

  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cacheControl })
  if (req.method === 'HEAD') return res.end()
  createReadStream(safeFilePath).pipe(res)
}

async function handleRequest(req, res) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname

  if (req.method === 'GET' && pathname === '/livez') {
    return sendJson(res, 200, { status: 'ok' })
  }
  if (req.method === 'GET' && pathname === '/healthz') {
    const readiness = runtimeReadiness()
    return readiness.ready
      ? sendJson(res, 200, { status: 'ready' })
      : sendJson(res, 503, { status: 'not_ready', configuration: readiness.issues })
  }

  if (req.method === 'POST' && pathname === '/api/extract-calling-card') {
    const auth = await requireAuthentication(req, res)
    if (!auth) return
    return extractCallingCard(req, res, auth.userId)
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'API endpoint not found' })
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, pathname)
  }

  return sendJson(res, 405, { error: 'Method not allowed' })
}

const server = createServer((req, res) => {
  setSecurityHeaders(res)
  handleRequest(req, res).catch(() => {
    if (res.headersSent) return res.destroy()
    sendJson(res, 500, { error: 'Internal server error' })
  })
})

server.listen(port, () => {
  console.log(`Marketing website server listening on port ${server.address().port}`)
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received; shutting down`)

  const timeout = setTimeout(() => {
    console.error('Graceful shutdown timed out')
    process.exit(1)
  }, shutdownTimeoutMs)
  timeout.unref()

  server.close(err => {
    clearTimeout(timeout)
    if (err) {
      console.error('Server shutdown failed')
      process.exitCode = 1
    }
  })
  server.closeIdleConnections?.()
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
