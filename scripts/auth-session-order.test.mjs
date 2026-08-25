import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const authSessionOrderBundle = await build({
  bundle: true,
  entryPoints: [
    fileURLToPath(new URL('../src/lib/authSessionOrder.ts', import.meta.url)),
  ],
  format: 'esm',
  logLevel: 'silent',
  platform: 'node',
  target: 'node22',
  write: false,
})
const authSessionOrderUrl = `data:text/javascript;base64,${Buffer.from(
  authSessionOrderBundle.outputFiles[0].contents,
).toString('base64')}`
const {
  applyAuthEventSession,
  beginAuthSessionRead,
  createAuthSessionOrder,
  isAuthSessionReadCurrent,
  supersedeAuthSessionReads,
} = await import(authSessionOrderUrl)

test('a null INITIAL_SESSION event clears stale authenticated ownership', () => {
  let currentUser = 'stale-user'

  const authorized = applyAuthEventSession(null, session => {
    currentUser = session?.userId ?? null
    return Boolean(session)
  })

  assert.equal(authorized, false)
  assert.equal(currentUser, null)
})

test('a stale startup session cannot overwrite newer signed-out and signed-in events', () => {
  const order = createAuthSessionOrder()
  const startupRead = beginAuthSessionRead(order)
  let currentUser = 'startup-user'

  supersedeAuthSessionReads(order)
  currentUser = null
  supersedeAuthSessionReads(order)
  currentUser = 'new-user'

  if (isAuthSessionReadCurrent(order, startupRead)) {
    currentUser = 'stale-user'
  }

  assert.equal(currentUser, 'new-user')
  assert.equal(isAuthSessionReadCurrent(order, startupRead), false)
})
