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
  createActivityId,
  createPendingActivity,
  isSameCanonicalActivity,
  mergeActivityEntries,
  setActivityDeliveryStatus,
  visibleActivityEntries,
} = await import(activityStateUrl)

const activityLoggerBundle = await build({
  bundle: true,
  entryPoints: [
    fileURLToPath(new URL('../src/lib/activityLogger.ts', import.meta.url)),
  ],
  format: 'esm',
  logLevel: 'silent',
  platform: 'node',
  target: 'node22',
  write: false,
  plugins: [{
    name: 'activity-supabase-test-double',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^\.\/supabase$/ }, () => ({
        path: 'activity-supabase-double',
        namespace: 'activity-test',
      }))
      buildContext.onLoad({ filter: /.*/, namespace: 'activity-test' }, () => ({
        contents: [
          'export const isSupabaseConfigured = true',
          'export const supabase = globalThis.__activitySupabase',
        ].join('\n'),
        loader: 'js',
      }))
    },
  }],
})
const activityLoggerUrl = `data:text/javascript;base64,${Buffer.from(
  activityLoggerBundle.outputFiles[0].contents,
).toString('base64')}`
let loggerImportSequence = 0

const importActivityLogger = async (supabase, storage = new Map()) => {
  globalThis.__activitySupabase = supabase
  globalThis.window = {
    dispatchEvent() {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  }
  loggerImportSequence += 1
  return import(`${activityLoggerUrl}#${loggerImportSequence}`)
}

const deferred = () => {
  let resolve
  const promise = new Promise(resolvePromise => { resolve = resolvePromise })
  return { promise, resolve }
}

const makeActivityClient = ({ insertResult, loadResult, existingResult }) => ({
  from() {
    return {
      insert() {
        return {
          select() {
            return {
              single: async () => insertResult ?? {
                data: null,
                error: new Error('No insert result configured'),
              },
            }
          },
        }
      },
      select() {
        return {
          eq(_column, id) {
            return {
              maybeSingle: async () => existingResult?.(id) ?? ({ data: null, error: null }),
            }
          },
          order() {
            return {
              limit: () => loadResult ?? Promise.resolve({ data: [], error: null }),
            }
          },
        }
      },
    }
  },
})

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

test('activity IDs stay unique during a burst and remain safe bigint inputs', () => {
  const ids = Array.from({ length: 2_000 }, () => createActivityId())

  assert.equal(new Set(ids).size, ids.length)
  assert.equal(ids.every(id => Number.isSafeInteger(id) && id > 0), true)
})

test('idempotent recovery accepts only the same canonical activity', () => {
  const pending = createPendingActivity(
    42,
    'Timeline',
    'Added note to "Acme"',
    new Date('2026-08-25T04:30:00.000Z'),
  )

  assert.equal(isSameCanonicalActivity({
    id: 42,
    action: 'Timeline',
    detail: 'Added note to "Acme"',
    timestamp: '2026-08-25T04:30:00.000Z',
  }, pending), true)
  assert.equal(isSameCanonicalActivity({
    id: 42,
    action: 'Timeline',
    detail: 'Deleted a note from "Acme"',
    timestamp: '2026-08-25T04:30:00.000Z',
  }, pending), false)
})

test('a primary-key collision cannot replace a pending event with different canonical content', async () => {
  const client = makeActivityClient({
    insertResult: { data: null, error: { code: '23505' } },
    existingResult: id => ({
      data: {
        id,
        action: 'Timeline',
        detail: 'Deleted a note from "Other company"',
        timestamp: '2026-08-25T04:30:00.000Z',
      },
      error: null,
    }),
  })
  const logger = await importActivityLogger(client)
  logger.setActivityUser('user-a')

  const originalConsoleError = console.error
  console.error = () => {}
  let result
  try {
    result = await logger.logActivity('Timeline', 'Added note to "Acme"')
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(result?.deliveryStatus, 'failed')
  assert.equal(result?.detail, 'Added note to "Acme"')
})

test('anonymous activity is discarded instead of entering the next user feed', async () => {
  const client = makeActivityClient({})
  const logger = await importActivityLogger(client)

  assert.equal(await logger.logActivity('Navigation', 'Opened Dashboard'), null)
  assert.deepEqual(logger.getActivityLog(), [])

  logger.setActivityUser('user-b')
  assert.deepEqual(logger.getActivityLog(), [])
})

test('an in-flight load from one user cannot merge into another user feed', async () => {
  const userALoad = deferred()
  const client = makeActivityClient({ loadResult: userALoad.promise })
  const logger = await importActivityLogger(client)

  logger.setActivityUser('user-a')
  const loadPromise = logger.loadActivityLog()
  logger.setActivityUser('user-b')
  userALoad.resolve({
    data: [{
      id: 1,
      action: 'Files',
      detail: 'Opened user A file',
      timestamp: '2026-08-25T04:30:00.000Z',
    }],
    error: null,
  })

  await loadPromise
  assert.deepEqual(logger.getActivityLog(), [])
})

test('database-unavailable activity remains failed and is restored only for its owner', async () => {
  const storage = new Map()
  const firstLogger = await importActivityLogger(null, storage)
  firstLogger.setActivityUser('user-a')

  const failed = await firstLogger.logActivity('Files', 'Upload failed for "brief.pdf"')
  assert.equal(failed?.deliveryStatus, 'failed')

  const reloadedLogger = await importActivityLogger(null, storage)
  reloadedLogger.setActivityUser('user-b')
  assert.deepEqual(reloadedLogger.getActivityLog(), [])
  reloadedLogger.setActivityUser('user-a')
  assert.deepEqual(
    reloadedLogger.getActivityLog().map(entry => ({ action: entry.action, status: entry.deliveryStatus })),
    [{ action: 'Files', status: 'failed' }],
  )
})
