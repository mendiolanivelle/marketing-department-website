import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const authActivityBundle = await build({
  bundle: true,
  entryPoints: [
    fileURLToPath(new URL('../src/lib/authActivity.ts', import.meta.url)),
  ],
  format: 'esm',
  logLevel: 'silent',
  platform: 'node',
  target: 'node22',
  write: false,
})
const authActivityUrl = `data:text/javascript;base64,${Buffer.from(
  authActivityBundle.outputFiles[0].contents,
).toString('base64')}`
const { signOutWithActivity } = await import(authActivityUrl)

test('activity persistence cannot block the authentication sign-out call', async () => {
  let signOutCalled = false
  const neverSettles = new Promise(() => {})

  const result = await signOutWithActivity(
    async () => {
      signOutCalled = true
      return { error: null }
    },
    () => neverSettles,
  )

  assert.equal(signOutCalled, true)
  assert.equal(result.error, null)
})

test('failed sign-out is recorded as failed and never as successful', async () => {
  const details = []
  const error = new Error('network unavailable')

  const result = await signOutWithActivity(
    async () => ({ error }),
    detail => { details.push(detail) },
  )

  assert.equal(result.error, error)
  assert.deepEqual(details, ['Sign-out requested', 'Sign-out failed'])
  assert.equal(details.includes('Signed out'), false)
})

test('a synchronous activity-recorder failure cannot prevent sign-out', async () => {
  let signOutCalled = false

  const result = await signOutWithActivity(
    async () => {
      signOutCalled = true
      return { error: null }
    },
    () => { throw new Error('activity recorder unavailable') },
  )

  assert.equal(signOutCalled, true)
  assert.equal(result.error, null)
})

test('a rejected sign-out is normalized and records the failure outcome', async () => {
  const details = []
  const error = new Error('sign-out request rejected')

  const result = await signOutWithActivity(
    async () => { throw error },
    detail => { details.push(detail) },
  )

  assert.equal(result.error, error)
  assert.deepEqual(details, ['Sign-out requested', 'Sign-out failed'])
})

test('a rejected activity-recorder promise is contained', async () => {
  const result = await signOutWithActivity(
    async () => ({ error: null }),
    async () => { throw new Error('activity persistence rejected') },
  )

  assert.equal(result.error, null)
})
