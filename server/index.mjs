import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(rootDir, 'dist')
const port = Number(process.env.PORT || 3000)

const callingCardSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    company: { type: 'string' },
    role: { type: 'string' },
    email: { type: 'string' },
    contact_number: { type: 'string' },
    address: { type: 'string' },
    notes: { type: 'string' },
    raw_text: { type: 'string' },
  },
  required: ['name', 'company', 'role', 'email', 'contact_number', 'address', 'notes', 'raw_text'],
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

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
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

function extractJson(content = '') {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1] || content
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start >= 0 && end > start) return source.slice(start, end + 1)
  return source
}

async function extractCallingCard(req, res) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return sendJson(res, 500, { error: 'OPENROUTER_API_KEY is not set' })

    const body = JSON.parse(await readBody(req))
    if (!body.image || typeof body.image !== 'string' || !body.image.startsWith('data:image/')) {
      return sendJson(res, 400, { error: 'Missing image data URL' })
    }

    const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
    const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.PUBLIC_SITE_URL || ''
    const appName = process.env.OPENROUTER_APP_NAME || 'Marketing Department Website'
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(siteUrl ? { 'HTTP-Referer': siteUrl } : {}),
        'X-Title': appName,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'calling_card_lead',
            strict: true,
            schema: callingCardSchema,
          },
        },
        plugins: [{ id: 'response-healing' }],
        messages: [
          {
            role: 'system',
            content: 'Extract business card lead details from the image. Return only visible information. Use empty strings for missing fields. Do not guess names, phone numbers, emails, companies, or addresses.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read this calling card and return the contact fields as JSON.' },
              { type: 'image_url', image_url: { url: body.image } },
            ],
          },
        ],
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      return sendJson(res, response.status, { error: payload.error?.message || 'OpenRouter extraction failed' })
    }

    const content = payload.choices?.[0]?.message?.content || ''
    const lead = JSON.parse(extractJson(content))
    return sendJson(res, 200, { lead })
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Failed to extract calling card' })
  }
}

function serveStatic(req, res) {
  const rawPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
  const cleanPath = normalize(rawPath).replace(/^(\.\.[/\\])+/, '')
  const requested = cleanPath === '/' ? '/index.html' : cleanPath
  const filePath = join(distDir, requested)
  const fallbackPath = join(distDir, 'index.html')
  const safeFilePath = filePath.startsWith(distDir) && existsSync(filePath) ? filePath : fallbackPath
  const type = contentTypes[extname(safeFilePath)] || 'application/octet-stream'

  res.writeHead(200, { 'Content-Type': type })
  createReadStream(safeFilePath).pipe(res)
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/extract-calling-card') {
    return extractCallingCard(req, res)
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res)
  }

  return sendJson(res, 405, { error: 'Method not allowed' })
}).listen(port, () => {
  console.log(`Marketing website server listening on port ${port}`)
})
