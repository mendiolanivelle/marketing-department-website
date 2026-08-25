import { createActivityInsert } from './dashboardData'
import {
  createActivityId,
  createPendingActivity,
  isSameCanonicalActivity,
  mergeActivityEntries,
  setActivityDeliveryStatus,
} from './activityState'
import type { ActivityStateEntry, CanonicalActivityEntry } from './activityState'
import { isSupabaseConfigured, supabase } from './supabase'

const MAX_ACTIVITIES = 100
const PENDING_STORAGE_PREFIX = 'exodia-activity-pending:'

export type ActivityEntry = ActivityStateEntry

const activityLog: ActivityEntry[] = []
let activityRevision = 0
let activityUserId: string | null = null
let activityGeneration = 0

const notifyActivityChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('activity-updated'))
}

const replaceActivityLog = (entries: ActivityEntry[]) => {
  activityLog.splice(0, activityLog.length, ...entries.slice(0, MAX_ACTIVITIES))
  activityRevision += 1
  if (activityUserId && typeof window !== 'undefined') {
    const pendingEntries = activityLog.filter(entry => entry.deliveryStatus !== 'saved')
    const key = `${PENDING_STORAGE_PREFIX}${activityUserId}`
    try {
      if (pendingEntries.length > 0) {
        window.localStorage.setItem(key, JSON.stringify(pendingEntries))
      } else {
        window.localStorage.removeItem(key)
      }
    } catch {
      // Activity still remains visible in memory when browser storage is unavailable.
    }
  }
  notifyActivityChanged()
}

const isCurrentOwner = (userId: string, generation: number) => (
  activityUserId === userId && activityGeneration === generation
)

const readPendingActivities = (userId: string): ActivityEntry[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(`${PENDING_STORAGE_PREFIX}${userId}`)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is ActivityEntry => (
        Boolean(entry)
        && typeof entry === 'object'
        && Number.isSafeInteger((entry as ActivityEntry).id)
        && typeof (entry as ActivityEntry).action === 'string'
        && typeof (entry as ActivityEntry).detail === 'string'
        && typeof (entry as ActivityEntry).timestamp === 'string'
        && ['pending', 'failed'].includes((entry as ActivityEntry).deliveryStatus)
      ))
      .map(entry => ({ ...entry, deliveryStatus: 'failed' as const }))
      .slice(0, MAX_ACTIVITIES)
  } catch {
    return []
  }
}

const setDeliveryStatus = (
  id: number,
  deliveryStatus: ActivityEntry['deliveryStatus'],
  userId: string,
  generation: number,
) => {
  if (!isCurrentOwner(userId, generation)) return
  replaceActivityLog(setActivityDeliveryStatus(activityLog, id, deliveryStatus))
}

const persistActivity = async (entry: ActivityEntry, userId: string, generation: number) => {
  if (!isCurrentOwner(userId, generation)) return
  if (!isSupabaseConfigured || !supabase) {
    setDeliveryStatus(entry.id, 'failed', userId, generation)
    return
  }

  const client = supabase
  try {
    const insert = createActivityInsert(
      entry.id,
      entry.action,
      entry.detail,
      userId,
      new Date(entry.timestamp),
    )
    let { data, error } = await client
      .from('activity_log')
      .insert(insert)
      .select('id, action, detail, timestamp')
      .single()
    let collisionMismatch = false

    // A retry reuses the client-generated primary key. If the original insert
    // reached Supabase but its response was lost, recover that canonical row
    // instead of creating a duplicate activity.
    if (error?.code === '23505') {
      const existing = await client
        .from('activity_log')
        .select('id, action, detail, timestamp')
        .eq('id', entry.id)
        .maybeSingle()
      if (existing.data && isSameCanonicalActivity(existing.data as CanonicalActivityEntry, entry)) {
        data = existing.data
        error = existing.error
      } else {
        data = null
        error = existing.error
        collisionMismatch = true
      }
    }

    if (!isCurrentOwner(userId, generation)) return
    if (error || collisionMismatch || !data) {
      console.error(
        'Failed to persist activity:',
        error || (collisionMismatch ? new Error('Activity ID collision detected; the existing event did not match the retry.') : null),
      )
      setDeliveryStatus(entry.id, 'failed', userId, generation)
      return
    }

    const canonical = { ...(data as CanonicalActivityEntry), deliveryStatus: 'saved' as const }
    replaceActivityLog(activityLog.map(item => item.id === entry.id ? canonical : item))
  } catch (error) {
    console.error('Failed to persist activity:', error)
    setDeliveryStatus(entry.id, 'failed', userId, generation)
  }
}

export async function logActivity(action: string, detail: string): Promise<ActivityEntry | null> {
  if (!activityUserId) return null
  const userId = activityUserId
  const generation = activityGeneration
  const occurredAt = new Date()
  const entry = createPendingActivity(
    createActivityId(),
    action,
    detail,
    occurredAt,
  )
  replaceActivityLog([entry, ...activityLog])
  await persistActivity(entry, userId, generation)
  if (!isCurrentOwner(userId, generation)) return null
  return activityLog.find(item => item.id === entry.id) || null
}

export function retryActivity(id: number) {
  const entry = activityLog.find(item => item.id === id && item.deliveryStatus === 'failed')
  if (!entry || !activityUserId) return
  const userId = activityUserId
  const generation = activityGeneration
  setDeliveryStatus(id, 'pending', userId, generation)
  void persistActivity({ ...entry, deliveryStatus: 'pending' }, userId, generation)
}

export function getActivityLog(): ActivityEntry[] {
  return [...activityLog]
}

export function setActivityUser(userId: string | null) {
  if (activityUserId === userId) return
  activityUserId = userId
  activityGeneration += 1
  replaceActivityLog(userId ? readPendingActivities(userId) : [])
}

export function clearActivityLog() {
  setActivityUser(null)
}

export async function loadActivityLog(): Promise<ActivityEntry[]> {
  if (!activityUserId || !isSupabaseConfigured || !supabase) return getActivityLog()
  const userId = activityUserId
  const generation = activityGeneration
  const revisionAtRequestStart = activityRevision
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, detail, timestamp')
    .order('created_at', { ascending: false })
    .limit(MAX_ACTIVITIES)
  if (error) {
    console.error('Failed to load activity:', error)
    return getActivityLog()
  }
  if (!isCurrentOwner(userId, generation)) return getActivityLog()
  replaceActivityLog(mergeActivityEntries(
    activityLog,
    (data || []) as CanonicalActivityEntry[],
    activityRevision !== revisionAtRequestStart,
  ))
  return getActivityLog()
}
