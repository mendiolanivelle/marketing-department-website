import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const routeBundle = await build({
  bundle: true,
  entryPoints: [
    fileURLToPath(new URL('../src/lib/activityRoutes.ts', import.meta.url)),
  ],
  format: 'esm',
  logLevel: 'silent',
  platform: 'node',
  target: 'node22',
  write: false,
})
const routeUrl = `data:text/javascript;base64,${Buffer.from(
  routeBundle.outputFiles[0].contents,
).toString('base64')}`
const { getActivityRouteName, getAuthenticatedActivityRouteName } = await import(routeUrl)

test('protected exact and dynamic routes receive activity names', () => {
  assert.equal(getActivityRouteName('/dashboard'), 'Dashboard')
  assert.equal(getActivityRouteName('/meeting-playbook'), 'Meeting Playbook')
  assert.equal(getActivityRouteName('/marketing-project-list'), 'Project List')
  assert.equal(getActivityRouteName('/view-acceptance/123'), 'Shared Acceptance View')
})

test('anonymous and public routes are excluded from a personal staff feed', () => {
  assert.equal(getActivityRouteName('/'), null)
  assert.equal(getActivityRouteName('/login'), null)
  assert.equal(getActivityRouteName('/acceptance-form'), null)
  assert.equal(getActivityRouteName('/submit-request'), null)
  assert.equal(getActivityRouteName('/edit-request/token-123'), null)
})

test('protected routes are logged only for an authenticated staff user', () => {
  assert.equal(getAuthenticatedActivityRouteName('/dashboard', false), null)
  assert.equal(getAuthenticatedActivityRouteName('/dashboard', true), 'Dashboard')
})
