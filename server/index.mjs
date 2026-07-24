import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(rootDir, 'dist')
const port = Number(process.env.PORT || 3000)
const openRouterTimeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 45000)
const imageStore = new Map()
const imageTtlMs = Number(process.env.CALLING_CARD_IMAGE_TTL_MS || 10 * 60 * 1000)

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

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function normalizePublicUrl(value) {
  const clean = cleanEnv(value)
  if (!clean) return ''
  const withScheme = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
  return withScheme.replace(/\/$/, '')
}

function getRequestOrigin(req) {
  const configuredUrl = normalizePublicUrl(process.env.PUBLIC_SITE_URL)
  if (configuredUrl) return configuredUrl
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 15_000_000) {
        reject(new Error('Request body is too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function validateLead(lead) {
  const fields = ['name', 'company', 'role', 'email', 'contact_number', 'address', 'notes', 'raw_text']
  return fields.reduce((acc, field) => {
    acc[field] = typeof lead?.[field] === 'string' ? lead[field] : ''
    return acc
  }, {})
}

function storeImage(dataUrl) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i)
  if (!match) throw new Error('Image must be a PNG, JPEG, WebP, or GIF base64 data URL')
  const id = crypto.randomUUID()
  const contentType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  const timeout = setTimeout(() => imageStore.delete(id), imageTtlMs)
  imageStore.set(id, { buffer, contentType, timeout })
  return id
}

function cleanupImage(id) {
  const entry = imageStore.get(id)
  if (!entry) return
  clearTimeout(entry.timeout)
  imageStore.delete(id)
}

function serveStoredImage(req, res) {
  const id = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname.replace('/api/calling-card-image/', ''))
  const entry = imageStore.get(id)
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Image not found')
    return
  }
  res.writeHead(200, {
    'Content-Type': entry.contentType,
    'Content-Length': entry.buffer.length,
    'Cache-Control': 'no-store',
  })
  res.end(entry.buffer)
}

function getOpenRouterMessage(errorPayload) {
  const message = errorPayload?.error?.message || errorPayload?.message || 'OpenRouter extraction failed'
  const param = errorPayload?.error?.param ? ` (${errorPayload.error.param})` : ''
  const code = errorPayload?.error?.code ? ` [${errorPayload.error.code}]` : ''
  return `${message}${param}${code}`
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
          { type: 'image_url', image_url: image },
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

async function extractCallingCard(req, res) {
  let imageId = ''
  try {
    const apiKey = getEnv('OPENROUTER_API_KEY', 'OPENROUTER_KEY')
    if (!apiKey) return sendJson(res, 500, { error: 'OPENROUTER_API_KEY is not set' })

    const body = JSON.parse(await readBody(req))
    if (!body.image || typeof body.image !== 'string' || !body.image.startsWith('data:image/')) {
      return sendJson(res, 400, { error: 'Missing image data URL' })
    }
    if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(body.image)) {
      return sendJson(res, 400, { error: 'Image must be a PNG, JPEG, WebP, or GIF base64 data URL' })
    }
    imageId = storeImage(body.image)
    const imageUrl = `${getRequestOrigin(req)}/api/calling-card-image/${imageId}`
    if (!/^https:\/\//i.test(imageUrl) && !/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i.test(imageUrl)) {
      return sendJson(res, 500, {
        error: 'PUBLIC_SITE_URL must be set to your public HTTPS app URL in Coolify so OpenRouter can fetch the calling card image.',
        imageUrl,
      })
    }

    const model = getEnv('OPENROUTER_MODEL', 'OPENROUTER_MODEL_NAME') || 'openai/gpt-4o-mini'
    const siteUrl = getEnv('OPENROUTER_SITE_URL', 'PUBLIC_SITE_URL')
    const appName = getEnv('OPENROUTER_APP_NAME') || 'Marketing Department Website'
    const openRouterBaseUrl = getEnv('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1'
    const { response, payload } = await callOpenRouter({
      apiKey,
      model,
      siteUrl,
      appName,
      openRouterBaseUrl,
      image: imageUrl,
    })

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: getOpenRouterMessage(payload),
        code: payload.error?.code,
        param: payload.error?.param,
        type: payload.error?.type,
        model,
      })
    }

    const content = payload.choices?.[0]?.message?.content || ''
    const lead = validateLead(JSON.parse(extractJson(content)))
    if (!['name', 'company', 'role', 'email', 'contact_number', 'address'].some(field => lead[field].trim())) {
      return sendJson(res, 422, { error: 'AI could not read usable lead details from this calling card. Please try a clearer, closer photo.', model })
    }
    return sendJson(res, 200, { lead, model })
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Failed to extract calling card' })
  } finally {
    if (imageId) setTimeout(() => cleanupImage(imageId), 60_000)
  }
}

function serveStatic(req, res) {
  const rawPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
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
  const cacheControl = 'no-cache'

  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cacheControl })
  createReadStream(safeFilePath).pipe(res)
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/extract-calling-card') {
    return extractCallingCard(req, res)
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/calling-card-image/')) {
    return serveStoredImage(req, res)
  }

  if (req.url?.startsWith('/api/supabase/')) {
    return proxySupabase(req, res)
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res)
  }

  return sendJson(res, 405, { error: 'Method not allowed' })
}).listen(port, () => {
  console.log(`Marketing website server listening on port ${port}`)
})

async function proxySupabase(req, res) {
  const supabaseUrl = cleanEnv(process.env.VITE_SUPABASE_URL || 'https://extkotvjigtswrrnxikw.supabase.co')
  const targetPath = req.url.replace('/api/supabase', '')
  const targetUrl = `${supabaseUrl}${targetPath}`

  const fwdHeaders = {}
  for (const key of Object.keys(req.headers)) {
    const lk = key.toLowerCase()
    if (lk === 'host' || lk === 'connection' || lk === 'transfer-encoding') continue
    fwdHeaders[key] = req.headers[key]
  }

  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
    const resp = await fetch(targetUrl, { method: req.method, headers: fwdHeaders, body: body || undefined })
    const respHeaders = {}
    resp.headers.forEach((v, k) => { respHeaders[k] = v })
    res.writeHead(resp.status, respHeaders)
    if (resp.body) {
      const reader = resp.body.getReader()
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { res.end(); return }
        res.write(value)
        pump()
      })
      pump()
    } else {
      res.end()
    }
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Proxy error')
  }
}
