import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const placeholderPattern = /(?:^|[._-])(your|example|placeholder|replace(?:me)?|changeme|todo|test)(?:[._-]|$)/i
const turnstileTestSiteKeys = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
])

function isLoopback(hostname) {
  return hostname === 'localhost'
    || hostname === '[::1]'
    || hostname === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname)
}

function invalid(message) {
  throw new Error(`Invalid public build environment: ${message}`)
}

function cleanValue(value) {
  return String(value || '').trim().replace(/^(['"`])([\s\S]*)\1$/, '$2').trim()
}

export function validatePublicBuildEnv(env = process.env) {
  const urlValue = cleanValue(env.VITE_SUPABASE_URL)
  const keyValue = cleanValue(env.VITE_SUPABASE_ANON_KEY)
  const turnstileSiteKey = cleanValue(env.VITE_TURNSTILE_SITE_KEY)
  const privateStorageEnabled = cleanValue(env.VITE_PRIVATE_STORAGE_ENABLED)
  if (privateStorageEnabled && !['true', 'false'].includes(privateStorageEnabled)) {
    invalid('VITE_PRIVATE_STORAGE_ENABLED must be true or false')
  }
  if (!urlValue && !keyValue && !turnstileSiteKey) return
  if (!urlValue || !keyValue || !turnstileSiteKey) {
    invalid('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_TURNSTILE_SITE_KEY are required together')
  }

  let url
  try {
    url = new URL(urlValue)
  } catch {
    invalid('VITE_SUPABASE_URL must be a valid URL')
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    invalid('VITE_SUPABASE_URL must use HTTPS')
  }
  if (placeholderPattern.test(url.hostname)) invalid('VITE_SUPABASE_URL still contains a placeholder')

  const lowerKey = keyValue.toLowerCase()
  if (placeholderPattern.test(keyValue)) invalid('VITE_SUPABASE_ANON_KEY still contains a placeholder')
  if (lowerKey.startsWith('sbp_') || lowerKey.startsWith('sb_secret_')) {
    invalid('VITE_SUPABASE_ANON_KEY must be a publishable key')
  }
  if (/(?:^|[._-])service[_-]?role(?:[._-]|$)/i.test(keyValue)) {
    invalid('VITE_SUPABASE_ANON_KEY must not be a service-role key')
  }

  const jwtParts = keyValue.split('.')
  if (jwtParts.length === 3) {
    let payload
    try {
      payload = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'))
    } catch {
      invalid('VITE_SUPABASE_ANON_KEY contains an invalid JWT')
    }
    if (payload?.role !== 'anon') invalid('VITE_SUPABASE_ANON_KEY JWT role must be anon')
  }

  if (turnstileSiteKey) {
    if (
      placeholderPattern.test(turnstileSiteKey) ||
      turnstileTestSiteKeys.has(turnstileSiteKey) ||
      !/^[A-Za-z0-9_-]{10,100}$/.test(turnstileSiteKey)
    ) {
      invalid('VITE_TURNSTILE_SITE_KEY must be a valid public site key')
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    validatePublicBuildEnv()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
