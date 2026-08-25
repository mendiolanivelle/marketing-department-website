import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const activityStateBundle = await build({
  bundle: true,
  entryPoints: [
    fileURLToPath(new URL('../src/lib/activityState.ts', import.meta.url)),
  ],
  format: 'esm',
  logLevel: 'silent',
  platform: 'node',
  target: 'node22',
  write: false,
})
const activityStateUrl = `data:text/javascript;base64,${Buffer.from(
  activityStateBundle.outputFiles[0].contents,
).toString('base64')}`
const {
  createPendingActivity,
  mergeActivityEntries,
  setActivityDeliveryStatus,
  visibleActivityEntries,
} = await import(activityStateUrl)

test('a failed activity remains visible and can return to pending before retry', () => {
  const entry = createPendingActivity(
    1_234_567,
    'Campaigns',
    'Created campaign "Launch"',
    new Date('2026-08-25T04:30:00.000Z'),
  )

  assert.deepEqual(entry, {
    id: 1_234_567,
    action: 'Campaigns',
    detail: 'Created campaign "Launch"',
    timestamp: '2026-08-25T04:30:00.000Z',
    deliveryStatus: 'pending',
  })

  const failed = setActivityDeliveryStatus([entry], entry.id, 'failed')
  assert.equal(failed[0].deliveryStatus, 'failed')

  const retrying = setActivityDeliveryStatus(failed, entry.id, 'pending')
  assert.equal(retrying[0].deliveryStatus, 'pending')
})

test('remote refresh keeps unsent entries and marks canonical entries saved', () => {
  const failed = {
    ...createPendingActivity(9001, 'Files', 'Uploaded "brief.pdf"'),
    deliveryStatus: 'failed',
  }
  const pending = createPendingActivity(9002, 'Timeline', 'Moved lead "Acme"')
  const alreadySaved = {
    ...createPendingActivity(88, 'Calendar', 'Created "Kickoff"'),
    deliveryStatus: 'saved',
  }
  const remote = [
    {
      id: 88,
      action: 'Calendar',
      detail: 'Created "Kickoff"',
      timestamp: alreadySaved.timestamp,
    },
    {
      id: 77,
      action: 'Dashboard',
      detail: 'Added task "Review copy"',
      timestamp: '2026-08-24T10:00:00.000Z',
    },
  ]

  assert.deepEqual(
    mergeActivityEntries([failed, pending, alreadySaved], remote),
    [
      failed,
      pending,
      { ...remote[0], deliveryStatus: 'saved' },
      { ...remote[1], deliveryStatus: 'saved' },
    ],
  )
})

test('a stale refresh cannot hide an activity saved while the request was in flight', () => {
  const justSaved = {
    ...createPendingActivity(
      101,
      'Campaigns',
      'Created campaign "Launch"',
      new Date('2026-08-25T04:31:00.000Z'),
    ),
    deliveryStatus: 'saved',
  }
  const olderRemote = {
    id: 88,
    action: 'Calendar',
    detail: 'Created "Kickoff"',
    timestamp: '2026-08-25T04:30:00.000Z',
  }

  assert.deepEqual(
    mergeActivityEntries([justSaved], [olderRemote], true),
    [justSaved, { ...olderRemote, deliveryStatus: 'saved' }],
  )
  assert.deepEqual(
    mergeActivityEntries([justSaved], [olderRemote], false),
    [{ ...olderRemote, deliveryStatus: 'saved' }],
  )
})

test('Recent Activity shows eight entries until the user expands it', () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    action: 'Navigation',
    detail: `Opened page ${index + 1}`,
    timestamp: '2026-08-25T04:30:00.000Z',
    deliveryStatus: 'saved',
  }))

  assert.equal(visibleActivityEntries(entries, false).length, 8)
  assert.equal(visibleActivityEntries(entries, true).length, 12)
})
