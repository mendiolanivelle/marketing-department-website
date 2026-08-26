/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logActivity } from '../lib/activityLogger'
import {
  LEGACY_ACTIVE_MEETINGS_KEY,
  LEGACY_SCRIPTS_KEY,
  LEGACY_TEMPLATES_KEY,
  createActiveMeeting as createCanonicalActiveMeeting,
  createMeetingScript,
  createMeetingTemplate,
  deleteActiveMeeting as deleteCanonicalActiveMeeting,
  deleteMeetingScript,
  deleteMeetingTemplate,
  fetchCanonicalMeetingPlaybook,
  importMissingLegacyMeetingPlaybook,
  planLegacyMeetingPlaybookImport,
  readLegacyMeetingPlaybook,
  serializeMeetingPlaybookBackup,
  updateActiveMeeting,
  updateMeetingScript,
  updateMeetingTemplate,
  type ActiveMeeting,
  type LegacyMeetingPlaybookData,
  type MeetingPlaybookClient,
  type MeetingPlaybookRecords,
  type MeetingTemplate,
  type ScriptCard,
} from '../lib/meetingPlaybookData'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type TabKey = 'master' | 'active' | 'vault'

const defaultTemplates: MeetingTemplate[] = [
  {
    id: 'discovery',
    name: 'Discovery Call',
    description: 'First meeting with a potential client to understand their needs and qualify the lead.',
    goal: 'Understand client pain points, qualify the lead, and set clear next steps.',
    kpis: ['Client agrees to a proposal meeting', 'At least 3 pain points identified', 'Budget range confirmed'],
    proTips: ['Research the client\'s company and industry 15 minutes before the call', 'Let the client talk 70% of the time', 'Always ask "What does success look like for you?"'],
    flowSteps: [
      { id: 'f1', text: 'Open & Welcome', time: '2 min', description: 'Brief intro, set the agenda, confirm meeting length' },
      { id: 'f2', text: 'Client Introductions', time: '3 min', description: 'Each attendee shares their role and what they hope to get out of the meeting' },
      { id: 'f3', text: 'Context Recap', time: '2 min', description: 'Recap how we got here, previous conversations, submitted forms' },
      { id: 'f4', text: 'Discovery Questions', time: '15 min', description: 'Pain points, goals, timeline, budget, decision criteria' },
      { id: 'f5', text: 'Buffer / Follow-up Questions', time: '3 min', description: 'Catch missed topics, dig deeper on key answers' },
      { id: 'f6', text: 'Capabilities Overview', time: '10 min', description: '2-3 case studies aligned to their needs' },
      { id: 'f7', text: 'Q&A', time: '3 min', description: 'Open floor for client questions' },
      { id: 'f8', text: 'Next Steps & Timeline', time: '4 min', description: 'Proposal date, follow-up meeting, internal review' },
      { id: 'f9', text: 'Close', time: '3 min', description: 'Summarize key takeaways, confirm next steps, thank attendees' },
    ],
  },
  {
    id: 'proposal',
    name: 'Proposal Presentation',
    description: 'Present the proposed solution, timeline, and pricing to the client.',
    goal: 'Get verbal approval or clear next steps toward closing.',
    kpis: ['Client confirms budget alignment', 'Decision timeline established', 'Objections addressed'],
    proTips: ['Start with a recap of their needs before showing the solution', 'Let the pricing slide breathe — pause after showing it', 'Have a printed proposal PDF ready to share'],
    flowSteps: [
      { id: 'p1', text: 'Open & Agenda', time: '3 min', description: 'Welcome, set expectations for the presentation' },
      { id: 'p2', text: 'Needs Recap', time: '5 min', description: 'Summarize the client\'s stated needs and goals from discovery' },
      { id: 'p3', text: 'Proposal Walkthrough', time: '22 min', description: 'Solution, scope, timeline, deliverables, and pricing' },
      { id: 'p4', text: 'Q&A', time: '10 min', description: 'Address questions, clarify scope, discuss concerns' },
      { id: 'p5', text: 'Pricing Deep Dive', time: '10 min', description: 'Break down pricing structure, payment terms, and ROI' },
      { id: 'p6', text: 'Next Steps', time: '5 min', description: 'Review decision timeline, internal review process, follow-up date' },
      { id: 'p7', text: 'Close', time: '5 min', description: 'Summarize, confirm understanding, thank them' },
    ],
  },
  {
    id: 'kickoff',
    name: 'Project Kickoff',
    description: 'Align on project goals, timeline, team roles, and communication plan.',
    goal: 'Everyone leaves aligned on scope, timeline, and who does what.',
    kpis: ['All team members introduced', 'Communication channels confirmed', 'First deliverable date set'],
    proTips: ['Set the tone — this is a collaboration, not a handoff', 'Get the client to confirm each milestone date verbally', 'Share the meeting notes and action items within 2 hours'],
    flowSteps: [
      { id: 'k1', text: 'Welcome & Introductions', time: '5 min', description: 'Introduce team, their roles, and what they bring' },
      { id: 'k2', text: 'Project Scope & Goals', time: '10 min', description: 'Review agreed-upon scope, objectives, and success criteria' },
      { id: 'k3', text: 'Timeline & Milestones', time: '10 min', description: 'Walk through the project timeline, key milestones, deliverables' },
      { id: 'k4', text: 'Roles & Responsibilities', time: '5 min', description: 'Who does what, escalation paths, points of contact' },
      { id: 'k5', text: 'Communication Plan', time: '5 min', description: 'Meeting cadence, communication channels, reporting format' },
      { id: 'k6', text: 'Tools & Access', time: '10 min', description: 'Grant access to project management tools, shared drives, platforms' },
      { id: 'k7', text: 'Q&A / Discussion', time: '7 min', description: 'Open discussion for questions, concerns, clarifications' },
      { id: 'k8', text: 'Action Items & Next Steps', time: '5 min', description: 'Assign immediate action items, set first deliverable date' },
      { id: 'k9', text: 'Close', time: '3 min', description: 'Summarize, confirm understanding, share meeting notes' },
    ],
  },
]

const defaultScripts: ScriptCard[] = [
  { id: 's1', name: 'Handling "It\'s Too Expensive" Objection', category: 'Sales', text: 'I completely understand budget is a concern. However, our proven formula has helped similar companies achieve [X result] within [Y timeframe]. Let me break down the actual ROI you can expect.' },
  { id: 's2', name: 'Handling "We Need to Think About It"', category: 'Sales', text: 'I appreciate that — it\'s a big decision. To help you discuss internally, what specific concerns do you need to address? I can join your internal call if that helps.' },
  { id: 's3', name: 'Project Kickoff Opening', category: 'Onboarding', text: 'Welcome everyone. Today we\'re aligning on how we\'ll work together over the next [duration]. By the end of this call, you\'ll know exactly who does what, when things are due, and how we communicate.' },
  { id: 's4', name: 'Handling Tech Failure Gracefully', category: 'General', text: 'Looks like we\'re having a tech hiccup. No worries — I\'ll send you the deck via email right now. Bear with me for one minute while I switch to my backup.' },
]

const emptyRecords = (): MeetingPlaybookRecords => ({ templates: [], activeMeetings: [], scripts: [] })

const emptyLegacy = (): LegacyMeetingPlaybookData => ({
  records: emptyRecords(),
  counts: { templates: 0, activeMeetings: 0, scripts: 0 },
  issues: {
    [LEGACY_TEMPLATES_KEY]: [],
    [LEGACY_ACTIVE_MEETINGS_KEY]: [],
    [LEGACY_SCRIPTS_KEY]: [],
  },
})

const readLocalArray = <T,>(key: string, fallback: T[]): T[] => {
  if (typeof window === 'undefined') return fallback
  const saved = window.localStorage.getItem(key)
  if (saved) { try { return JSON.parse(saved) as T[] } catch { /* preserve prior fallback behavior */ } }
  return fallback
}

const defaultRecords: MeetingPlaybookRecords = {
  templates: defaultTemplates,
  activeMeetings: [],
  scripts: defaultScripts,
}

type PersistenceState = 'idle' | 'saving' | 'saved' | 'failed' | 'blocked'

export const areMeetingPlaybookRecordsEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areMeetingPlaybookRecordsEqual(value, right[index]))
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return leftKeys.length === rightKeys.length &&
    leftKeys.every(key => Object.prototype.hasOwnProperty.call(rightRecord, key) && areMeetingPlaybookRecordsEqual(leftRecord[key], rightRecord[key]))
}

export const createMeetingPlaybookId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

interface LatestRecordUpdate<T extends { id: string }> {
  getRecords: () => T[]
  id: string
  update: (current: T) => T
  persist: (next: T) => Promise<T>
}

export function createLatestRecordUpdate<T extends { id: string }>({
  getRecords,
  id,
  update,
  persist,
}: LatestRecordUpdate<T>): () => Promise<T> {
  return async () => {
    const current = getRecords().find(record => record.id === id)
    if (!current) throw new Error('Canonical record is no longer available')
    return persist(update(current))
  }
}

interface CanonicalMutationFlow<TConfirmed, TRecords> {
  execute: () => Promise<TConfirmed>
  refresh: () => Promise<TRecords>
  isSatisfied: (records: TRecords) => boolean
  applyConfirmed: (confirmed: TConfirmed) => void
  applyRefreshed: (records: TRecords) => void
  canExecuteAfterRefresh?: (records: TRecords) => boolean
  reconcileBeforeExecute?: boolean
}

export async function executeCanonicalMutationWithReconciliation<TConfirmed, TRecords>({
  execute,
  refresh,
  isSatisfied,
  applyConfirmed,
  applyRefreshed,
  canExecuteAfterRefresh,
  reconcileBeforeExecute = false,
}: CanonicalMutationFlow<TConfirmed, TRecords>): Promise<{ status: 'saved' | 'failed'; via?: 'operation' | 'refresh' }> {
  if (reconcileBeforeExecute) {
    try {
      const records = await refresh()
      applyRefreshed(records)
      if (isSatisfied(records)) return { status: 'saved', via: 'refresh' }
      if (canExecuteAfterRefresh && !canExecuteAfterRefresh(records)) return { status: 'failed' }
    } catch {
      return { status: 'failed' }
    }
  }
  try {
    const confirmed = await execute()
    applyConfirmed(confirmed)
    return { status: 'saved', via: 'operation' }
  } catch {
    try {
      const records = await refresh()
      applyRefreshed(records)
      return isSatisfied(records) ? { status: 'saved', via: 'refresh' } : { status: 'failed' }
    } catch {
      return { status: 'failed' }
    }
  }
}

type CanonicalActionStatus = 'saved' | 'failed'

interface CoordinatedMutationFlow<TConfirmed, TRecords> extends Omit<CanonicalMutationFlow<TConfirmed, TRecords>, 'reconcileBeforeExecute'> {
  onSaving: () => void
  onSaved: () => void
  onFailed: () => void
}

export function createCanonicalActionCoordinator() {
  type QueuedAction = {
    attempts: number
    execute: (isRetry: boolean) => Promise<CanonicalActionStatus>
    resolve: () => void
  }

  const actions: QueuedAction[] = []
  let running = false
  let blocked = false

  const runNext = () => {
    if (running || blocked || actions.length === 0) return
    running = true
    const action = actions[0]
    void action.execute(action.attempts > 0)
      .catch((): CanonicalActionStatus => 'failed')
      .then(status => {
        running = false
        if (status === 'saved') {
          actions.shift()
          action.resolve()
          runNext()
          return
        }
        action.attempts += 1
        blocked = true
      })
  }

  const enqueueAction = (execute: QueuedAction['execute']): Promise<void> => new Promise(resolve => {
    actions.push({ attempts: 0, execute, resolve })
    runNext()
  })

  return {
    enqueueAction,
    enqueueMutation<TConfirmed, TRecords>(flow: CoordinatedMutationFlow<TConfirmed, TRecords>): Promise<void> {
      return enqueueAction(async isRetry => {
        flow.onSaving()
        const result = await executeCanonicalMutationWithReconciliation({
          execute: flow.execute,
          refresh: flow.refresh,
          isSatisfied: flow.isSatisfied,
          applyConfirmed: flow.applyConfirmed,
          applyRefreshed: flow.applyRefreshed,
          canExecuteAfterRefresh: flow.canExecuteAfterRefresh,
          reconcileBeforeExecute: isRetry,
        })
        if (result.status === 'saved') flow.onSaved()
        else flow.onFailed()
        return result.status
      })
    },
    retry() {
      if (!blocked || running || actions.length === 0) return
      blocked = false
      runNext()
    },
  }
}

export function getMeetingPlaybookEmptyMessage(tab: TabKey, records: MeetingPlaybookRecords): string | null {
  if (tab === 'master' && records.templates.length === 0) return 'No meeting templates yet. Create a new meeting template to get started.'
  if (tab === 'active' && records.activeMeetings.length === 0) return 'No active meetings yet. Click "+ Create Active Meeting" to get started.'
  if (tab === 'vault' && records.scripts.length === 0) return 'No scripts yet. Create a new script to get started.'
  return null
}

interface DefaultInitializationAttemptFlow {
  continuation: boolean
  defaults: MeetingPlaybookRecords
  readLegacy: () => LegacyMeetingPlaybookData
  fetchCanonical: () => Promise<MeetingPlaybookRecords>
  applyCanonical: (records: MeetingPlaybookRecords) => void
  importMissing: (canonical: MeetingPlaybookRecords) => Promise<{ complete: boolean }>
}

const containsDefaultPlaybook = (records: MeetingPlaybookRecords, defaults: MeetingPlaybookRecords): boolean =>
  defaults.templates.every(expected => records.templates.some(record => record.id === expected.id && areMeetingPlaybookRecordsEqual(record, expected))) &&
  defaults.activeMeetings.every(expected => records.activeMeetings.some(record => record.id === expected.id && areMeetingPlaybookRecordsEqual(record, expected))) &&
  defaults.scripts.every(expected => records.scripts.some(record => record.id === expected.id && areMeetingPlaybookRecordsEqual(record, expected)))

const isPartialDefaultPlaybook = (records: MeetingPlaybookRecords, defaults: MeetingPlaybookRecords): boolean => {
  const canonicalCount = records.templates.length + records.activeMeetings.length + records.scripts.length
  if (canonicalCount === 0 || containsDefaultPlaybook(records, defaults)) return false
  return records.templates.every(record => defaults.templates.some(expected => expected.id === record.id && areMeetingPlaybookRecordsEqual(record, expected))) &&
    records.activeMeetings.every(record => defaults.activeMeetings.some(expected => expected.id === record.id && areMeetingPlaybookRecordsEqual(record, expected))) &&
    records.scripts.every(record => defaults.scripts.some(expected => expected.id === record.id && areMeetingPlaybookRecordsEqual(record, expected)))
}

export async function executeDefaultInitializationAttempt({
  continuation,
  defaults,
  readLegacy,
  fetchCanonical,
  applyCanonical,
  importMissing,
}: DefaultInitializationAttemptFlow): Promise<{ status: CanonicalActionStatus | 'blocked'; mayContinueMissingOnly?: boolean }> {
  let canonical: MeetingPlaybookRecords
  try {
    canonical = await fetchCanonical()
    applyCanonical(canonical)
  } catch {
    return { status: 'failed' }
  }

  if (continuation && containsDefaultPlaybook(canonical, defaults)) return { status: 'saved' }
  const continuingPartialInitialization = continuation && isPartialDefaultPlaybook(canonical, defaults)
  const legacy = continuingPartialInitialization ? null : readLegacy()
  if (legacy) {
    const legacyCount = legacy.counts.templates + legacy.counts.activeMeetings + legacy.counts.scripts
    const canonicalCount = canonical.templates.length + canonical.activeMeetings.length + canonical.scripts.length
    const hasIssues = Object.values(legacy.issues).some(issues => issues.length > 0)
    if (legacyCount > 0 || canonicalCount > 0 || hasIssues) return { status: 'blocked' }
  }

  try {
    await importMissing(canonical)
  } catch {
    // The operation may have committed remotely; the canonical refresh below decides the outcome.
  }

  try {
    const refreshed = await fetchCanonical()
    applyCanonical(refreshed)
    if (containsDefaultPlaybook(refreshed, defaults)) return { status: 'saved' }
    return { status: 'failed', mayContinueMissingOnly: isPartialDefaultPlaybook(refreshed, defaults) }
  } catch {
    return { status: 'failed' }
  }
}

interface DefaultPlaybookInitializationActionFlow extends Omit<DefaultInitializationAttemptFlow, 'continuation'> {
  onSaving: () => void
  onSaved: () => void
  onFailed: () => void
  onBlocked: () => void
}

export function createDefaultPlaybookInitializationAction(
  flow: DefaultPlaybookInitializationActionFlow,
): (isRetry: boolean) => Promise<CanonicalActionStatus> {
  let partialContinuationProven = false
  return async isRetry => {
    flow.onSaving()
    const result = await executeDefaultInitializationAttempt({
      continuation: isRetry && partialContinuationProven,
      defaults: flow.defaults,
      readLegacy: flow.readLegacy,
      fetchCanonical: flow.fetchCanonical,
      applyCanonical: flow.applyCanonical,
      importMissing: flow.importMissing,
    })
    partialContinuationProven = result.mayContinueMissingOnly === true
    if (result.status === 'saved') {
      flow.onSaved()
      return 'saved'
    }
    if (result.status === 'blocked') {
      flow.onBlocked()
      return 'saved'
    }
    flow.onFailed()
    return 'failed'
  }
}

interface CanonicalLoadFlow<TRecords> {
  fetchCanonical: () => Promise<TRecords>
  applyCanonical: (records: TRecords) => void
}

export async function loadCanonicalMeetingPlaybook<TRecords>({
  fetchCanonical,
  applyCanonical,
}: CanonicalLoadFlow<TRecords>): Promise<{ status: 'ready' | 'failed'; records?: TRecords }> {
  try {
    const records = await fetchCanonical()
    applyCanonical(records)
    return { status: 'ready', records }
  } catch {
    return { status: 'failed' }
  }
}

interface BulkActionFlow<TRecords> {
  execute: () => Promise<{ complete: boolean }>
  refresh: () => Promise<TRecords>
  applyRefreshed: (records: TRecords) => void
}

export async function executeBulkActionWithRefresh<TRecords>({
  execute,
  refresh,
  applyRefreshed,
}: BulkActionFlow<TRecords>): Promise<{ status: 'saved' | 'failed'; records?: TRecords }> {
  let complete: boolean
  try {
    complete = (await execute()).complete
  } catch {
    complete = false
  }
  try {
    const records = await refresh()
    applyRefreshed(records)
    return { status: complete ? 'saved' : 'failed', records }
  } catch {
    return { status: 'failed' }
  }
}

export function MeetingPlaybookPersistenceNotice({
  state,
  isRefreshing = false,
  onRetry,
}: {
  state: PersistenceState
  isRefreshing?: boolean
  onRetry: () => void
}) {
  if (state === 'idle' && !isRefreshing) return null
  const message = state === 'saving'
    ? 'Saving canonical Meeting Playbook…'
    : state === 'saved'
      ? 'Saved to canonical Meeting Playbook.'
      : state === 'failed'
        ? 'Canonical save failed. The last confirmed state is shown.'
        : state === 'blocked'
          ? 'Default initialization was blocked because canonical or preserved browser data appeared. Review the current records before initializing.'
          : 'Refreshing canonical Meeting Playbook…'
  return (
    <div
      className="rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        color: state === 'failed' || state === 'blocked' ? '#B91C1C' : 'var(--text-secondary)',
      }}
      role="status"
      aria-live="polite"
    >
      <span>{message}</span>
      {state === 'failed' && (
        <button className="font-medium" style={{ color: 'var(--accent)' }} onClick={onRetry}>Retry</button>
      )}
    </div>
  )
}

export default function MeetingPlaybook() {
  const [activeTab, setActiveTab] = useState<TabKey>('master')
  const [templates, setTemplates] = useState<MeetingTemplate[]>(() =>
    isSupabaseConfigured ? [] : readLocalArray(LEGACY_TEMPLATES_KEY, defaultTemplates))
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [activeMeetings, setActiveMeetings] = useState<ActiveMeeting[]>(() =>
    isSupabaseConfigured ? [] : readLocalArray(LEGACY_ACTIVE_MEETINGS_KEY, []))
  const [selectedMeeting, setSelectedMeeting] = useState<string>('')
  const [scripts, setScripts] = useState<ScriptCard[]>(() =>
    isSupabaseConfigured ? [] : readLocalArray(LEGACY_SCRIPTS_KEY, defaultScripts))
  const [editingField, setEditingField] = useState<{ target: string; id: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [canonicalLoaded, setCanonicalLoaded] = useState(!isSupabaseConfigured)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>(isSupabaseConfigured ? 'loading' : 'ready')
  const [persistenceState, setPersistenceState] = useState<PersistenceState>('idle')
  const [legacy, setLegacy] = useState<LegacyMeetingPlaybookData>(() => {
    if (!isSupabaseConfigured || typeof window === 'undefined') return emptyLegacy()
    return readLegacyMeetingPlaybook(window.localStorage)
  })
  const [legacyKeysPresent, setLegacyKeysPresent] = useState(() => {
    if (!isSupabaseConfigured || typeof window === 'undefined') return false
    try {
      return [LEGACY_TEMPLATES_KEY, LEGACY_ACTIVE_MEETINGS_KEY, LEGACY_SCRIPTS_KEY]
        .some(key => window.localStorage.getItem(key) !== null)
    } catch {
      return true
    }
  })
  const retryRef = useRef<(() => void) | null>(null)
  const actionCoordinatorRef = useRef(createCanonicalActionCoordinator())
  const canonicalRecordsRef = useRef<MeetingPlaybookRecords>({ templates, activeMeetings, scripts })
  const canonicalClient = supabase as unknown as MeetingPlaybookClient | null

  const applyCanonicalRecords = useCallback((records: MeetingPlaybookRecords) => {
    canonicalRecordsRef.current = records
    setTemplates(records.templates)
    setActiveMeetings(records.activeMeetings)
    setScripts(records.scripts)
    setSelectedTemplate(current => current && records.templates.some(record => record.id === current) ? current : null)
    setSelectedMeeting(current => current && records.activeMeetings.some(record => record.id === current)
      ? current
      : records.activeMeetings[0]?.id || '')
  }, [])

  const commitCanonicalRecords = useCallback((
    update: (records: MeetingPlaybookRecords) => MeetingPlaybookRecords,
  ) => {
    applyCanonicalRecords(update(canonicalRecordsRef.current))
  }, [applyCanonicalRecords])

  const refreshCanonicalRecords = useCallback(async (): Promise<MeetingPlaybookRecords> => {
    if (!canonicalClient) throw new Error('Canonical client unavailable')
    setLoadState('loading')
    const result = await loadCanonicalMeetingPlaybook({
      fetchCanonical: () => fetchCanonicalMeetingPlaybook(canonicalClient),
      applyCanonical: applyCanonicalRecords,
    })
    if (result.status === 'ready' && result.records) {
      setCanonicalLoaded(true)
      setLoadState('ready')
      return result.records
    }
    setLoadState('failed')
    throw new Error('Canonical Meeting Playbook refresh failed')
  }, [applyCanonicalRecords, canonicalClient])

  const loadCanonical = useCallback(async (): Promise<boolean> => {
    try {
      await refreshCanonicalRecords()
      return true
    } catch {
      return false
    }
  }, [refreshCanonicalRecords])

  useEffect(() => {
    if (!isSupabaseConfigured) window.localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(templates))
  }, [templates])
  useEffect(() => {
    if (!isSupabaseConfigured) window.localStorage.setItem(LEGACY_ACTIVE_MEETINGS_KEY, JSON.stringify(activeMeetings))
  }, [activeMeetings])
  useEffect(() => {
    if (!isSupabaseConfigured) window.localStorage.setItem(LEGACY_SCRIPTS_KEY, JSON.stringify(scripts))
  }, [scripts])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    retryRef.current = () => { void loadCanonical() }
    void loadCanonical()
  }, [loadCanonical])

  useEffect(() => {
    if (!selectedMeeting && activeMeetings.length > 0) {
      setSelectedMeeting(activeMeetings[0].id)
    }
  }, [activeMeetings, selectedMeeting])

  const canonicalRecords = useMemo<MeetingPlaybookRecords>(() => ({ templates, activeMeetings, scripts }), [activeMeetings, scripts, templates])
  canonicalRecordsRef.current = canonicalRecords
  const importPlan = useMemo(() => planLegacyMeetingPlaybookImport(legacy.records, canonicalRecords), [canonicalRecords, legacy.records])
  const legacyValidCount = legacy.counts.templates + legacy.counts.activeMeetings + legacy.counts.scripts
  const canonicalCount = templates.length + activeMeetings.length + scripts.length
  const missingCount = importPlan.missing.templates.length + importPlan.missing.activeMeetings.length + importPlan.missing.scripts.length

  if (isSupabaseConfigured && !canonicalLoaded) {
    return (
      <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
        <div className="rounded-2xl border p-6 text-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }} role="status" aria-live="polite">
          {loadState === 'loading' ? 'Loading canonical Meeting Playbook…' : 'Canonical Meeting Playbook failed to load. Existing browser records remain preserved.'}
          {loadState === 'failed' && (
            <button className="ml-3 font-medium" style={{ color: 'var(--accent)' }} onClick={() => retryRef.current?.()}>Retry</button>
          )}
        </div>
      </div>
    )
  }

  const activeTemplate = templates.find(t => t.id === selectedTemplate)
  const activeMeeting = activeMeetings.find(m => m.id === selectedMeeting)
  const activeLinks = activeMeeting?.links || []
  const activeChecklist = activeMeeting?.checklist || []

  const markCanonicalActionFailed = () => {
    retryRef.current = () => actionCoordinatorRef.current.retry()
    setPersistenceState('failed')
  }

  const markCanonicalActionSaved = () => {
    retryRef.current = null
    setPersistenceState('saved')
  }

  const runCanonicalMutation = async <T,>(
    operation: () => Promise<T>,
    applyConfirmed: (confirmed: T) => void,
    isSatisfied: (records: MeetingPlaybookRecords) => boolean,
    successActivity: string,
    failedActivity: string,
    canExecuteAfterRefresh?: (records: MeetingPlaybookRecords) => boolean,
  ) => {
    if (!canonicalClient) return
    return actionCoordinatorRef.current.enqueueMutation({
      execute: operation,
      refresh: refreshCanonicalRecords,
      isSatisfied,
      applyConfirmed,
      applyRefreshed: applyCanonicalRecords,
      canExecuteAfterRefresh,
      onSaving: () => setPersistenceState('saving'),
      onSaved: () => {
        markCanonicalActionSaved()
        void logActivity('Meeting Playbook', successActivity)
      },
      onFailed: () => {
        markCanonicalActionFailed()
        void logActivity('Meeting Playbook', failedActivity)
      },
    })
  }

  const saveTemplate = async (
    id: string,
    update: (current: MeetingTemplate) => MeetingTemplate,
    activity = 'Updated meeting template',
  ) => {
    if (!isSupabaseConfigured) {
      setTemplates(current => current.map(item => item.id === id ? update(item) : item))
      return
    }
    let intended: MeetingTemplate | null = null
    const operation = createLatestRecordUpdate({
      getRecords: () => canonicalRecordsRef.current.templates,
      id,
      update: current => (intended = update(current)),
      persist: next => updateMeetingTemplate(canonicalClient!, next),
    })
    await runCanonicalMutation(
      operation,
      confirmed => commitCanonicalRecords(records => ({
        ...records,
        templates: records.templates.map(item => item.id === confirmed.id ? confirmed : item),
      })),
      records => intended !== null && records.templates.some(item => item.id === id && areMeetingPlaybookRecordsEqual(item, intended)),
      activity,
      'Meeting template update failed',
      records => records.templates.some(item => item.id === id),
    )
  }

  const saveActiveMeeting = async (
    id: string,
    update: (current: ActiveMeeting) => ActiveMeeting,
    activity = 'Updated active meeting',
  ) => {
    if (!isSupabaseConfigured) {
      setActiveMeetings(current => current.map(item => item.id === id ? update(item) : item))
      return
    }
    let intended: ActiveMeeting | null = null
    const operation = createLatestRecordUpdate({
      getRecords: () => canonicalRecordsRef.current.activeMeetings,
      id,
      update: current => (intended = update(current)),
      persist: next => updateActiveMeeting(canonicalClient!, next),
    })
    await runCanonicalMutation(
      operation,
      confirmed => commitCanonicalRecords(records => ({
        ...records,
        activeMeetings: records.activeMeetings.map(item => item.id === confirmed.id ? confirmed : item),
      })),
      records => intended !== null && records.activeMeetings.some(item => item.id === id && areMeetingPlaybookRecordsEqual(item, intended)),
      activity,
      'Active meeting update failed',
      records => records.activeMeetings.some(item => item.id === id),
    )
  }

  const saveScript = async (
    id: string,
    update: (current: ScriptCard) => ScriptCard,
    activity = 'Updated meeting script',
  ) => {
    if (!isSupabaseConfigured) {
      setScripts(current => current.map(item => item.id === id ? update(item) : item))
      return
    }
    let intended: ScriptCard | null = null
    const operation = createLatestRecordUpdate({
      getRecords: () => canonicalRecordsRef.current.scripts,
      id,
      update: current => (intended = update(current)),
      persist: next => updateMeetingScript(canonicalClient!, next),
    })
    await runCanonicalMutation(
      operation,
      confirmed => commitCanonicalRecords(records => ({
        ...records,
        scripts: records.scripts.map(item => item.id === confirmed.id ? confirmed : item),
      })),
      records => intended !== null && records.scripts.some(item => item.id === id && areMeetingPlaybookRecordsEqual(item, intended)),
      activity,
      'Meeting script update failed',
      records => records.scripts.some(item => item.id === id),
    )
  }

  const saveEdit = async () => {
    if (!editingField) return
    const { target, id } = editingField
    setEditingField(null)
    setEditValue('')
    const templateTargets = ['goal', 'description', 'name', 'step-text', 'step-time', 'step-desc', 'kpi', 'tip']
    const templateId = ['goal', 'description', 'name'].includes(target) ? id : selectedTemplate
    if (templateTargets.includes(target) && templateId) {
      await saveTemplate(templateId, current => {
        if (target === 'goal') return { ...current, goal: editValue }
        if (target === 'description') return { ...current, description: editValue }
        if (target === 'name') return { ...current, name: editValue }
        if (target === 'step-text') return { ...current, flowSteps: current.flowSteps.map(step => step.id === id ? { ...step, text: editValue } : step) }
        if (target === 'step-time') return { ...current, flowSteps: current.flowSteps.map(step => step.id === id ? { ...step, time: editValue } : step) }
        if (target === 'step-desc') return { ...current, flowSteps: current.flowSteps.map(step => step.id === id ? { ...step, description: editValue } : step) }
        if (target === 'kpi') return { ...current, kpis: current.kpis.map((value, index) => index === Number(id) ? editValue : value) }
        return { ...current, proTips: current.proTips.map((value, index) => index === Number(id) ? editValue : value) }
      })
      return
    }
    const meetingTargets = ['meeting-name', 'link-url', 'link-label', 'checklist-text']
    const meetingId = target === 'meeting-name' ? id : selectedMeeting
    if (meetingTargets.includes(target) && meetingId) {
      await saveActiveMeeting(meetingId, current => {
        if (target === 'meeting-name') return { ...current, name: editValue }
        if (target === 'link-url') return { ...current, links: current.links.map(link => link.id === id ? { ...link, url: editValue } : link) }
        if (target === 'link-label') return { ...current, links: current.links.map(link => link.id === id ? { ...link, label: editValue } : link) }
        return { ...current, checklist: current.checklist.map(item => item.id === id ? { ...item, text: editValue } : item) }
      })
      return
    }
    if (['script-name', 'script-text', 'script-category'].includes(target)) {
      await saveScript(id, current => {
        if (target === 'script-name') return { ...current, name: editValue }
        if (target === 'script-text') return { ...current, text: editValue }
        return { ...current, category: editValue }
      })
    }
  }

  const startEdit = (target: string, id: string, value: string) => {
    setEditingField({ target, id })
    setEditValue(value)
  }

  const addKpi = () => {
    if (selectedTemplate) void saveTemplate(selectedTemplate, current => ({ ...current, kpis: [...current.kpis, 'New KPI'] }))
  }

  const deleteKpi = (index: number) => {
    if (selectedTemplate) void saveTemplate(selectedTemplate, current => ({ ...current, kpis: current.kpis.filter((_, i) => i !== index) }))
  }

  const addTip = () => {
    if (selectedTemplate) void saveTemplate(selectedTemplate, current => ({ ...current, proTips: [...current.proTips, 'New tip'] }))
  }

  const deleteTip = (index: number) => {
    if (selectedTemplate) void saveTemplate(selectedTemplate, current => ({ ...current, proTips: current.proTips.filter((_, i) => i !== index) }))
  }

  const addStep = () => {
    if (!selectedTemplate) return
    const id = createMeetingPlaybookId('step')
    void saveTemplate(selectedTemplate, current => ({ ...current, flowSteps: [...current.flowSteps, { id, text: 'New step', time: '5 min', description: '' }] }))
  }

  const deleteStep = (stepId: string) => {
    if (selectedTemplate) void saveTemplate(selectedTemplate, current => ({ ...current, flowSteps: current.flowSteps.filter(step => step.id !== stepId) }))
  }

  const addTemplate = () => {
    const id = createMeetingPlaybookId('template')
    const record = { id, name: 'New Meeting Template', description: '', goal: '', kpis: [], proTips: [], flowSteps: [] }
    if (!isSupabaseConfigured) {
      setTemplates(current => [...current, record])
      setSelectedTemplate(id)
      return
    }
    void runCanonicalMutation(
      () => createMeetingTemplate(canonicalClient!, record),
      confirmed => {
        commitCanonicalRecords(records => ({ ...records, templates: [...records.templates, confirmed] }))
        setSelectedTemplate(confirmed.id)
      },
      records => records.templates.some(item => item.id === record.id && areMeetingPlaybookRecordsEqual(item, record)),
      'Created meeting template',
      'Meeting template creation failed',
      records => !records.templates.some(item => item.id === record.id),
    )
  }

  const deleteTemplate = (id: string) => {
    if (!isSupabaseConfigured) {
      setTemplates(current => current.filter(record => record.id !== id))
      if (selectedTemplate === id) setSelectedTemplate(null)
      return
    }
    void runCanonicalMutation(
      () => deleteMeetingTemplate(canonicalClient!, id),
      confirmedId => {
        commitCanonicalRecords(records => ({ ...records, templates: records.templates.filter(record => record.id !== confirmedId) }))
        setSelectedTemplate(current => current === confirmedId ? null : current)
      },
      records => !records.templates.some(record => record.id === id),
      'Deleted meeting template',
      'Meeting template deletion failed',
    )
  }

  const addLink = () => {
    if (!selectedMeeting) return
    const id = createMeetingPlaybookId('link')
    void saveActiveMeeting(selectedMeeting, current => ({ ...current, links: [...current.links, { id, label: '🔗 New Link', url: '' }] }))
  }

  const deleteLink = (id: string) => {
    if (selectedMeeting) void saveActiveMeeting(selectedMeeting, current => ({ ...current, links: current.links.filter(link => link.id !== id) }))
  }

  const addChecklistItem = () => {
    if (!selectedMeeting) return
    const id = createMeetingPlaybookId('check')
    void saveActiveMeeting(selectedMeeting, current => ({ ...current, checklist: [...current.checklist, { id, text: 'New checklist item', checked: false }] }))
  }

  const deleteChecklistItem = (id: string) => {
    if (selectedMeeting) void saveActiveMeeting(selectedMeeting, current => ({ ...current, checklist: current.checklist.filter(item => item.id !== id) }))
  }

  const toggleChecklistItem = (id: string) => {
    if (selectedMeeting) void saveActiveMeeting(selectedMeeting, current => ({ ...current, checklist: current.checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item) }))
  }

  const addScript = () => {
    const id = createMeetingPlaybookId('script')
    const record = { id, name: 'New Script', category: 'General', text: 'Write your script here...' }
    if (!isSupabaseConfigured) { setScripts(current => [...current, record]); return }
    void runCanonicalMutation(
      () => createMeetingScript(canonicalClient!, record),
      confirmed => commitCanonicalRecords(records => ({ ...records, scripts: [...records.scripts, confirmed] })),
      records => records.scripts.some(item => item.id === record.id && areMeetingPlaybookRecordsEqual(item, record)),
      'Created meeting script',
      'Meeting script creation failed',
      records => !records.scripts.some(item => item.id === record.id),
    )
  }

  const deleteScript = (id: string) => {
    if (!isSupabaseConfigured) { setScripts(current => current.filter(record => record.id !== id)); return }
    void runCanonicalMutation(
      () => deleteMeetingScript(canonicalClient!, id),
      confirmedId => commitCanonicalRecords(records => ({ ...records, scripts: records.scripts.filter(record => record.id !== confirmedId) })),
      records => !records.scripts.some(record => record.id === id),
      'Deleted meeting script',
      'Meeting script deletion failed',
    )
  }

  const createActiveMeeting = () => {
    const id = createMeetingPlaybookId('active')
    const name = 'Meeting ' + (activeMeetings.length + 1)
    const record = { id, name, links: [{ id: createMeetingPlaybookId('link'), label: '🔗 Meeting Link', url: '' }], checklist: [] }
    if (!isSupabaseConfigured) {
      setActiveMeetings(current => [...current, record])
      setSelectedMeeting(id)
      return
    }
    void runCanonicalMutation(
      () => createCanonicalActiveMeeting(canonicalClient!, record),
      confirmed => {
        commitCanonicalRecords(records => ({ ...records, activeMeetings: [...records.activeMeetings, confirmed] }))
        setSelectedMeeting(confirmed.id)
      },
      records => records.activeMeetings.some(item => item.id === record.id && areMeetingPlaybookRecordsEqual(item, record)),
      'Created active meeting',
      'Active meeting creation failed',
      records => !records.activeMeetings.some(item => item.id === record.id),
    )
  }

  const deleteActiveMeeting = (id: string) => {
    const applyDelete = (confirmedId: string) => {
      const remaining = canonicalRecordsRef.current.activeMeetings.filter(record => record.id !== confirmedId)
      if (isSupabaseConfigured) commitCanonicalRecords(records => ({ ...records, activeMeetings: remaining }))
      else setActiveMeetings(remaining)
      if (selectedMeeting === confirmedId) setSelectedMeeting(remaining[0]?.id || '')
    }
    if (!isSupabaseConfigured) { applyDelete(id); return }
    void runCanonicalMutation(
      () => deleteCanonicalActiveMeeting(canonicalClient!, id),
      applyDelete,
      records => !records.activeMeetings.some(record => record.id === id),
      'Deleted active meeting',
      'Active meeting deletion failed',
    )
  }

  const downloadLegacyBackup = () => {
    const backup = serializeMeetingPlaybookBackup(legacy.records, new Date().toISOString())
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `meeting-playbook-browser-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const refreshLegacyReview = () => {
    const current = readLegacyMeetingPlaybook(window.localStorage)
    setLegacy(current)
    try {
      setLegacyKeysPresent([LEGACY_TEMPLATES_KEY, LEGACY_ACTIVE_MEETINGS_KEY, LEGACY_SCRIPTS_KEY]
        .some(key => window.localStorage.getItem(key) !== null))
    } catch {
      setLegacyKeysPresent(true)
    }
    return current
  }

  const importLegacy = async () => {
    if (!canonicalClient) return
    return actionCoordinatorRef.current.enqueueAction(async () => {
      setPersistenceState('saving')
      try {
        const freshLegacy = refreshLegacyReview()
        const freshCanonical = await refreshCanonicalRecords()
        const result = await executeBulkActionWithRefresh({
          execute: async () => {
            const outcome = await importMissingLegacyMeetingPlaybook(canonicalClient, freshLegacy.records, freshCanonical)
            return { complete: outcome.complete }
          },
          refresh: refreshCanonicalRecords,
          applyRefreshed: applyCanonicalRecords,
        })
        if (result.status !== 'saved') throw new Error('Import was not fully confirmed')
        markCanonicalActionSaved()
        void logActivity('Meeting Playbook', 'Imported missing browser records')
      } catch {
        markCanonicalActionFailed()
        void logActivity('Meeting Playbook', 'Browser record import failed')
        return 'failed'
      }
      return 'saved'
    })
  }

  const initializeDefaults = async () => {
    if (!canonicalClient) return
    return actionCoordinatorRef.current.enqueueAction(createDefaultPlaybookInitializationAction({
      defaults: defaultRecords,
      readLegacy: refreshLegacyReview,
      fetchCanonical: refreshCanonicalRecords,
      applyCanonical: applyCanonicalRecords,
      importMissing: async freshCanonical => {
        const outcome = await importMissingLegacyMeetingPlaybook(canonicalClient, defaultRecords, freshCanonical)
        return { complete: outcome.complete }
      },
      onSaving: () => setPersistenceState('saving'),
      onSaved: () => {
        markCanonicalActionSaved()
        void logActivity('Meeting Playbook', 'Initialized default playbook')
      },
      onBlocked: () => {
        retryRef.current = null
        setPersistenceState('blocked')
        void logActivity('Meeting Playbook', 'Default playbook initialization failed')
      },
      onFailed: () => {
        markCanonicalActionFailed()
        void logActivity('Meeting Playbook', 'Default playbook initialization failed')
      },
    }))
  }

  const tabStyle = (tab: TabKey) => ({
    backgroundColor: activeTab === tab ? 'var(--accent)' : 'var(--bg-card)',
    color: activeTab === tab ? '#FFFFFF' : 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="rounded-2xl overflow-hidden mb-6 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Meeting Playbook</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Client meeting guides and best practices</p>
            </div>
          </div>
        </div>
      </div>

      {isSupabaseConfigured && (
        <div className="mb-6 space-y-3">
          {(loadState === 'loading' || persistenceState !== 'idle') && (
            <MeetingPlaybookPersistenceNotice
              state={persistenceState}
              isRefreshing={loadState === 'loading'}
              onRetry={() => retryRef.current?.()}
            />
          )}

          {legacyKeysPresent && (
            <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} aria-labelledby="legacy-playbook-title">
              <h2 id="legacy-playbook-title" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Review preserved browser records</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Browser records remain untouched. Review the backup, parse results, and collision preview before importing only missing IDs.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>Templates: {legacy.counts.templates} valid · {importPlan.missing.templates.length} missing · {importPlan.collisions.templates} collisions</span>
                <span>Active meetings: {legacy.counts.activeMeetings} valid · {importPlan.missing.activeMeetings.length} missing · {importPlan.collisions.activeMeetings} collisions</span>
                <span>Scripts: {legacy.counts.scripts} valid · {importPlan.missing.scripts.length} missing · {importPlan.collisions.scripts} collisions</span>
              </div>
              {Object.entries(legacy.issues).some(([, issues]) => issues.length > 0) && (
                <ul className="mt-3 space-y-1 text-xs" style={{ color: '#B91C1C' }}>
                  {Object.entries(legacy.issues).flatMap(([key, issues]) => issues.map(issue => (
                    <li key={`${key}:${issue}`}>{key}: {issue}</li>
                  )))}
                </ul>
              )}
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{missingCount} valid missing record{missingCount === 1 ? '' : 's'} available to import.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }} onClick={downloadLegacyBackup}>Download JSON backup</button>
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                  disabled={missingCount === 0 || persistenceState === 'saving'}
                  onClick={() => { void importLegacy() }}
                >
                  Import missing records
                </button>
              </div>
            </section>
          )}

          {canonicalCount === 0 && legacyValidCount === 0 && (
            <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No canonical playbook records yet</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Bundled templates and scripts are available, but will not become shared data until you explicitly initialize them.</p>
              <button
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                disabled={persistenceState === 'saving'}
                onClick={() => { void initializeDefaults() }}
              >
                Initialize default playbook
              </button>
            </section>
          )}
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('active')} onClick={() => setActiveTab('active')}>Active Meeting</button>
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('master')} onClick={() => { setActiveTab('master'); setSelectedTemplate(null) }}>Master Playbook</button>
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('vault')} onClick={() => setActiveTab('vault')}>Script & Cheat Sheet Vault</button>
      </div>

      {/* TAB 1: ACTIVE MEETING WORKSPACE */}
      {activeTab === 'active' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Active Meeting</h2>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }} onClick={createActiveMeeting}>+ Create Active Meeting</button>
          </div>

          {activeMeetings.length > 0 && activeMeeting ? (
            <div>
              {/* Meeting Selector */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {activeMeetings.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMeeting(m.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5"
                    style={{
                      backgroundColor: selectedMeeting === m.id ? 'var(--accent)' : 'var(--bg-card)',
                      color: selectedMeeting === m.id ? '#FFFFFF' : 'var(--text-secondary)',
                      border: '1px solid var(--border-primary)',
                    }}
                  >
                    {editingField?.target === 'meeting-name' && editingField?.id === m.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }}
                        className="w-24 px-1 py-0.5 rounded border outline-none text-xs"
                        style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span onClick={e => { if (selectedMeeting === m.id) { e.stopPropagation(); startEdit('meeting-name', m.id, m.name) } }} style={{ cursor: selectedMeeting === m.id ? 'pointer' : 'default' }}>{m.name}</span>
                    )}
                    <span className="text-[10px] opacity-60">({m.links.length + m.checklist.length})</span>
                    <button
                      className="p-0.5 rounded-full hover:opacity-70"
                      style={{ color: selectedMeeting === m.id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
                      onClick={e => { e.stopPropagation(); deleteActiveMeeting(m.id) }}
                      title="Delete meeting"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </button>
                ))}
              </div>

              {/* Merged Card: Links & Checklist */}
              <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Preparation & Assets</h3>
                <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Links & checklist for the current meeting</p>

                {/* Links */}
                <div className="mb-4">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Important Links & Assets</h4>
                  <div className="space-y-2">
                    {activeLinks.map(link => (
                      <div key={link.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {editingField?.target === 'link-label' && editingField?.id === link.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => startEdit('link-label', link.id, link.label)}>{link.label}</span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>:</span>
                        {editingField?.target === 'link-url' && editingField?.id === link.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} placeholder="Paste URL here..." className="flex-1 px-2 py-0.5 rounded border outline-none text-xs" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span className="text-xs flex-1 truncate" style={{ color: link.url ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('link-url', link.id, link.url)}>{link.url || 'Paste URL here...'}</span>
                        )}
                        <button className="p-0.5 transition hover:opacity-70 flex-shrink-0" style={{ color: 'var(--text-muted)' }} onClick={() => deleteLink(link.id)} title="Delete link">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="text-xs mt-2 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addLink}>➕ Add New Link/Asset</button>
                </div>

                {/* Divider */}
                <div className="border-t my-4" style={{ borderColor: 'var(--border-secondary)' }}></div>

                {/* Checklist */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Pre-Meeting Checklist</h4>
                  <div className="space-y-2">
                    {activeChecklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <input type="checkbox" checked={item.checked} onChange={() => toggleChecklistItem(item.id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                        {editingField?.target === 'checklist-text' && editingField?.id === item.id ? (
                          <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="flex-1 px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
                        ) : (
                          <span className="text-xs flex-1" style={{ color: item.checked ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 300, textDecoration: item.checked ? 'line-through' : 'none' }} onClick={() => startEdit('checklist-text', item.id, item.text)}>{item.text}</span>
                        )}
                        <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteChecklistItem(item.id)} title="Delete item">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="text-xs mt-2 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addChecklistItem}>➕ Add Custom Checklist Item</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{getMeetingPlaybookEmptyMessage('active', canonicalRecords)}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MASTER PLAYBOOK */}
      {activeTab === 'master' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Meeting Types & Formulas</h2>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }} onClick={addTemplate}>+ Create New Meeting Template</button>
          </div>

          {selectedTemplate && activeTemplate ? (
            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button className="text-xs font-medium transition" style={{ color: 'var(--accent)' }} onClick={() => setSelectedTemplate(null)}>← Back to list</button>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/</span>
                  <div>
                    {editingField?.target === 'name' && editingField?.id === activeTemplate.id ? (
                      <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs font-semibold" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                    ) : (
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => startEdit('name', activeTemplate.id, activeTemplate.name)}>{activeTemplate.name}</h3>
                    )}
                    {editingField?.target === 'description' && editingField?.id === activeTemplate.id ? (
                      <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y mt-0.5" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 60 }} rows={2} />
                    ) : (
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('description', activeTemplate.id, activeTemplate.description)}>{activeTemplate.description || 'Click to add description...'}</p>
                    )}
                  </div>
                </div>
                <button className="p-1 rounded transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => { deleteTemplate(activeTemplate.id) }} title="Delete template">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              {/* Objective & KPIs */}
              <div className="mb-4">
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Objective & KPIs</h4>
                <div className="mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Goal: </span>
                  {editingField?.target === 'goal' && editingField?.id === activeTemplate.id ? (
                    <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 60 }} rows={2} />
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('goal', activeTemplate.id, activeTemplate.goal)}>{activeTemplate.goal} <span className="text-[10px]" style={{ color: 'var(--accent)' }}>✏️</span></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>KPIs:</span>
                  <ul className="mt-1 space-y-1">
                    {activeTemplate.kpis.map((kpi, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                        <span style={{ color: 'var(--accent)' }}>•</span>
                        {editingField?.target === 'kpi' && editingField?.id === String(i) ? (
                          <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
                        ) : (
                          <span style={{ cursor: 'pointer' }} onClick={() => startEdit('kpi', String(i), kpi)}>{kpi}</span>
                        )}
                        <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteKpi(i)} title="Delete KPI">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button className="text-xs mt-1 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addKpi}>➕ Add KPI</button>
                </div>
              </div>

              {/* Pro-Tips */}
              <div className="mb-4">
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Pro-Tips</h4>
                <ul className="space-y-1">
                  {activeTemplate.proTips.map((tip, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                      <span style={{ color: 'var(--accent)' }}>💡</span>
                      {editingField?.target === 'tip' && editingField?.id === String(i) ? (
                        <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
                      ) : (
                        <span style={{ cursor: 'pointer' }} onClick={() => startEdit('tip', String(i), tip)}>{tip}</span>
                      )}
                      <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteTip(i)} title="Delete tip">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="text-xs mt-1 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addTip}>➕ Add Tip</button>
              </div>

              {/* Meeting Flow Guide */}
              <div>
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>The Meeting Flow Guide</h4>
                <div className="space-y-2">
                  {activeTemplate.flowSteps.map((step, i) => (
                    <div key={step.id} className="p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          {editingField?.target === 'step-text' && editingField?.id === step.id ? (
                            <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => startEdit('step-text', step.id, step.text)}>{step.text}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {editingField?.target === 'step-time' && editingField?.id === step.id ? (
                            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-16 px-2 py-0.5 rounded border outline-none text-xs text-center" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                          ) : (
                            <span className="text-xs font-mono" style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => startEdit('step-time', step.id, step.time)}>{step.time}</span>
                          )}
                          <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteStep(step.id)} title="Delete step">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 ml-7">
                        {editingField?.target === 'step-desc' && editingField?.id === step.id ? (
                          <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-[11px] resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} placeholder="Add description..." />
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('step-desc', step.id, step.description)}>{step.description || 'Click to add description...'}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="text-xs mt-2 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addStep}>➕ Add New Step</button>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{getMeetingPlaybookEmptyMessage('master', canonicalRecords)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="rounded-xl border p-4 cursor-pointer transition hover:opacity-80" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={() => setSelectedTemplate(t.id)}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</h3>
                  <p className="text-[10px] mt-0.5 mb-3" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{t.description || 'No description'}</p>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{t.flowSteps.length} steps</span>
                    <span>{t.kpis.length} KPIs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCRIPT & CHEAT SHEET VAULT */}
      {activeTab === 'vault' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Talk Scripts & Cheat Sheets</h2>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }} onClick={addScript}>➕ Create New Script</button>
          </div>
          {scripts.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{getMeetingPlaybookEmptyMessage('vault', canonicalRecords)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {scripts.map(script => (
              <div key={script.id} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-1">
                  {editingField?.target === 'script-name' && editingField?.id === script.id ? (
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="flex-1 px-2 py-0.5 rounded border outline-none text-xs font-semibold" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  ) : (
                    <h3 className="text-xs font-semibold flex-1" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => startEdit('script-name', script.id, script.name)}>{script.name}</h3>
                  )}
                  <button className="p-0.5 transition hover:opacity-70 flex-shrink-0" style={{ color: 'var(--text-muted)' }} onClick={() => deleteScript(script.id)} title="Delete script">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Script for {script.category.toLowerCase()}</p>
                <div className="mb-2">
                  {editingField?.target === 'script-category' && editingField?.id === script.id ? (
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-[10px]" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => startEdit('script-category', script.id, script.category)}>{script.category}</span>
                  )}
                </div>
                {editingField?.target === 'script-text' && editingField?.id === script.id ? (
                  <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-3 py-2 rounded border outline-none resize-y text-xs leading-relaxed" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 80 }} rows={3} />
                ) : (
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('script-text', script.id, script.text)}>{script.text}</p>
                )}
                <button className="text-xs font-medium transition" style={{ color: 'var(--accent)' }} onClick={() => navigator.clipboard.writeText(script.text)}>📋 Copy to Clipboard</button>
              </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
