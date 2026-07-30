import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function corsHeaders(req: Request, methods = 'POST, OPTIONS') {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const allowed = new Set(configured)
  const origin = req.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': methods,
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  }
  if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export const json = (req: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders(req) })

export const isAllowedOrigin = (req: Request) => {
  const origin = req.headers.get('Origin')
  return !origin || corsHeaders(req)['Access-Control-Allow-Origin'] === origin
}

type JsonBody =
  | { value: unknown; error: null }
  | { value: null; error: Response }

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<JsonBody> {
  const contentType = req.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    return { value: null, error: json(req, { error: 'Content-Type must be application/json' }, 415) }
  }

  const contentLength = req.headers.get('Content-Length')
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      return { value: null, error: json(req, { error: 'Invalid Content-Length' }, 400) }
    }
    if (declaredBytes > maxBytes) {
      return { value: null, error: json(req, { error: 'Request body is too large' }, 413) }
    }
  }

  const reader = req.body?.getReader()
  if (!reader) {
    return { value: null, error: json(req, { error: 'Invalid JSON body' }, 400) }
  }

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        return { value: null, error: json(req, { error: 'Request body is too large' }, 413) }
      }
      chunks.push(value)
    }
  } catch {
    return { value: null, error: json(req, { error: 'Invalid request body' }, 400) }
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)), error: null }
  } catch {
    return { value: null, error: json(req, { error: 'Invalid JSON body' }, 400) }
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key))

export const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.length <= max ? value.trim() : null

export const requiredText = (value: unknown, max: number) => text(value, max) || null

export const optionalText = (value: unknown, max: number) => {
  if (value === null || value === undefined) return ''
  return text(value, max)
}

export function boundedStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
  minItems = 0,
): string[] | null {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) return null
  const items = value.map((item) => requiredText(item, maxLength))
  if (items.some((item) => item === null)) return null
  const strings = items as string[]
  return new Set(strings).size === strings.length ? strings : null
}

export function isoDate(value: unknown): string | null {
  const parsed = text(value, 10)
  if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return null
  const date = new Date(`${parsed}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === parsed ? parsed : null
}

export const isHeaderText = (value: unknown, max: number) =>
  typeof value === 'string' && value.length <= max && !/[\r\n]/.test(value)

export const headerText = (value: unknown, max: number) => {
  return isHeaderText(value, max) ? String(value).trim() || null : null
}

export const isEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const safeHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export function randomHex(byteLength = 32) {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(byteLength)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function signedEditToken(submissionKey: string): Promise<string | null> {
  const secret = Deno.env.get('EDIT_TOKEN_SIGNING_SECRET')
  if (!secret || secret.length < 32) return null
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(submissionKey))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyTurnstile(
  req: Request,
  token: string,
  expectedAction: string,
): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (
    !secret ||
    [
      '1x0000000000000000000000000000000AA',
      '2x0000000000000000000000000000000AA',
      '3x0000000000000000000000000000000AA',
    ].includes(secret) ||
    secret.length < 10 ||
    token.length < 10 ||
    token.length > 2_048
  ) return false

  const allowedHosts = new Set(
    (Deno.env.get('ALLOWED_ORIGINS') || '')
      .split(',')
      .map((origin) => {
        try {
          return new URL(origin.trim()).hostname
        } catch {
          return ''
        }
      })
      .filter(Boolean),
  )
  if (allowedHosts.size === 0) return false

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        response: token,
        secret,
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return false
    const result: unknown = await response.json()
    return isRecord(result) &&
      result.success === true &&
      result.action === expectedAction &&
      typeof result.hostname === 'string' &&
      allowedHosts.has(result.hostname)
  } catch {
    return false
  }
}

export function smtpConfig() {
  const from = Deno.env.get('FROM_EMAIL')?.trim()
  const host = Deno.env.get('SMTP_HOST')?.trim()
  const user = Deno.env.get('SMTP_USER')?.trim()
  const pass = Deno.env.get('SMTP_PASS')
  const port = Number(Deno.env.get('SMTP_PORT'))
  if (!from || !isEmail(from) || !host || !user || !pass ||
    !Number.isInteger(port) || port < 1 || port > 65_535) {
    return null
  }
  return { from, host, pass, port, user }
}

export async function authenticatedClient(
  req: Request,
  requiredEmail?: string,
): Promise<SupabaseClient | null> {
  const authorization = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !anonKey) return null

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser()
  const user = data.user
  const emailAllowed = !requiredEmail
    || user?.email?.toLowerCase() === requiredEmail.toLowerCase()
  return !error && user?.app_metadata?.staff === true && emailAllowed ? client : null
}

export function serviceRoleClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
