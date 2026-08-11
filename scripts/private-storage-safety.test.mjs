import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isDefiniteDatabaseRejection } from '../src/lib/databaseOutcome.js'
import { runPrivateStorageMaintenance } from '../src/lib/privateStorageFeature.js'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('private Storage writes fail closed and ambiguous outcomes preserve objects', async () => {
  const [storageMigration, enforcementMigration, storageLibrary, databaseOutcome, fileTracker, requests, backfill] =
    await Promise.all([
      read('../supabase/migrations/049_private_marketing_storage.sql'),
      read('../supabase/migrations/050_enforce_private_binary_writes.sql'),
      read('../src/lib/privateStorage.ts'),
      read('../src/lib/databaseOutcome.js'),
      read('../src/pages/FileTracker.tsx'),
      read('../src/pages/WebsiteRequests.tsx'),
      read('../tools/backfill-legacy-private-storage.mjs'),
    ])

  assert.match(storageMigration, /private_storage_writes_enabled\(\)/)
  assert.match(storageMigration, /writes_enabled boolean NOT NULL DEFAULT false/)
  assert.match(storageMigration, /cleanup_allowed boolean NOT NULL DEFAULT true/)
  assert.match(storageMigration, /jsonb_typeof\(OLD\.attachments\) = 'array'/)
  assert.match(storageMigration, /mark_private_storage_cleanup_safe/)
  assert.match(storageMigration, /A malformed legacy value could conceal a reference/)
  assert.match(storageMigration, /jsonb_typeof\(attachments\) <> 'array'/)
  assert.match(storageMigration, /consume_private_storage_review/)
  assert.match(storageMigration, /FOR UPDATE/)
  assert.match(storageMigration, /already scheduled for cleanup/)
  assert.match(storageMigration, /consume_file_tracker_storage_review/)
  assert.match(storageMigration, /consume_website_request_storage_review/)

  assert.match(enforcementMigration, /coalesce\(NEW\.checksum_sha256, ''\) !~/)
  assert.match(enforcementMigration, /NOT public\.private_storage_writes_enabled\(\)/)
  assert.match(enforcementMigration, /File tracker asset type is immutable/)
  assert.match(enforcementMigration, /UPDATE OF type, data_url, storage_path, checksum_sha256/)
  assert.match(enforcementMigration, /Links cannot contain private binary metadata/)

  assert.match(storageLibrary, /\.download\(objectPath\)/)
  assert.match(storageLibrary, /sha256Hex\(data\) === expectedSha256/)
  assert.match(storageLibrary, /\.eq\('cleanup_allowed', true\)/)
  assert.match(storageLibrary, /isDefiniteDatabaseRejection/)
  assert.match(storageLibrary, /mark_private_storage_cleanup_safe/)
  assert.match(databaseOutcome, /code\.startsWith\('22'\)/)
  assert.match(databaseOutcome, /code\.startsWith\('23'\)/)
  assert.match(databaseOutcome, /code === '42501'/)
  assert.doesNotMatch(databaseOutcome, /PGRST\\d/)
  assert.doesNotMatch(databaseOutcome, /\^\[0-9A-Z\]\{5\}\$/)

  assert.match(fileTracker, /\.maybeSingle\(\)/)
  assert.match(fileTracker, /UnknownAssetSaveOutcome/)
  assert.match(fileTracker, /const reviewReserved = await queuePrivateStorageCleanup/)
  assert.match(fileTracker, /data\.storage_path === asset\.storagePath/)
  assert.doesNotMatch(fileTracker, /data\.name === asset\.name/)
  assert.ok(
    fileTracker.indexOf('const reviewReserved = await queuePrivateStorageCleanup')
      < fileTracker.indexOf('const uploadOutcome = await uploadPrivateObject'),
  )
  assert.match(requests, /\.maybeSingle\(\)/)
  assert.match(requests, /UnknownRequestSaveOutcome/)
  assert.match(requests, /const reviewReserved = await queuePrivateStorageCleanup/)
  assert.ok(
    requests.indexOf('const reviewReserved = await queuePrivateStorageCleanup')
      < requests.indexOf('const uploadOutcome = await uploadPrivateObject'),
  )

  const plannedAt = backfill.indexOf("event: 'planned'")
  const uploadAt = backfill.indexOf('await ensureObject', plannedAt)
  assert.ok(plannedAt >= 0 && uploadAt > plannedAt)
  assert.match(backfill, /restricted-reconciliation-/)
  assert.match(backfill, /mode: 0o600/)
})

test('only guaranteed database rejections permit compensating cleanup', () => {
  for (const code of ['22001', '22P02', '23505', '23514', '42501']) {
    assert.equal(isDefiniteDatabaseRejection({ code }), true, code)
  }
  for (const code of ['08007', '08006', '40003', '40001', 'PGRST000', 'PGRST204']) {
    assert.equal(isDefiniteDatabaseRejection({ code }), false, code)
  }
  assert.equal(isDefiniteDatabaseRejection(new TypeError('network failed')), false)
  assert.equal(isDefiniteDatabaseRejection(null), false)
})

test('disabled private Storage skips maintenance requests', async () => {
  let calls = 0
  const result = await runPrivateStorageMaintenance(false, async () => {
    calls += 1
    return false
  })

  assert.equal(result, true)
  assert.equal(calls, 0)
})

test('enabled private Storage runs maintenance once', async () => {
  let calls = 0
  const result = await runPrivateStorageMaintenance(true, async () => {
    calls += 1
    return false
  })

  assert.equal(result, false)
  assert.equal(calls, 1)
})
