import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePublicBuildEnv } from './validate-public-env.mjs'

const valid = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_real-key',
  VITE_TURNSTILE_SITE_KEY: '0x4AAAA_public-site-key',
}

test('public build environment rejects unsafe browser credentials', () => {
  assert.doesNotThrow(() => validatePublicBuildEnv({}))
  assert.doesNotThrow(() => validatePublicBuildEnv(valid))
  assert.doesNotThrow(() => validatePublicBuildEnv({ ...valid, VITE_PRIVATE_STORAGE_ENABLED: 'true' }))
  assert.doesNotThrow(() => validatePublicBuildEnv({ ...valid, VITE_PRIVATE_STORAGE_ENABLED: 'false' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_PRIVATE_STORAGE_ENABLED: 'yes' }))
  assert.doesNotThrow(() => validatePublicBuildEnv({ ...valid, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }))
  assert.throws(() => validatePublicBuildEnv({ VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_TURNSTILE_SITE_KEY: '' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_TURNSTILE_SITE_KEY: 'your_site_key' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_SUPABASE_URL: 'http://database.example.net' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_SUPABASE_ANON_KEY: 'your_publishable_anon_key' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_SUPABASE_ANON_KEY: 'sbp_management-token' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_SUPABASE_ANON_KEY: '"sbp_management-token"' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_SUPABASE_ANON_KEY: 'sb_secret_private-key' }))
  assert.throws(() => validatePublicBuildEnv({ ...valid, VITE_SUPABASE_ANON_KEY: 'service_role_key' }))

  const serviceRolePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')
  assert.throws(() => validatePublicBuildEnv({
    ...valid,
    VITE_SUPABASE_ANON_KEY: `header.${serviceRolePayload}.signature`,
  }))
})
