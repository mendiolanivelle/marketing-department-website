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

interface OwnedCanonicalActivityEntry extends CanonicalActivityEntry {
  user_id: string
}

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

const purgePendingActivitiesExcept = (userId: string | null) => {
  if (typeof window === 'undefined') return
  try {
    const preservedKey = userId ? `${PENDING_STORAGE_PREFIX}${userId}` : null
    const keysToRemove: string[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(PENDING_STORAGE_PREFIX) && key !== preservedKey) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key))
  } catch {
    // Owner changes still clear the in-memory feed when storage is unavailable.
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
      .select('id, action, detail, timestamp, user_id')
      .single()
    let collisionMismatch = false

    // A retry reuses the client-generated primary key. If the original insert
    // reached Supabase but its response was lost, recover that canonical row
    // instead of creating a duplicate activity.
    if (error?.code === '23505') {
      const existing = await client
        .from('activity_log')
        .select('id, action, detail, timestamp, user_id')
        .eq('id', entry.id)
        .eq('user_id', userId)
        .maybeSingle()
      if (
        existing.data
        && existing.data.user_id === userId
        && isSameCanonicalActivity(existing.data as OwnedCanonicalActivityEntry, entry)
      ) {
        data = existing.data
        error = existing.error
      } else {
        data = null
        error = existing.error
        collisionMismatch = true
      }
    }

    if (!isCurrentOwner(userId, generation)) return
    const ownerMismatch = Boolean(data && data.user_id !== userId)
    if (error || collisionMismatch || !data || ownerMismatch) {
      console.error(
        'Failed to persist activity:',
        error
          || (collisionMismatch ? new Error('Activity ID collision detected; the existing event did not match the retry.') : null)
          || (ownerMismatch ? new Error('Activity response owner did not match the current user.') : null),
      )
      setDeliveryStatus(entry.id, 'failed', userId, generation)
      return
    }

    const saved = data as OwnedCanonicalActivityEntry
    const canonical = {
      id: saved.id,
      action: saved.action,
      detail: saved.detail,
      timestamp: saved.timestamp,
      deliveryStatus: 'saved' as const,
    }
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

export async function retryActivity(id: number): Promise<ActivityEntry | null> {
  const entry = activityLog.find(item => item.id === id && item.deliveryStatus === 'failed')
  if (!entry || !activityUserId) return null
  const userId = activityUserId
  const generation = activityGeneration
  setDeliveryStatus(id, 'pending', userId, generation)
  await persistActivity({ ...entry, deliveryStatus: 'pending' }, userId, generation)
  if (!isCurrentOwner(userId, generation)) return null
  return activityLog.find(item => item.id === id) || null
}

export function getActivityLog(): ActivityEntry[] {
  return [...activityLog]
}

export function setActivityUser(userId: string | null) {
  purgePendingActivitiesExcept(userId)
  if (activityUserId === userId) return
  activityUserId = userId
  activityGeneration += 1
  replaceActivityLog(userId ? readPendingActivities(userId) : [])
}

export async function loadActivityLog(): Promise<ActivityEntry[]> {
  if (!activityUserId || !isSupabaseConfigured || !supabase) return getActivityLog()
  const userId = activityUserId
  const generation = activityGeneration
  const revisionAtRequestStart = activityRevision
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, detail, timestamp, user_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_ACTIVITIES)
  if (error) {
    console.error('Failed to load activity:', error)
    return getActivityLog()
  }
  if (!isCurrentOwner(userId, generation)) return getActivityLog()
  const ownedEntries = (data || []) as OwnedCanonicalActivityEntry[]
  if (ownedEntries.some(entry => entry.user_id !== userId)) {
    console.error('Failed to load activity: response owner did not match the current user.')
    return getActivityLog()
  }
  replaceActivityLog(mergeActivityEntries(
    activityLog,
    ownedEntries.map(({ id, action, detail, timestamp }) => ({ id, action, detail, timestamp })),
    activityRevision !== revisionAtRequestStart,
  ))
  return getActivityLog()
}
