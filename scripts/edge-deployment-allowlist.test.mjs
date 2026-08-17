import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const expectedRecoveryFunctions = [
  'send-edit-link',
  'public-marketing-request',
  'public-acceptance-form',
  'send-ticket-email',
]

test('production Edge deployment is limited to the reviewed recovery functions', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/deploy-supabase-functions.yml', import.meta.url),
    'utf8',
  )
  const targets = [...workflow.matchAll(
    /supabase functions deploy(?:\s+([a-z0-9-]+))?\s+--project-ref/g,
  )].map(match => match[1] || null)

  assert.deepEqual(targets, expectedRecoveryFunctions)
})
