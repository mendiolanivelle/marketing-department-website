import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  createReconciliationRecorder,
  loadConfig,
  objectPathFor,
  parseArgs,
  parseDataUrl,
  renderMarkdown,
  runBackfill,
  sanitizeReport,
} from './backfill-legacy-private-storage.mjs'

const fixture = JSON.parse(await readFile(
  new URL('./fixtures/legacy-private-storage.json', import.meta.url),
  'utf8',
))
const fixtureServiceRoleKey = [
  'fixture-header',
  Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'),
  'fixture-signature',
].join('.')
const baseConfig = {
  baseUrl: 'https://abcdefghijklmnopqrst.supabase.co',
  serviceRoleKey: fixtureServiceRoleKey,
  projectRef: 'abcdefghijklmnopqrst',
  execute: false,
  pageSize: 10,
  maxBytes: 2 * 1024 * 1024,
}

function databaseFixtureFetch(methods) {
  return async (input, init = {}) => {
    const url = new URL(input)
    const method = init.method || 'GET'
    methods.push({ url, method, init })
    if (url.pathname === '/rest/v1/file_tracker_assets' && method === 'GET') {
      return Response.json(fixture.fileTrackerRows)
    }
    if (url.pathname === '/rest/v1/website_requests' && method === 'GET') {
      return Response.json(fixture.websiteRequestRows)
    }
    throw new Error(`Unexpected fixture request: ${method} ${url.pathname}`)
  }
}

test('strict data URL validation enforces size, encoding, and image MIME', () => {
  const text = parseDataUrl(fixture.fileTrackerRows[0].data_url)
  assert.equal(text.bytes.toString(), 'Hello')
  assert.equal(text.sha256, '185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969')
  assert.match(
    objectPathFor(text, 'fixture:text'),
    /^legacy\/[0-9a-f]{2}\/[0-9a-f]{64}\/[0-9a-f]{64}\.txt$/,
  )
  assert.notEqual(
    objectPathFor(text, 'fixture:text'),
    objectPathFor(text, 'fixture:second-row'),
  )

  const image = parseDataUrl(fixture.websiteRequestRows[0].attachments[0].dataUrl, {
    imageOnly: true,
  })
  assert.equal(image.mime, 'image/png')
  assert.throws(() => parseDataUrl('data:text/plain,Hello'), /invalid_data_url_metadata/)
  assert.throws(() => parseDataUrl('data:text/plain;base64,%%%='), /invalid_base64/)
  assert.throws(
    () => parseDataUrl('data:image/jpeg;base64,iVBORw0KGgo=', { imageOnly: true }),
    /image_mime_mismatch/,
  )
  assert.throws(
    () => parseDataUrl('data:text/plain;base64,SGVsbG8=', { maxBytes: 4 }),
    /invalid_file_size/,
  )
})

test('execution requires an exact project-ref confirmation', () => {
  const env = {
    SUPABASE_URL: baseConfig.baseUrl,
    SUPABASE_SERVICE_ROLE_KEY: baseConfig.serviceRoleKey,
  }
  assert.equal(parseArgs([]).execute, false)
  assert.throws(
    () => loadConfig(env, parseArgs(['--execute'])),
    /Pass --confirm-project-ref abcdefghijklmnopqrst exactly/,
  )
  assert.throws(
    () => loadConfig(env, parseArgs(['--execute', '--confirm-project-ref', 'wrong-project-ref'])),
    /Pass --confirm-project-ref abcdefghijklmnopqrst exactly/,
  )
  assert.equal(
    loadConfig(
      env,
      parseArgs(['--execute', '--confirm-project-ref', 'abcdefghijklmnopqrst']),
    ).execute,
    true,
  )
  const anonKey = [
    'fixture-header',
    Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url'),
    'fixture-signature',
  ].join('.')
  assert.throws(
    () => loadConfig(
      { ...env, SUPABASE_SERVICE_ROLE_KEY: anonKey },
      parseArgs([]),
    ),
    /not a valid server-side credential/,
  )
})

test('dry-run paginates fixtures without issuing writes or exposing source identifiers', async () => {
  const methods = []
  const report = await runBackfill(
    baseConfig,
    databaseFixtureFetch(methods),
    new Date('2026-07-30T12:00:00.000Z'),
  )

  assert.deepEqual(methods.map(call => call.method), ['GET', 'GET'])
  assert.equal(report.mode, 'dry-run')
  assert.equal(report.tables.file_tracker_assets.summary.statusCounts.planned, 1)
  assert.equal(report.tables.website_requests.summary.statusCounts.planned, 1)
  assert.equal(report.tables.website_requests.summary.statusCounts.already_migrated, 1)
  assert.equal(report.summary.logicalBytes > 5, true)
  assert.match(report.summary.aggregateSha256, /^[0-9a-f]{64}$/)

  const serialized = JSON.stringify(report)
  assert.doesNotMatch(serialized, /legacy-secret-filename|sensitive-screenshot/)
  const markdown = renderMarkdown(report)
  assert.doesNotMatch(markdown, /legacy-secret-filename|sensitive-screenshot/)
  assert.doesNotMatch(markdown, new RegExp(report.entries[0].sha256))
  for (const entry of sanitizeReport(report).entries) {
    assert.equal(Object.hasOwn(entry, 'sha256'), false)
    assert.equal(Object.hasOwn(entry, 'objectPath'), false)
    assert.equal(Object.hasOwn(entry, 'sizeBytes'), false)
  }
})

test('keyset pagination processes each fixture page once', async () => {
  const cursors = []
  const rows = [
    { ...fixture.fileTrackerRows[0], id: 'asset-a' },
    { ...fixture.fileTrackerRows[0], id: 'asset-b' },
  ]
  const fetchFixture = async input => {
    const url = new URL(input)
    if (url.pathname === '/rest/v1/website_requests') return Response.json([])
    assert.equal(url.pathname, '/rest/v1/file_tracker_assets')
    const cursor = url.searchParams.get('id')
    cursors.push(cursor)
    if (!cursor) return Response.json([rows[0]])
    if (cursor === 'gt.asset-a') return Response.json([rows[1]])
    if (cursor === 'gt.asset-b') return Response.json([])
    throw new Error(`Unexpected cursor: ${cursor}`)
  }

  const report = await runBackfill(
    { ...baseConfig, pageSize: 1 },
    fetchFixture,
    new Date('2026-07-30T12:00:00.000Z'),
  )
  assert.deepEqual(cursors, [null, 'gt.asset-a', 'gt.asset-b'])
  assert.equal(report.tables.file_tracker_assets.scannedRecords, 2)
  assert.equal(report.tables.file_tracker_assets.summary.statusCounts.planned, 2)
})

test('execute verifies existing objects and preserves inline values in partial updates', async () => {
  const methods = []
  const reconciliation = []
  const text = parseDataUrl(fixture.fileTrackerRows[0].data_url)
  const image = parseDataUrl(fixture.websiteRequestRows[0].attachments[0].dataUrl, {
    imageOnly: true,
  })
  const textPath = objectPathFor(
    text,
    `file_tracker_assets:${fixture.fileTrackerRows[0].id}`,
  )
  const imagePath = objectPathFor(
    image,
    `website_requests:${fixture.websiteRequestRows[0].id}:0`,
  )
  const objects = new Map([
    [textPath, text.bytes],
    [imagePath, image.bytes],
  ])

  const fetchFixture = async (input, init = {}) => {
    const url = new URL(input)
    const method = init.method || 'GET'
    methods.push({ url, method, init })
    if (url.pathname === '/rest/v1/file_tracker_assets' && method === 'GET') {
      return Response.json(fixture.fileTrackerRows)
    }
    if (url.pathname === '/rest/v1/website_requests' && method === 'GET') {
      return Response.json(fixture.websiteRequestRows)
    }
    if (url.pathname.startsWith('/storage/v1/object/') && method === 'POST') {
      assert.equal(init.headers['x-upsert'], 'false')
      return Response.json({ message: 'already exists' }, { status: 409 })
    }
    if (url.pathname.startsWith('/storage/v1/object/') && method === 'GET') {
      const marker = '/legacy/'
      const objectPath = decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + 1))
      const bytes = objects.get(objectPath)
      assert.ok(bytes, `fixture object missing for ${objectPath}`)
      return new Response(bytes, {
        status: 200,
        headers: { 'content-length': String(bytes.length) },
      })
    }
    if (url.pathname === '/rest/v1/file_tracker_assets' && method === 'PATCH') {
      const body = JSON.parse(init.body)
      assert.deepEqual(body, {
        storage_path: textPath,
        checksum_sha256: text.sha256,
      })
      assert.equal(Object.hasOwn(body, 'data_url'), false)
      assert.equal(url.searchParams.get('storage_path'), 'is.null')
      return Response.json([{ id: fixture.fileTrackerRows[0].id }])
    }
    if (url.pathname === '/rest/v1/website_requests' && method === 'PATCH') {
      const body = JSON.parse(init.body)
      assert.equal(
        body.attachments[0].dataUrl,
        fixture.websiteRequestRows[0].attachments[0].dataUrl,
      )
      assert.equal(body.attachments[0].path, imagePath)
      assert.equal(body.attachments[0].sha256, image.sha256)
      assert.equal(url.searchParams.get('updated_at'), `eq.${fixture.websiteRequestRows[0].updated_at}`)
      return Response.json([{ id: fixture.websiteRequestRows[0].id }])
    }
    throw new Error(`Unexpected fixture request: ${method} ${url.pathname}`)
  }

  const report = await runBackfill(
    { ...baseConfig, execute: true },
    fetchFixture,
    new Date('2026-07-30T12:00:00.000Z'),
    async entry => { reconciliation.push(entry) },
  )
  assert.equal(report.summary.statusCounts.migrated, 2)
  assert.equal(report.summary.statusCounts.already_migrated, 1)
  assert.equal(report.entries.filter(entry => entry.objectAction === 'verified_existing').length, 2)
  assert.equal(methods.some(call => call.method === 'PATCH'), true)
  assert.equal(methods.some(call => call.method === 'POST'), true)
  assert.equal(reconciliation.filter(entry => entry.event === 'planned').length, 2)
  assert.equal(reconciliation.filter(entry => entry.event === 'verified').length, 2)
})

test('execute creates a restricted write-ahead reconciliation manifest', async t => {
  const reportDir = await mkdtemp(path.join(tmpdir(), 'private-storage-reconciliation-'))
  t.after(async () => { await rm(reportDir, { recursive: true, force: true }) })

  const recorder = await createReconciliationRecorder(
    reportDir,
    { ...baseConfig, execute: true },
    new Date('2026-07-30T12:00:00.000Z'),
  )
  assert.ok(recorder.path)
  await recorder.record({
    event: 'planned',
    bucket: 'marketing-assets',
    objectPath: 'legacy/aa/opaque/object.txt',
    sha256: 'a'.repeat(64),
    sizeBytes: 5,
  })

  const mode = (await stat(recorder.path)).mode & 0o777
  assert.equal(mode, 0o600)
  const lines = (await readFile(recorder.path, 'utf8')).trim().split('\n')
  assert.equal(lines.length, 2)
  assert.equal(JSON.parse(lines[0]).classification, 'restricted-reconciliation')
  assert.equal(JSON.parse(lines[1]).objectPath, 'legacy/aa/opaque/object.txt')
})
