export const LEGACY_TEMPLATES_KEY = 'exodia-playbook-templates'
export const LEGACY_ACTIVE_MEETINGS_KEY = 'exodia-playbook-active'
export const LEGACY_SCRIPTS_KEY = 'exodia-playbook-scripts'

export type LegacyMeetingPlaybookKey =
  | typeof LEGACY_TEMPLATES_KEY
  | typeof LEGACY_ACTIVE_MEETINGS_KEY
  | typeof LEGACY_SCRIPTS_KEY

export interface FlowStep {
  id: string
  text: string
  time: string
  description: string
}

export interface MeetingTemplate {
  id: string
  name: string
  description: string
  goal: string
  kpis: string[]
  proTips: string[]
  flowSteps: FlowStep[]
}

export interface MeetingLink {
  id: string
  label: string
  url: string
}

export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
}

export interface ActiveMeeting {
  id: string
  name: string
  links: MeetingLink[]
  checklist: ChecklistItem[]
}

export interface ScriptCard {
  id: string
  name: string
  category: string
  text: string
}

export interface MeetingTemplateRow {
  id: string
  name: string
  description: string
  goal: string
  kpis: string[]
  pro_tips: string[]
  flow_steps: FlowStep[]
}

export interface ActiveMeetingRow {
  id: string
  name: string
  links: MeetingLink[]
  checklist: ChecklistItem[]
}

export interface MeetingScriptRow {
  id: string
  name: string
  category: string
  text: string
}

export interface MeetingPlaybookRecords {
  templates: MeetingTemplate[]
  activeMeetings: ActiveMeeting[]
  scripts: ScriptCard[]
}

export interface StorageReader {
  getItem(key: string): string | null
}

export interface LegacyMeetingPlaybookData {
  records: MeetingPlaybookRecords
  counts: { templates: number; activeMeetings: number; scripts: number }
  issues: Record<LegacyMeetingPlaybookKey, string[]>
}

export interface MeetingPlaybookImportPlan {
  missing: MeetingPlaybookRecords
  collisions: { templates: number; activeMeetings: number; scripts: number }
}

export type MeetingPlaybookTable = 'meeting_templates' | 'active_meetings' | 'meeting_scripts'

export interface MeetingPlaybookClient {
  from(table: MeetingPlaybookTable): unknown
}

interface QueryResult {
  data: unknown
  error: unknown
}

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder
  order(column: string, options?: { ascending?: boolean }): QueryBuilder
  insert(values: unknown): QueryBuilder
  update(values: unknown): QueryBuilder
  delete(): QueryBuilder
  eq(column: string, value: string): QueryBuilder
  single(): Promise<QueryResult>
  maybeSingle(): Promise<QueryResult>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const isTextArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText)

const isFlowStep = (value: unknown): value is FlowStep =>
  isObject(value) && isText(value.id) && isText(value.text) && isText(value.time) && isText(value.description)

const isMeetingLink = (value: unknown): value is MeetingLink =>
  isObject(value) && isText(value.id) && isText(value.label) && isText(value.url)

const isChecklistItem = (value: unknown): value is ChecklistItem =>
  isObject(value) && isText(value.id) && isText(value.text) && typeof value.checked === 'boolean'

const isMeetingTemplate = (value: unknown): value is MeetingTemplate =>
  isObject(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isText(value.description) &&
  isText(value.goal) &&
  isTextArray(value.kpis) &&
  isTextArray(value.proTips) &&
  Array.isArray(value.flowSteps) && value.flowSteps.every(isFlowStep)

const isActiveMeeting = (value: unknown): value is ActiveMeeting =>
  isObject(value) &&
  isText(value.id) &&
  isText(value.name) &&
  Array.isArray(value.links) && value.links.every(isMeetingLink) &&
  Array.isArray(value.checklist) && value.checklist.every(isChecklistItem)

const isScriptCard = (value: unknown): value is ScriptCard =>
  isObject(value) && isText(value.id) && isText(value.name) && isText(value.category) && isText(value.text)

function readLegacyArray<T extends { id: string }>(
  storage: StorageReader,
  key: LegacyMeetingPlaybookKey,
  validator: (value: unknown) => value is T,
): { records: T[]; issues: string[] } {
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return { records: [], issues: ['storage unavailable'] }
  }
  if (raw === null) return { records: [], issues: [] }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { records: [], issues: ['invalid JSON'] }
  }
  if (!Array.isArray(value)) return { records: [], issues: ['expected array'] }

  const knownIds = new Set<string>()
  const records = value.filter((record): record is T => {
    if (!validator(record) || knownIds.has(record.id)) return false
    knownIds.add(record.id)
    return true
  })
  const invalidCount = value.length - records.length
  return {
    records,
    issues: invalidCount === 0 ? [] : [`${invalidCount} invalid record${invalidCount === 1 ? '' : 's'}`],
  }
}

export function readLegacyMeetingPlaybook(storage: StorageReader): LegacyMeetingPlaybookData {
  const templates = readLegacyArray(storage, LEGACY_TEMPLATES_KEY, isMeetingTemplate)
  const activeMeetings = readLegacyArray(storage, LEGACY_ACTIVE_MEETINGS_KEY, isActiveMeeting)
  const scripts = readLegacyArray(storage, LEGACY_SCRIPTS_KEY, isScriptCard)
  const records = {
    templates: templates.records,
    activeMeetings: activeMeetings.records,
    scripts: scripts.records,
  }
  return {
    records,
    counts: {
      templates: records.templates.length,
      activeMeetings: records.activeMeetings.length,
      scripts: records.scripts.length,
    },
    issues: {
      [LEGACY_TEMPLATES_KEY]: templates.issues,
      [LEGACY_ACTIVE_MEETINGS_KEY]: activeMeetings.issues,
      [LEGACY_SCRIPTS_KEY]: scripts.issues,
    },
  }
}

const backupTemplate = (template: MeetingTemplate): MeetingTemplate => ({
  id: template.id,
  name: template.name,
  description: template.description,
  goal: template.goal,
  kpis: [...template.kpis],
  proTips: [...template.proTips],
  flowSteps: template.flowSteps.map(step => ({
    id: step.id,
    text: step.text,
    time: step.time,
    description: step.description,
  })),
})

const backupActiveMeeting = (meeting: ActiveMeeting): ActiveMeeting => ({
  id: meeting.id,
  name: meeting.name,
  links: meeting.links.map(link => ({ id: link.id, label: link.label, url: link.url })),
  checklist: meeting.checklist.map(item => ({ id: item.id, text: item.text, checked: item.checked })),
})

const backupScript = (script: ScriptCard): ScriptCard => ({
  id: script.id,
  name: script.name,
  category: script.category,
  text: script.text,
})

export function serializeMeetingPlaybookBackup(records: MeetingPlaybookRecords, exportedAt: string): string {
  return JSON.stringify({
    version: 1,
    exportedAt,
    templates: records.templates.map(backupTemplate),
    activeMeetings: records.activeMeetings.map(backupActiveMeeting),
    scripts: records.scripts.map(backupScript),
  })
}

export const meetingTemplateToRow = (template: MeetingTemplate): MeetingTemplateRow => ({
  id: template.id,
  name: template.name,
  description: template.description,
  goal: template.goal,
  kpis: template.kpis,
  pro_tips: template.proTips,
  flow_steps: template.flowSteps,
})

export const meetingTemplateFromRow = (row: MeetingTemplateRow): MeetingTemplate => ({
  id: row.id,
  name: row.name,
  description: row.description,
  goal: row.goal,
  kpis: row.kpis,
  proTips: row.pro_tips,
  flowSteps: row.flow_steps,
})

export const activeMeetingToRow = (meeting: ActiveMeeting): ActiveMeetingRow => ({
  id: meeting.id,
  name: meeting.name,
  links: meeting.links,
  checklist: meeting.checklist,
})

export const activeMeetingFromRow = (row: ActiveMeetingRow): ActiveMeeting => ({ ...row })

export const meetingScriptToRow = (script: ScriptCard): MeetingScriptRow => ({ ...script })

export const meetingScriptFromRow = (row: MeetingScriptRow): ScriptCard => ({ ...row })

function planGroup<T extends { id: string }>(legacy: T[], canonical: T[]): { missing: T[]; collisions: number } {
  const canonicalIds = new Set(canonical.map(record => record.id))
  const missing: T[] = []
  let collisions = 0
  for (const record of legacy) {
    if (canonicalIds.has(record.id)) collisions += 1
    else missing.push(record)
  }
  return { missing, collisions }
}

export function planLegacyMeetingPlaybookImport(
  legacy: MeetingPlaybookRecords,
  canonical: MeetingPlaybookRecords,
): MeetingPlaybookImportPlan {
  const templates = planGroup(legacy.templates, canonical.templates)
  const activeMeetings = planGroup(legacy.activeMeetings, canonical.activeMeetings)
  const scripts = planGroup(legacy.scripts, canonical.scripts)
  return {
    missing: {
      templates: templates.missing,
      activeMeetings: activeMeetings.missing,
      scripts: scripts.missing,
    },
    collisions: {
      templates: templates.collisions,
      activeMeetings: activeMeetings.collisions,
      scripts: scripts.collisions,
    },
  }
}

const query = (client: MeetingPlaybookClient, table: MeetingPlaybookTable): QueryBuilder =>
  client.from(table) as QueryBuilder

const hasError = (result: QueryResult): boolean => result.error !== null && result.error !== undefined

const asRows = <T>(data: unknown): T[] | null => Array.isArray(data) ? data as T[] : null

const asRow = <T>(data: unknown): T | null => isObject(data) ? data as T : null

function confirmedRow<T extends { id: string }>(result: QueryResult, expectedId: string, action: string): T {
  const row = asRow<T>(result.data)
  if (hasError(result) || !row || row.id !== expectedId) {
    throw new Error(`Canonical ${action} did not return the confirmed id.`)
  }
  return row
}

export async function fetchCanonicalMeetingPlaybook(client: MeetingPlaybookClient): Promise<MeetingPlaybookRecords> {
  const [templatesResult, activeMeetingsResult, scriptsResult] = await Promise.all([
    query(client, 'meeting_templates').select('*'),
    query(client, 'active_meetings').select('*'),
    query(client, 'meeting_scripts').select('*'),
  ]) as QueryResult[]
  const templates = asRows<MeetingTemplateRow>(templatesResult.data)
  const activeMeetings = asRows<ActiveMeetingRow>(activeMeetingsResult.data)
  const scripts = asRows<MeetingScriptRow>(scriptsResult.data)
  if (
    hasError(templatesResult) || hasError(activeMeetingsResult) || hasError(scriptsResult) ||
    !templates || !activeMeetings || !scripts
  ) {
    throw new Error('Canonical Meeting Playbook could not load.')
  }
  return {
    templates: templates.map(meetingTemplateFromRow),
    activeMeetings: activeMeetings.map(activeMeetingFromRow),
    scripts: scripts.map(meetingScriptFromRow),
  }
}

async function createRecord<T extends { id: string }, R extends { id: string }>(
  client: MeetingPlaybookClient,
  table: MeetingPlaybookTable,
  record: T,
  toRow: (record: T) => R,
  fromRow: (row: R) => T,
): Promise<T> {
  const result = await query(client, table).insert(toRow(record)).select('*').single()
  return fromRow(confirmedRow<R>(result, record.id, 'create'))
}

async function updateRecord<T extends { id: string }, R extends { id: string }>(
  client: MeetingPlaybookClient,
  table: MeetingPlaybookTable,
  record: T,
  toRow: (record: T) => R,
  fromRow: (row: R) => T,
): Promise<T> {
  const result = await query(client, table).update(toRow(record)).eq('id', record.id).select('*').single()
  return fromRow(confirmedRow<R>(result, record.id, 'update'))
}

async function deleteRecord(client: MeetingPlaybookClient, table: MeetingPlaybookTable, id: string): Promise<string> {
  const result = await query(client, table).delete().eq('id', id).select('id').maybeSingle()
  return confirmedRow<{ id: string }>(result, id, 'delete').id
}

export const createMeetingTemplate = (client: MeetingPlaybookClient, record: MeetingTemplate) =>
  createRecord(client, 'meeting_templates', record, meetingTemplateToRow, meetingTemplateFromRow)
export const updateMeetingTemplate = (client: MeetingPlaybookClient, record: MeetingTemplate) =>
  updateRecord(client, 'meeting_templates', record, meetingTemplateToRow, meetingTemplateFromRow)
export const deleteMeetingTemplate = (client: MeetingPlaybookClient, id: string) =>
  deleteRecord(client, 'meeting_templates', id)

export const createActiveMeeting = (client: MeetingPlaybookClient, record: ActiveMeeting) =>
  createRecord(client, 'active_meetings', record, activeMeetingToRow, activeMeetingFromRow)
export const updateActiveMeeting = (client: MeetingPlaybookClient, record: ActiveMeeting) =>
  updateRecord(client, 'active_meetings', record, activeMeetingToRow, activeMeetingFromRow)
export const deleteActiveMeeting = (client: MeetingPlaybookClient, id: string) =>
  deleteRecord(client, 'active_meetings', id)

export const createMeetingScript = (client: MeetingPlaybookClient, record: ScriptCard) =>
  createRecord(client, 'meeting_scripts', record, meetingScriptToRow, meetingScriptFromRow)
export const updateMeetingScript = (client: MeetingPlaybookClient, record: ScriptCard) =>
  updateRecord(client, 'meeting_scripts', record, meetingScriptToRow, meetingScriptFromRow)
export const deleteMeetingScript = (client: MeetingPlaybookClient, id: string) =>
  deleteRecord(client, 'meeting_scripts', id)

export interface LegacyImportTableOutcome {
  status: 'saved' | 'failed' | 'skipped'
  saved: number
  failed: number
  skipped: number
}

export interface LegacyMeetingPlaybookImportResult {
  tables: {
    templates: LegacyImportTableOutcome
    activeMeetings: LegacyImportTableOutcome
    scripts: LegacyImportTableOutcome
  }
  complete: boolean
}

async function importMissingGroup<T extends { id: string }, R extends { id: string }>(
  client: MeetingPlaybookClient,
  table: MeetingPlaybookTable,
  records: T[],
  skipped: number,
  toRow: (record: T) => R,
): Promise<LegacyImportTableOutcome> {
  if (records.length === 0) return { status: 'skipped', saved: 0, failed: 0, skipped }
  let result: QueryResult
  try {
    result = await query(client, table).insert(records.map(toRow)).select('id')
  } catch {
    return { status: 'failed', saved: 0, failed: records.length, skipped }
  }
  const returned = asRows<unknown>(result.data)
  const returnedIds = returned !== null && returned.every(
    (row): row is { id: string } => isObject(row) && isText(row.id),
  )
    ? returned.map(row => row.id)
    : null
  const expectedIds = records.map(record => record.id)
  const expectedIdSet = new Set(expectedIds)
  const returnedIdSet = returnedIds === null ? null : new Set(returnedIds)
  const confirmed =
    !hasError(result) &&
    returned !== null &&
    returned.length === records.length &&
    returnedIds !== null &&
    expectedIdSet.size === records.length &&
    returnedIdSet !== null &&
    returnedIdSet.size === records.length &&
    expectedIds.every(id => returnedIdSet.has(id))
  if (!confirmed) return { status: 'failed', saved: 0, failed: records.length, skipped }
  return { status: 'saved', saved: records.length, failed: 0, skipped }
}

export async function importMissingLegacyMeetingPlaybook(
  client: MeetingPlaybookClient,
  legacy: MeetingPlaybookRecords,
  canonical: MeetingPlaybookRecords,
): Promise<LegacyMeetingPlaybookImportResult> {
  const plan = planLegacyMeetingPlaybookImport(legacy, canonical)
  const [templates, activeMeetings, scripts] = await Promise.all([
    importMissingGroup(client, 'meeting_templates', plan.missing.templates, plan.collisions.templates, meetingTemplateToRow),
    importMissingGroup(client, 'active_meetings', plan.missing.activeMeetings, plan.collisions.activeMeetings, activeMeetingToRow),
    importMissingGroup(client, 'meeting_scripts', plan.missing.scripts, plan.collisions.scripts, meetingScriptToRow),
  ])
  return {
    tables: { templates, activeMeetings, scripts },
    complete: [templates, activeMeetings, scripts].every(outcome => outcome.status !== 'failed'),
  }
}
