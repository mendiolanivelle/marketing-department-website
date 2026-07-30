#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { appendFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const MAX_BYTES = 2 * 1024 * 1024
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100
const IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const EXTENSIONS = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
  ['text/plain', 'txt'],
])

class BackfillError extends Error {
  constructor(code, message = code) {
    super(message)
    this.name = 'BackfillError'
    this.code = code
  }
}

export function parseArgs(argv) {
  const args = {
    execute: false,
    confirmProjectRef: null,
    pageSize: DEFAULT_PAGE_SIZE,
    reportDir: 'reports/private-storage-backfill',
    help: false,
  }
  const seen = new Set()

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (!['--execute', '--confirm-project-ref', '--page-size', '--report-dir', '--help'].includes(flag)) {
      throw new BackfillError('invalid_argument', `Unknown argument: ${flag}`)
    }
    if (seen.has(flag)) throw new BackfillError('duplicate_argument', `Duplicate argument: ${flag}`)
    seen.add(flag)

    if (flag === '--execute') args.execute = true
    else if (flag === '--help') args.help = true
    else {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new BackfillError('missing_argument_value', `${flag} requires a value`)
      }
      index += 1
      if (flag === '--confirm-project-ref') args.confirmProjectRef = value
      if (flag === '--report-dir') args.reportDir = value
      if (flag === '--page-size') {
        const pageSize = Number(value)
        if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
          throw new BackfillError(
            'invalid_page_size',
            `--page-size must be an integer from 1 to ${MAX_PAGE_SIZE}`,
          )
        }
        args.pageSize = pageSize
      }
    }
  }

  if (!args.execute && args.confirmProjectRef) {
    throw new BackfillError(
      'unused_confirmation',
      '--confirm-project-ref is only accepted with --execute',
    )
  }
  return args
}

export function loadConfig(env, args) {
  const rawUrl = env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !serviceRoleKey) {
    throw new BackfillError(
      'missing_environment',
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the process environment.',
    )
  }

  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BackfillError('invalid_supabase_url', 'SUPABASE_URL must be a valid URL.')
  }
  const hostMatch = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)
  if (
    url.protocol !== 'https:'
    || !hostMatch
    || url.username
    || url.password
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash
  ) {
    throw new BackfillError(
      'invalid_supabase_url',
      'SUPABASE_URL must be the canonical HTTPS project URL.',
    )
  }
  let legacyRole = null
  if (serviceRoleKey.split('.').length === 3) {
    try {
      legacyRole = JSON.parse(
        Buffer.from(serviceRoleKey.split('.')[1], 'base64url').toString('utf8'),
      ).role
    } catch {
      legacyRole = null
    }
  }
  if (
    /\s/.test(serviceRoleKey)
    || (
      !(serviceRoleKey.startsWith('sb_secret_') && serviceRoleKey.length >= 20)
      && legacyRole !== 'service_role'
    )
  ) {
    throw new BackfillError(
      'invalid_service_role_key',
      'SUPABASE_SERVICE_ROLE_KEY is not a valid server-side credential.',
    )
  }

  const projectRef = hostMatch[1]
  if (args.execute && args.confirmProjectRef !== projectRef) {
    throw new BackfillError(
      'project_confirmation_mismatch',
      `Refusing writes. Pass --confirm-project-ref ${projectRef} exactly.`,
    )
  }

  return {
    baseUrl: url.origin,
    serviceRoleKey,
    projectRef,
    execute: args.execute,
    pageSize: args.pageSize,
    maxBytes: MAX_BYTES,
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function decodedSize(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return (base64.length / 4) * 3 - padding
}

function sniffImageMime(bytes) {
  if (
    bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 6
    && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))
  ) return 'image/gif'
  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp'
  if (
    bytes.length >= 16
    && bytes.subarray(4, 8).toString('ascii') === 'ftyp'
    && /avif|avis/.test(bytes.subarray(8, Math.min(bytes.length, 32)).toString('ascii'))
  ) return 'image/avif'
  return null
}

export function parseDataUrl(value, { maxBytes = MAX_BYTES, imageOnly = false } = {}) {
  if (typeof value !== 'string' || !value.startsWith('data:')) {
    throw new BackfillError('invalid_data_url')
  }
  const comma = value.indexOf(',')
  if (comma < 6) throw new BackfillError('invalid_data_url')

  const metadata = value.slice(5, comma)
  const parts = metadata.split(';')
  const mime = parts.shift()?.toLowerCase()
  if (
    !mime
    || !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mime)
    || parts.length !== 1
    || parts[0].toLowerCase() !== 'base64'
  ) {
    throw new BackfillError('invalid_data_url_metadata')
  }
  if (imageOnly && !IMAGE_MIME_TYPES.has(mime)) {
    throw new BackfillError('unsupported_image_mime')
  }

  const base64 = value.slice(comma + 1)
  if (base64.length > Math.ceil(maxBytes / 3) * 4) {
    throw new BackfillError('invalid_file_size')
  }
  if (
    !base64
    || base64.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    throw new BackfillError('invalid_base64')
  }
  const size = decodedSize(base64)
  if (size < 1 || size > maxBytes) throw new BackfillError('invalid_file_size')

  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length !== size) throw new BackfillError('invalid_base64')
  if (imageOnly && sniffImageMime(bytes) !== mime) {
    throw new BackfillError('image_mime_mismatch')
  }

  return { bytes, mime, size, sha256: sha256(bytes) }
}

export function objectPathFor(parsed, sourceScope) {
  if (typeof sourceScope !== 'string' || sourceScope.length < 3) {
    throw new BackfillError('invalid_source_scope')
  }
  const extension = EXTENSIONS.get(parsed.mime) || 'bin'
  const scopeHash = sha256(Buffer.from(sourceScope))
  return `legacy/${scopeHash.slice(0, 2)}/${scopeHash}/${parsed.sha256}.${extension}`
}

function authHeaders(config) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  }
}

function apiError(operation, status) {
  return new BackfillError(`${operation}_http_${status}`)
}

async function* readRowPages(config, fetchImpl, table, select, filters = {}) {
  let cursor = null

  while (true) {
    const url = new URL(`/rest/v1/${table}`, config.baseUrl)
    url.searchParams.set('select', select)
    url.searchParams.set('order', 'id.asc')
    url.searchParams.set('limit', String(config.pageSize))
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value)
    if (cursor !== null) url.searchParams.set('id', `gt.${cursor}`)

    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { ...authHeaders(config), Accept: 'application/json' },
    })
    if (!response.ok) throw apiError(`${table}_read`, response.status)
    const page = await response.json()
    if (!Array.isArray(page)) throw new BackfillError(`${table}_invalid_response`)
    if (page.length === 0) break
    for (const row of page) {
      if (!row || typeof row.id !== 'string') {
        throw new BackfillError(`${table}_invalid_row`)
      }
    }
    yield page
    if (page.length < config.pageSize) break
    const nextCursor = page.at(-1).id
    if (nextCursor === cursor) throw new BackfillError(`${table}_pagination_stalled`)
    cursor = nextCursor
  }
}

function encodedObjectPath(bucket, objectPath) {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
  return `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`
}

async function downloadAndVerify(config, fetchImpl, bucket, objectPath, parsed) {
  const response = await fetchImpl(
    new URL(encodedObjectPath(bucket, objectPath), config.baseUrl),
    { method: 'GET', headers: authHeaders(config) },
  )
  if (!response.ok) throw apiError('storage_verify', response.status)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > parsed.size) {
    throw new BackfillError('storage_size_mismatch')
  }
  const stored = Buffer.from(await response.arrayBuffer())
  if (stored.length !== parsed.size) throw new BackfillError('storage_size_mismatch')
  if (sha256(stored) !== parsed.sha256) throw new BackfillError('storage_checksum_mismatch')
}

async function ensureObject(config, fetchImpl, bucket, objectPath, parsed) {
  if (!config.execute) throw new BackfillError('write_blocked_in_dry_run')
  const url = new URL(encodedObjectPath(bucket, objectPath), config.baseUrl)
  const upload = await fetchImpl(url, {
    method: 'POST',
    headers: {
      ...authHeaders(config),
      'Content-Type': parsed.mime,
      'x-upsert': 'false',
    },
    body: parsed.bytes,
  })
  let objectAction = 'uploaded'
  if (!upload.ok) {
    objectAction = 'verified_existing'
    const existing = await fetchImpl(url, { method: 'GET', headers: authHeaders(config) })
    if (!existing.ok) throw apiError('storage_upload', upload.status)
    const contentLength = Number(existing.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > parsed.size) {
      throw new BackfillError('storage_size_mismatch')
    }
    const stored = Buffer.from(await existing.arrayBuffer())
    if (stored.length !== parsed.size) throw new BackfillError('storage_size_mismatch')
    if (sha256(stored) !== parsed.sha256) throw new BackfillError('storage_checksum_mismatch')
    return objectAction
  }
  await downloadAndVerify(config, fetchImpl, bucket, objectPath, parsed)
  return objectAction
}

async function patchRow(config, fetchImpl, table, id, body, filters = {}) {
  if (!config.execute) throw new BackfillError('write_blocked_in_dry_run')
  const url = new URL(`/rest/v1/${table}`, config.baseUrl)
  url.searchParams.set('id', `eq.${id}`)
  url.searchParams.set('select', 'id')
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value)
  const response = await fetchImpl(url, {
    method: 'PATCH',
    headers: {
      ...authHeaders(config),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw apiError(`${table}_update`, response.status)
  const updated = await response.json()
  if (!Array.isArray(updated)) throw new BackfillError(`${table}_invalid_update_response`)
  if (updated.length > 1) throw new BackfillError(`${table}_non_unique_update`)
  return updated.length === 1
}

function safeCode(error) {
  return error instanceof BackfillError ? error.code : 'unexpected_error'
}

function baseEntry(source, parsed, objectPath) {
  return {
    source,
    status: 'planned',
    sizeBytes: parsed.size,
    sha256: parsed.sha256,
    objectPath,
    objectAction: 'not_checked',
  }
}

async function processFileTracker(config, fetchImpl, report, ensureCached) {
  const pages = readRowPages(
    config,
    fetchImpl,
    'file_tracker_assets',
    'id,data_url,storage_path,checksum_sha256',
    { data_url: 'not.is.null' },
  )
  for await (const rows of pages) {
    report.tables.file_tracker_assets.scannedRecords += rows.length
    for (const row of rows) {
      if (typeof row.storage_path === 'string' && row.storage_path) {
        report.entries.push({
          source: 'file_tracker_assets',
          status: 'already_migrated',
        sizeBytes: null,
        sha256: typeof row.checksum_sha256 === 'string' ? row.checksum_sha256 : null,
        objectPath: null,
          objectAction: 'not_checked',
        })
        continue
      }

      let parsed
      try {
        parsed = parseDataUrl(row.data_url, { maxBytes: config.maxBytes })
      } catch (error) {
        report.entries.push({
          source: 'file_tracker_assets',
          status: 'invalid',
          sizeBytes: null,
          sha256: null,
          objectPath: null,
          objectAction: 'not_checked',
          reason: safeCode(error),
        })
        continue
      }

      const objectPath = objectPathFor(parsed, `file_tracker_assets:${row.id}`)
      const entry = baseEntry('file_tracker_assets', parsed, objectPath)
      if (!config.execute) {
        report.entries.push(entry)
        continue
      }

      try {
        entry.objectAction = await ensureCached('marketing-assets', objectPath, parsed)
        const updated = await patchRow(
          config,
          fetchImpl,
          'file_tracker_assets',
          row.id,
          { storage_path: objectPath, checksum_sha256: parsed.sha256 },
          { storage_path: 'is.null' },
        )
        entry.status = updated ? 'migrated' : 'conflict'
      } catch (error) {
        entry.status = 'failed'
        entry.reason = safeCode(error)
      }
      report.entries.push(entry)
    }
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function processWebsiteRequests(config, fetchImpl, report, ensureCached) {
  const pages = readRowPages(
    config,
    fetchImpl,
    'website_requests',
    'id,attachments,updated_at',
    { attachments: 'not.is.null' },
  )
  for await (const rows of pages) {
    report.tables.website_requests.scannedRecords += rows.length
    for (const row of rows) {
      if (!Array.isArray(row.attachments)) {
        report.entries.push({
          source: 'website_requests',
          status: 'invalid',
          sizeBytes: null,
          sha256: null,
          objectPath: null,
          objectAction: 'not_checked',
          reason: 'invalid_attachments_json',
        })
        continue
      }

      const nextAttachments = [...row.attachments]
      const successful = []
      for (let index = 0; index < row.attachments.length; index += 1) {
        const attachment = row.attachments[index]
        if (!isObject(attachment)) {
          report.entries.push({
            source: 'website_requests',
            status: 'invalid',
            sizeBytes: null,
            sha256: null,
            objectPath: null,
            objectAction: 'not_checked',
            reason: 'invalid_attachment',
          })
          continue
        }
        if (typeof attachment.path === 'string' && attachment.path) {
          report.entries.push({
            source: 'website_requests',
            status: 'already_migrated',
            sizeBytes: Number.isInteger(attachment.size) ? attachment.size : null,
            sha256: typeof attachment.sha256 === 'string' ? attachment.sha256 : null,
            objectPath: null,
            objectAction: 'not_checked',
          })
          continue
        }
        if (!Object.hasOwn(attachment, 'dataUrl')) {
          report.entries.push({
            source: 'website_requests',
            status: 'skipped',
            sizeBytes: null,
            sha256: null,
            objectPath: null,
            objectAction: 'not_checked',
            reason: 'no_inline_data',
          })
          continue
        }

        let parsed
        try {
          parsed = parseDataUrl(attachment.dataUrl, {
            maxBytes: config.maxBytes,
            imageOnly: true,
          })
        } catch (error) {
          report.entries.push({
            source: 'website_requests',
            status: 'invalid',
            sizeBytes: null,
            sha256: null,
            objectPath: null,
            objectAction: 'not_checked',
            reason: safeCode(error),
          })
          continue
        }

        const objectPath = objectPathFor(
          parsed,
          `website_requests:${row.id}:${index}`,
        )
        const entry = baseEntry('website_requests', parsed, objectPath)
        if (!config.execute) {
          report.entries.push(entry)
          continue
        }

        try {
          entry.objectAction = await ensureCached(
            'website-request-attachments',
            objectPath,
            parsed,
          )
          nextAttachments[index] = {
            ...attachment,
            path: objectPath,
            size: parsed.size,
            sha256: parsed.sha256,
          }
          successful.push(entry)
        } catch (error) {
          entry.status = 'failed'
          entry.reason = safeCode(error)
          report.entries.push(entry)
        }
      }

      if (!config.execute || successful.length === 0) continue
      try {
        const updatedAtFilter = typeof row.updated_at === 'string'
          ? `eq.${row.updated_at}`
          : 'is.null'
        const updated = await patchRow(
          config,
          fetchImpl,
          'website_requests',
          row.id,
          { attachments: nextAttachments },
          { updated_at: updatedAtFilter },
        )
        for (const entry of successful) {
          entry.status = updated ? 'migrated' : 'conflict'
          report.entries.push(entry)
        }
      } catch (error) {
        for (const entry of successful) {
          entry.status = 'failed'
          entry.reason = safeCode(error)
          report.entries.push(entry)
        }
      }
    }
  }
}

function summarizeEntries(entries) {
  const statusCounts = {}
  let logicalBytes = 0
  const unique = new Map()
  const checksumLines = []

  for (const entry of entries) {
    statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1
    if (Number.isInteger(entry.sizeBytes)) logicalBytes += entry.sizeBytes
    if (entry.objectPath && Number.isInteger(entry.sizeBytes)) {
      unique.set(entry.objectPath, entry.sizeBytes)
    }
    if (entry.sha256 && Number.isInteger(entry.sizeBytes)) {
      checksumLines.push(`${entry.sha256}:${entry.sizeBytes}`)
    }
  }

  return {
    items: entries.length,
    logicalBytes,
    uniqueObjects: unique.size,
    uniqueBytes: [...unique.values()].reduce((sum, size) => sum + size, 0),
    aggregateSha256: sha256(Buffer.from(checksumLines.sort().join('\n'))),
    statusCounts,
  }
}

export async function runBackfill(
  config,
  fetchImpl = fetch,
  now = new Date(),
  recordReconciliation = async () => {},
) {
  const report = {
    version: 1,
    generatedAt: now.toISOString(),
    projectRef: config.projectRef,
    mode: config.execute ? 'execute' : 'dry-run',
    maxBytes: config.maxBytes,
    tables: {
      file_tracker_assets: { scannedRecords: 0 },
      website_requests: { scannedRecords: 0 },
    },
    entries: [],
  }
  const objectPromises = new Map()
  const ensureCached = async (bucket, objectPath, parsed) => {
    const key = `${bucket}/${objectPath}`
    if (!objectPromises.has(key)) {
      const reconciliationEntry = {
        bucket,
        objectPath,
        sha256: parsed.sha256,
        sizeBytes: parsed.size,
      }
      const promise = (async () => {
        await recordReconciliation({
          ...reconciliationEntry,
          event: 'planned',
        })
        const objectAction = await ensureObject(config, fetchImpl, bucket, objectPath, parsed)
        await recordReconciliation({
          ...reconciliationEntry,
          event: 'verified',
          objectAction,
        })
        return objectAction
      })()
      objectPromises.set(key, promise)
      promise.catch(() => objectPromises.delete(key))
    }
    return objectPromises.get(key)
  }

  await processFileTracker(config, fetchImpl, report, ensureCached)
  await processWebsiteRequests(config, fetchImpl, report, ensureCached)
  report.tables.file_tracker_assets.summary = summarizeEntries(
    report.entries.filter(entry => entry.source === 'file_tracker_assets'),
  )
  report.tables.website_requests.summary = summarizeEntries(
    report.entries.filter(entry => entry.source === 'website_requests'),
  )
  report.summary = summarizeEntries(report.entries)
  return report
}

export async function createReconciliationRecorder(reportDir, config, now = new Date()) {
  if (!config.execute) {
    return { path: null, record: async () => {} }
  }

  const stamp = now.toISOString().replace(/[-:.]/g, '')
  const manifestPath = path.resolve(
    reportDir,
    `restricted-reconciliation-${stamp}.jsonl`,
  )
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      version: 1,
      projectRef: config.projectRef,
      generatedAt: now.toISOString(),
      classification: 'restricted-reconciliation',
    })}\n`,
    { mode: 0o600, flag: 'wx' },
  )

  return {
    path: manifestPath,
    record: async entry => {
      await appendFile(manifestPath, `${JSON.stringify(entry)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      })
    },
  }
}

export function renderMarkdown(report) {
  const rows = Object.entries(report.tables).map(([table, detail]) => {
    const counts = Object.entries(detail.summary.statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ') || 'none'
    return `| ${table} | ${detail.scannedRecords} | ${detail.summary.items} | ${detail.summary.logicalBytes} | ${detail.summary.uniqueObjects} | ${counts} |`
  })
  const entries = report.entries.map(entry =>
    `| ${entry.source} | ${entry.status} | ${entry.objectAction ?? ''} | ${entry.reason ?? ''} |`,
  )

  return [
    '# Legacy private Storage backfill',
    '',
    `- Mode: \`${report.mode}\``,
    `- Project ref: \`${report.projectRef}\``,
    `- Generated: \`${report.generatedAt}\``,
    `- Items: ${report.summary.items}`,
    `- Logical bytes: ${report.summary.logicalBytes}`,
    `- Unique objects / bytes: ${report.summary.uniqueObjects} / ${report.summary.uniqueBytes}`,
    `- Aggregate SHA-256: \`${report.summary.aggregateSha256}\``,
    '',
    '| Source | Records scanned | Items | Logical bytes | Unique objects | Status counts |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...rows,
    '',
    '| Source | Status | Object action | Reason |',
    '| --- | --- | --- | --- |',
    ...entries,
    '',
  ].join('\n')
}

export function sanitizeReport(report) {
  return {
    ...report,
    entries: report.entries.map(entry => ({
      source: entry.source,
      status: entry.status,
      objectAction: entry.objectAction,
      ...(entry.reason ? { reason: entry.reason } : {}),
    })),
  }
}

export async function writeReports(report, reportDir) {
  const stamp = report.generatedAt.replace(/[-:.]/g, '')
  const prefix = `${report.mode}-${stamp}`
  const jsonPath = path.resolve(reportDir, `${prefix}.json`)
  const markdownPath = path.resolve(reportDir, `${prefix}.md`)
  await mkdir(path.dirname(jsonPath), { recursive: true })

  const suffix = `${process.pid}-${Date.now()}.tmp`
  const jsonTemp = `${jsonPath}.${suffix}`
  const markdownTemp = `${markdownPath}.${suffix}`
  const sanitizedReport = sanitizeReport(report)
  await writeFile(jsonTemp, `${JSON.stringify(sanitizedReport, null, 2)}\n`, { mode: 0o600 })
  await writeFile(markdownTemp, renderMarkdown(report), { mode: 0o600 })
  await rename(jsonTemp, jsonPath)
  await rename(markdownTemp, markdownPath)
  return { jsonPath, markdownPath }
}

function usage() {
  return `Usage:
  node tools/backfill-legacy-private-storage.mjs [options]

Dry-run is the default. The tool reads credentials only from the current process.
It decodes sensitive inline files in memory; run it only in an approved secure environment.
Execute mode writes a restricted 0600 JSONL manifest before each possible object upload.

Options:
  --execute                       Enable Storage uploads and database metadata writes
  --confirm-project-ref <ref>     Exact project ref; required with --execute
  --page-size <1-${MAX_PAGE_SIZE}>             Database page size (default: ${DEFAULT_PAGE_SIZE})
  --report-dir <path>             JSON/Markdown output directory
  --help                          Show this help
`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    process.stdout.write(usage())
    return
  }
  const config = loadConfig(process.env, args)
  const now = new Date()
  const reconciliation = await createReconciliationRecorder(args.reportDir, config, now)
  if (reconciliation.path) {
    process.stdout.write(`Restricted reconciliation manifest: ${reconciliation.path}\n`)
  }
  const report = await runBackfill(config, fetch, now, reconciliation.record)
  const output = await writeReports(report, args.reportDir)
  process.stdout.write(
    `${report.mode} complete: ${report.summary.items} items, ${report.summary.logicalBytes} bytes\n`
    + `JSON: ${output.jsonPath}\nMarkdown: ${output.markdownPath}\n`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const message = error instanceof BackfillError ? error.message : 'Backfill failed unexpectedly.'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
