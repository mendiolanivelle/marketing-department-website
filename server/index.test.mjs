import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import test from 'node:test'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const configNames = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_APP_NAME',
  'OPENROUTER_BASE_URL',
  'OPENROUTER_KEY',
  'OPENROUTER_MODEL',
  'OPENROUTER_MODEL_NAME',
  'OPENROUTER_SITE_URL',
  'OPENROUTER_TIMEOUT_MS',
  'PUBLIC_SITE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
]

function startApp(config = {}) {
  const env = { ...process.env, PORT: '0' }
  for (const name of configNames) delete env[name]
  Object.assign(env, config)

  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 5_000)
    let errors = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { errors += chunk })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      const match = chunk.match(/listening on port (\d+)/)
      if (!match) return
      clearTimeout(timeout)
      resolve({ child, origin: `http://127.0.0.1:${match[1]}` })
    })
    child.once('exit', code => {
      clearTimeout(timeout)
      reject(new Error(`Server exited before startup (${code}): ${errors}`))
    })
  })
}

function stopApp(child) {
  if (child.exitCode !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Server did not shut down gracefully'))
    }, 3_000)
    child.once('exit', code => {
      clearTimeout(timeout)
      try {
        assert.equal(code, 0)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    child.kill('SIGTERM')
  })
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(value))
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function startMockBackend() {
  const state = {
    fetchedImages: 0,
    imageUrls: [],
    providerFails: false,
    activeSupabaseRequests: 0,
    maxActiveSupabaseRequests: 0,
  }
  const users = new Map([
    ['Bearer valid-token', { id: 'test-user', app_metadata: { staff: true } }],
    ['Bearer second-token', { id: 'second-user', app_metadata: { staff: true } }],
    ['Bearer ordinary-token', { id: 'ordinary-user', app_metadata: {} }],
  ])
  const server = createServer(async (req, res) => {
    if (req.url === '/auth/v1/user') {
      const user = users.get(req.headers.authorization)
      if (req.headers.apikey !== 'test-key' || !user) return sendJson(res, 401, { message: 'invalid token detail' })
      return sendJson(res, 200, user)
    }

    if (req.url === '/chat/completions' && req.method === 'POST') {
      if (state.providerFails) return sendJson(res, 400, { error: { message: 'secret upstream failure detail' } })
      const body = await readJson(req)
      const imageUrl = body.messages?.[1]?.content
        ?.find(part => part.type === 'image_url')
        ?.image_url?.url
      state.imageUrls.push(imageUrl)
      assert.match(imageUrl || '', /^data:image\/png;base64,/)
      state.fetchedImages += 1
      return sendJson(res, 200, {
        choices: [{ message: { content: '{"name":"Ada","company":"Example","role":"","email":"","contact_number":"","address":"","notes":"","raw_text":"Ada Example"}' } }],
      })
    }

    if (req.url?.startsWith('/rest/v1/marketing_requests')) {
      state.activeSupabaseRequests += 1
      state.maxActiveSupabaseRequests = Math.max(state.maxActiveSupabaseRequests, state.activeSupabaseRequests)
      try {
        await new Promise(resolve => setTimeout(resolve, 50))
        const responseBody = Buffer.from(JSON.stringify({
          requests: Array.from({ length: 100 }, (_, index) => ({ id: index + 1, status: 'Complete' })),
        }))
        const compressedBody = gzipSync(responseBody)
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Content-Length': compressedBody.length,
        })
        return res.end(compressedBody)
      } finally {
        state.activeSupabaseRequests -= 1
      }
    }

    return sendJson(res, 404, {})
  })

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        state,
        stop: () => new Promise((stopResolve, stopReject) => {
          server.close(error => error ? stopReject(error) : stopResolve())
          server.closeIdleConnections?.()
        }),
      })
    })
  })
}

const authorization = { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' }
const imageBody = JSON.stringify({ image: 'data:image/png;base64,iVBORw0KGgo=' })

test('Supabase proxy keeps decompressed response framing coherent', async () => {
  const backend = await startMockBackend()
  const app = await startApp({
    PUBLIC_SITE_URL: 'https://portal.example',
    SUPABASE_ANON_KEY: 'test-key',
    SUPABASE_URL: backend.origin,
  })
  try {
    const response = await fetch(`${app.origin}/api/supabase/rest/v1/marketing_requests?select=id%2Cstatus`, {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-encoding'), null)

    const responseText = await response.text()
    assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(responseText))
    assert.equal(JSON.parse(responseText).requests.length, 100)
  } finally {
    await stopApp(app.child)
    await backend.stop()
  }
})

test('Supabase proxy limits simultaneous upstream requests', async () => {
  const backend = await startMockBackend()
  const app = await startApp({
    PUBLIC_SITE_URL: 'https://portal.example',
    SUPABASE_ANON_KEY: 'test-key',
    SUPABASE_URL: backend.origin,
  })
  try {
    const responses = await Promise.all(Array.from({ length: 6 }, () => fetch(
      `${app.origin}/api/supabase/rest/v1/marketing_requests?select=id`,
      { headers: { 'Accept-Encoding': 'gzip' } },
    )))
    assert.deepEqual(responses.map(response => response.status), [200, 200, 200, 200, 200, 200])
    await Promise.all(responses.map(response => response.text()))
    assert.ok(
      backend.state.maxActiveSupabaseRequests <= 3,
      `expected at most 3 active upstream requests, received ${backend.state.maxActiveSupabaseRequests}`,
    )
  } finally {
    await stopApp(app.child)
    await backend.stop()
  }
})

test('production server fails closed and protects calling-card API access', async () => {
  const unconfigured = await startApp()
  try {
    const liveness = await fetch(`${unconfigured.origin}/livez`)
    assert.equal(liveness.status, 200)
    assert.deepEqual(await liveness.json(), { status: 'ok' })
    assert.match(liveness.headers.get('permissions-policy') || '', /camera=\(self\)/)
    assert.match(liveness.headers.get('permissions-policy') || '', /geolocation=\(\)/)
    assert.match(liveness.headers.get('permissions-policy') || '', /microphone=\(\)/)

    const health = await fetch(`${unconfigured.origin}/healthz`)
    assert.equal(health.status, 503)
    assert.deepEqual(await health.json(), {
      status: 'not_ready',
      configuration: [
        'PUBLIC_SITE_URL',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'OPENROUTER_API_KEY',
      ],
    })
    assert.equal(health.headers.get('cache-control'), 'no-store')
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(health.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive, nosnippet')

    const unknownApi = await fetch(`${unconfigured.origin}/api/unknown`)
    assert.equal(unknownApi.status, 404)

    const removedSync = await fetch(`${unconfigured.origin}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"items":[]}',
    })
    assert.equal(removedSync.status, 404)
    assert.deepEqual(await removedSync.json(), { error: 'API endpoint not found' })
  } finally {
    await stopApp(unconfigured.child)
  }

  const unsafeEndpoints = await startApp({
    OPENROUTER_API_KEY: 'paid-test-key',
    OPENROUTER_BASE_URL: 'http://provider.example.net',
    OPENROUTER_TIMEOUT_MS: '0',
    PUBLIC_SITE_URL: 'https://portal.example',
    SUPABASE_ANON_KEY: 'test-key',
    SUPABASE_URL: 'http://database.example.net',
  })
  try {
    const health = await fetch(`${unsafeEndpoints.origin}/healthz`)
    assert.equal(health.status, 503)
    assert.deepEqual(await health.json(), {
      status: 'not_ready',
      configuration: ['SUPABASE_URL', 'OPENROUTER_BASE_URL', 'OPENROUTER_TIMEOUT_MS'],
    })

    const extraction = await fetch(`${unsafeEndpoints.origin}/api/extract-calling-card`, {
      method: 'POST',
      headers: authorization,
      body: imageBody,
    })
    assert.equal(extraction.status, 503)
    assert.deepEqual(await extraction.json(), { error: 'Authentication service unavailable' })
  } finally {
    await stopApp(unsafeEndpoints.child)
  }

  const backend = await startMockBackend()
  const app = await startApp({
    OPENROUTER_API_KEY: 'paid-test-key',
    OPENROUTER_BASE_URL: backend.origin,
    PUBLIC_SITE_URL: 'https://portal.example',
    SUPABASE_ANON_KEY: 'test-key',
    SUPABASE_URL: backend.origin,
  })
  try {
    const health = await fetch(`${app.origin}/healthz`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { status: 'ready' })

    const missingAuth = await fetch(`${app.origin}/api/extract-calling-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: imageBody,
    })
    assert.equal(missingAuth.status, 401)
    assert.deepEqual(await missingAuth.json(), { error: 'Authentication required' })

    const ordinaryAccount = await fetch(`${app.origin}/api/extract-calling-card`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ordinary-token', 'Content-Type': 'application/json' },
      body: imageBody,
    })
    assert.equal(ordinaryAccount.status, 403)
    assert.deepEqual(await ordinaryAccount.json(), { error: 'Staff access required' })

    for (let request = 1; request <= 5; request++) {
      const extraction = await fetch(`${app.origin}/api/extract-calling-card`, {
        method: 'POST',
        headers: request === 1
          ? { ...authorization, 'X-Forwarded-Host': 'attacker.example', 'X-Forwarded-Proto': 'https' }
          : authorization,
        body: imageBody,
      })
      assert.equal(extraction.status, 200)
      assert.equal((await extraction.json()).lead.name, 'Ada')
    }
    assert.equal(backend.state.fetchedImages, 5)
    assert.ok(backend.state.imageUrls.every(url => url === 'data:image/png;base64,iVBORw0KGgo='))

    const limited = await fetch(`${app.origin}/api/extract-calling-card`, {
      method: 'POST',
      headers: authorization,
      body: imageBody,
    })
    assert.equal(limited.status, 429)
    assert.match(limited.headers.get('retry-after') || '', /^\d+$/)
    assert.deepEqual(await limited.json(), { error: 'Calling-card extraction rate limit exceeded' })

    backend.state.providerFails = true
    const providerFailure = await fetch(`${app.origin}/api/extract-calling-card`, {
      method: 'POST',
      headers: { Authorization: 'Bearer second-token', 'Content-Type': 'application/json' },
      body: imageBody,
    })
    assert.equal(providerFailure.status, 502)
    assert.deepEqual(await providerFailure.json(), { error: 'Calling-card extraction provider failed' })
  } finally {
    await stopApp(app.child)
    await backend.stop()
  }
})
