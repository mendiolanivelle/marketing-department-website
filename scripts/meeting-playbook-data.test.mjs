import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

let playbookData
let moduleLoadError
try {
  const bundle = await build({
    bundle: true,
    entryPoints: [
      fileURLToPath(new URL('../src/lib/meetingPlaybookData.ts', import.meta.url)),
    ],
    format: 'esm',
    logLevel: 'silent',
    platform: 'node',
    target: 'node22',
    write: false,
  })
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
  playbookData = await import(moduleUrl)
} catch (error) {
  moduleLoadError = error
}

function requireModule() {
  assert.ok(
    playbookData,
    `Meeting Playbook canonical recovery module must load: ${moduleLoadError?.message ?? 'missing module'}`,
  )
  return playbookData
}

const template = {
  id: 'template-discovery',
  name: 'Discovery Call',
  description: 'Qualify the opportunity.',
  goal: 'Understand needs.',
  kpis: ['Three pain points'],
  proTips: ['Listen first'],
  flowSteps: [{ id: 'discover', text: 'Ask questions', time: '15 min', description: 'Explore goals.' }],
}

const activeMeeting = {
  id: 'active-weekly',
  name: 'Weekly review',
  links: [{ id: 'brief', label: 'Brief', url: 'https://example.test/brief' }],
  checklist: [{ id: 'agenda', text: 'Set agenda', checked: false }],
}

const script = {
  id: 'script-opening',
  name: 'Opening',
  category: 'Discovery',
  text: 'Thank you for joining.',
}

const records = { templates: [template], activeMeetings: [activeMeeting], scripts: [script] }

function createStorage(values) {
  const calls = []
  return {
    calls,
    getItem(key) {
      calls.push(key)
      return values[key] ?? null
    },
  }
}

class QueryBuilder {
  constructor(database, table) {
    this.database = database
    this.table = table
    this.action = 'select'
    this.payload = undefined
    this.filter = undefined
    this.returnOne = false
  }

  select() { return this }
  order() { return this }
  insert(payload) { this.action = 'insert'; this.payload = payload; return this }
  update(payload) { this.action = 'update'; this.payload = payload; return this }
  delete() { this.action = 'delete'; return this }
  eq(column, value) { this.filter = { column, value }; return this }
  single() { this.returnOne = true; return this.execute() }
  maybeSingle() { this.returnOne = true; return this.execute() }
  then(resolve, reject) { return this.execute().then(resolve, reject) }

  async execute() {
    const response = this.database.responses[this.table]?.[this.action]
    if (response) return response(this)
    const rows = this.database.tables[this.table]
    if (this.action === 'select') return { data: rows.map(row => ({ ...row })), error: null }
    if (this.action === 'insert') {
      const inserted = Array.isArray(this.payload) ? this.payload : [this.payload]
      rows.push(...inserted.map(row => ({ ...row })))
      return { data: this.returnOne ? { ...inserted[0] } : inserted.map(row => ({ ...row })), error: null }
    }
    const index = rows.findIndex(row => row[this.filter?.column] === this.filter?.value)
    if (this.action === 'update') {
      if (index < 0) return { data: null, error: null }
      rows[index] = { ...rows[index], ...this.payload }
      return { data: this.returnOne ? { ...rows[index] } : [{ ...rows[index] }], error: null }
    }
    if (index < 0) return { data: null, error: null }
    const [removed] = rows.splice(index, 1)
    return { data: this.returnOne ? { id: removed.id } : [{ id: removed.id }], error: null }
  }
}

function createClient(initial = {}) {
  const database = {
    tables: {
      meeting_templates: (initial.meeting_templates ?? []).map(row => ({ ...row })),
      active_meetings: (initial.active_meetings ?? []).map(row => ({ ...row })),
      meeting_scripts: (initial.meeting_scripts ?? []).map(row => ({ ...row })),
    },
    responses: {},
  }
  return {
    database,
    from(table) { return new QueryBuilder(database, table) },
  }
}

test('legacy reader preserves valid rows, reports malformed payloads, and never mutates browser storage', () => {
  const {
    LEGACY_ACTIVE_MEETINGS_KEY,
    LEGACY_SCRIPTS_KEY,
    LEGACY_TEMPLATES_KEY,
    readLegacyMeetingPlaybook,
  } = requireModule()
  const storage = createStorage({
    [LEGACY_TEMPLATES_KEY]: JSON.stringify([template, { ...template }, { id: 'bad', name: 'Missing fields' }]),
    [LEGACY_ACTIVE_MEETINGS_KEY]: '{not json',
    [LEGACY_SCRIPTS_KEY]: JSON.stringify([script]),
  })

  const result = readLegacyMeetingPlaybook(storage)

  assert.deepEqual(result.records, { templates: [template], activeMeetings: [], scripts: [script] })
  assert.deepEqual(result.counts, { templates: 1, activeMeetings: 0, scripts: 1 })
  assert.deepEqual(result.issues[LEGACY_TEMPLATES_KEY], ['2 invalid records'])
  assert.deepEqual(result.issues[LEGACY_ACTIVE_MEETINGS_KEY], ['invalid JSON'])
  assert.deepEqual(result.issues[LEGACY_SCRIPTS_KEY], [])
  assert.deepEqual(storage.calls, [LEGACY_TEMPLATES_KEY, LEGACY_ACTIVE_MEETINGS_KEY, LEGACY_SCRIPTS_KEY])
})

test('backup serializes only the supplied timestamp and the three stable payload groups', () => {
  const { serializeMeetingPlaybookBackup } = requireModule()

  const backup = serializeMeetingPlaybookBackup({
    ...records,
    templates: [{ ...template, session: 'must-not-export' }],
  }, '2026-08-26T08:00:00.000Z')

  assert.equal(backup, JSON.stringify({
    version: 1,
    exportedAt: '2026-08-26T08:00:00.000Z',
    templates: [template],
    activeMeetings: [activeMeeting],
    scripts: [script],
  }))
  assert.doesNotMatch(backup, /auth|session|token|must-not-export/i)
})

test('row mappers preserve every canonical table field while translating camel case', () => {
  const {
    activeMeetingFromRow,
    activeMeetingToRow,
    meetingScriptFromRow,
    meetingScriptToRow,
    meetingTemplateFromRow,
    meetingTemplateToRow,
  } = requireModule()

  assert.deepEqual(meetingTemplateToRow(template), {
    id: 'template-discovery', name: 'Discovery Call', description: 'Qualify the opportunity.', goal: 'Understand needs.',
    kpis: ['Three pain points'], pro_tips: ['Listen first'], flow_steps: [{ id: 'discover', text: 'Ask questions', time: '15 min', description: 'Explore goals.' }],
  })
  assert.deepEqual(meetingTemplateFromRow(meetingTemplateToRow(template)), template)
  assert.deepEqual(activeMeetingToRow(activeMeeting), {
    id: 'active-weekly', name: 'Weekly review', links: [{ id: 'brief', label: 'Brief', url: 'https://example.test/brief' }], checklist: [{ id: 'agenda', text: 'Set agenda', checked: false }],
  })
  assert.deepEqual(activeMeetingFromRow(activeMeetingToRow(activeMeeting)), activeMeeting)
  assert.deepEqual(meetingScriptToRow(script), script)
  assert.deepEqual(meetingScriptFromRow(meetingScriptToRow(script)), script)
})

test('import planner returns only missing stable IDs and counts collisions without overwrite authority', () => {
  const { planLegacyMeetingPlaybookImport } = requireModule()

  const plan = planLegacyMeetingPlaybookImport(
    {
      templates: [template, { ...template, id: 'template-new' }],
      activeMeetings: [activeMeeting],
      scripts: [script, { ...script, id: 'script-new' }],
    },
    { templates: [template], activeMeetings: [], scripts: [script] },
  )

  assert.deepEqual(plan.missing, {
    templates: [{ ...template, id: 'template-new' }], activeMeetings: [activeMeeting], scripts: [{ ...script, id: 'script-new' }],
  })
  assert.deepEqual(plan.collisions, { templates: 1, activeMeetings: 0, scripts: 1 })
})

test('canonical fetch succeeds only when all three table queries succeed', async () => {
  const { fetchCanonicalMeetingPlaybook, meetingTemplateToRow, activeMeetingToRow } = requireModule()
  const client = createClient({
    meeting_templates: [meetingTemplateToRow(template)],
    active_meetings: [activeMeetingToRow(activeMeeting)],
    meeting_scripts: [script],
  })

  assert.deepEqual(await fetchCanonicalMeetingPlaybook(client), records)
  client.database.responses.meeting_scripts = { select: () => ({ data: null, error: { message: 'denied' } }) }
  await assert.rejects(fetchCanonicalMeetingPlaybook(client), /canonical meeting playbook could not load/i)
})

test('create, update, and delete return success only after a matching canonical ID is confirmed', async () => {
  const {
    createActiveMeeting,
    createMeetingScript,
    createMeetingTemplate,
    deleteActiveMeeting,
    deleteMeetingScript,
    deleteMeetingTemplate,
    updateActiveMeeting,
    updateMeetingScript,
    updateMeetingTemplate,
  } = requireModule()
  const client = createClient()

  assert.deepEqual(await createMeetingTemplate(client, template), template)
  assert.deepEqual(await updateMeetingTemplate(client, { ...template, goal: 'Confirm next steps.' }), { ...template, goal: 'Confirm next steps.' })
  assert.equal(await deleteMeetingTemplate(client, template.id), template.id)
  assert.deepEqual(await createActiveMeeting(client, activeMeeting), activeMeeting)
  assert.deepEqual(await updateActiveMeeting(client, { ...activeMeeting, name: 'Updated review' }), { ...activeMeeting, name: 'Updated review' })
  assert.equal(await deleteActiveMeeting(client, activeMeeting.id), activeMeeting.id)
  assert.deepEqual(await createMeetingScript(client, script), script)
  assert.deepEqual(await updateMeetingScript(client, { ...script, category: 'Sales' }), { ...script, category: 'Sales' })
  assert.equal(await deleteMeetingScript(client, script.id), script.id)

  client.database.responses.meeting_templates = { insert: () => ({ data: { ...template, id: 'different-id' }, error: null }) }
  await assert.rejects(createMeetingTemplate(client, template), /confirmed id/i)
  client.database.responses.meeting_templates = { delete: () => ({ data: null, error: null }) }
  await assert.rejects(deleteMeetingTemplate(client, template.id), /confirmed id/i)
})

test('legacy import saves only planned missing rows and leaves a partial failure retryable', async () => {
  const {
    fetchCanonicalMeetingPlaybook,
    importMissingLegacyMeetingPlaybook,
    meetingTemplateToRow,
  } = requireModule()
  const client = createClient({ meeting_templates: [meetingTemplateToRow(template)] })
  client.database.responses.meeting_scripts = { insert: () => ({ data: null, error: { message: 'denied' } }) }
  const legacy = {
    templates: [template, { ...template, id: 'template-new' }],
    activeMeetings: [activeMeeting],
    scripts: [script],
  }

  const result = await importMissingLegacyMeetingPlaybook(client, legacy, { templates: [template], activeMeetings: [], scripts: [] })

  assert.deepEqual(result.tables, {
    templates: { status: 'saved', saved: 1, failed: 0, skipped: 1 },
    activeMeetings: { status: 'saved', saved: 1, failed: 0, skipped: 0 },
    scripts: { status: 'failed', saved: 0, failed: 1, skipped: 0 },
  })
  assert.equal(result.complete, false)
  assert.deepEqual(client.database.tables.meeting_templates.map(row => row.id), ['template-discovery', 'template-new'])
  assert.deepEqual(client.database.tables.active_meetings.map(row => row.id), ['active-weekly'])
  assert.deepEqual(client.database.tables.meeting_scripts, [])

  delete client.database.responses.meeting_scripts
  const retry = await importMissingLegacyMeetingPlaybook(client, legacy, await fetchCanonicalMeetingPlaybook(client))

  assert.deepEqual(retry.tables, {
    templates: { status: 'skipped', saved: 0, failed: 0, skipped: 2 },
    activeMeetings: { status: 'skipped', saved: 0, failed: 0, skipped: 1 },
    scripts: { status: 'saved', saved: 1, failed: 0, skipped: 0 },
  })
  assert.equal(retry.complete, true)
  assert.deepEqual(client.database.tables.meeting_templates.map(row => row.id), ['template-discovery', 'template-new'])
  assert.deepEqual(client.database.tables.active_meetings.map(row => row.id), ['active-weekly'])
  assert.deepEqual(client.database.tables.meeting_scripts.map(row => row.id), ['script-opening'])
})

test('bulk import rejects duplicate and malformed confirmation rows instead of reporting saved', async () => {
  const { importMissingLegacyMeetingPlaybook } = requireModule()
  const legacy = { templates: [template], activeMeetings: [], scripts: [] }

  const duplicateClient = createClient()
  duplicateClient.database.responses.meeting_templates = {
    insert: () => ({ data: [{ id: template.id }, { id: template.id }], error: null }),
  }
  const duplicateResult = await importMissingLegacyMeetingPlaybook(duplicateClient, legacy, { templates: [], activeMeetings: [], scripts: [] })
  assert.deepEqual(duplicateResult.tables.templates, { status: 'failed', saved: 0, failed: 1, skipped: 0 })
  assert.equal(duplicateResult.complete, false)

  const malformedClient = createClient()
  malformedClient.database.responses.meeting_templates = {
    insert: () => ({ data: [null], error: null }),
  }
  const malformedResult = await importMissingLegacyMeetingPlaybook(malformedClient, legacy, { templates: [], activeMeetings: [], scripts: [] })
  assert.deepEqual(malformedResult.tables.templates, { status: 'failed', saved: 0, failed: 1, skipped: 0 })
  assert.equal(malformedResult.complete, false)
})
