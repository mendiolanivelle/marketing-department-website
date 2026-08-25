import { createActivityInsert } from './dashboardData'
import {
  createPendingActivity,
  mergeActivityEntries,
  setActivityDeliveryStatus,
} from './activityState'
import type { ActivityStateEntry, CanonicalActivityEntry } from './activityState'
import { isSupabaseConfigured, supabase } from './supabase'

const MAX_ACTIVITIES = 100

export type ActivityEntry = ActivityStateEntry

const activityLog: ActivityEntry[] = []
let activityRevision = 0
let activityUserId: string | null = null

const notifyActivityChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('activity-updated'))
}

const replaceActivityLog = (entries: ActivityEntry[]) => {
  activityLog.splice(0, activityLog.length, ...entries.slice(0, MAX_ACTIVITIES))
  activityRevision += 1
  notifyActivityChanged()
}

const setDeliveryStatus = (id: number, deliveryStatus: ActivityEntry['deliveryStatus']) => {
  replaceActivityLog(setActivityDeliveryStatus(activityLog, id, deliveryStatus))
}

const persistActivity = async (entry: ActivityEntry) => {
  if (!isSupabaseConfigured || !supabase) {
    setDeliveryStatus(entry.id, 'saved')
    return
  }

  const client = supabase
  try {
    const { data: { session }, error: sessionError } = await client.auth.getSession()
    if (sessionError || !session?.user?.id) {
      setDeliveryStatus(entry.id, 'failed')
      return
    }
    if (activityUserId && activityUserId !== session.user.id) {
      replaceActivityLog([entry])
    }
    activityUserId = session.user.id

    const insert = createActivityInsert(
      entry.id,
      entry.action,
      entry.detail,
      session.user.id,
      new Date(entry.timestamp),
    )
    let { data, error } = await client
      .from('activity_log')
      .insert(insert)
      .select('id, action, detail, timestamp')
      .single()

    // A retry reuses the client-generated primary key. If the original insert
    // reached Supabase but its response was lost, recover that canonical row
    // instead of creating a duplicate activity.
    if (error?.code === '23505') {
      const existing = await client
        .from('activity_log')
        .select('id, action, detail, timestamp')
        .eq('id', entry.id)
        .maybeSingle()
      data = existing.data
      error = existing.error
    }

    if (error || !data) {
      console.error('Failed to persist activity:', error)
      setDeliveryStatus(entry.id, 'failed')
      return
    }

    const canonical = { ...(data as CanonicalActivityEntry), deliveryStatus: 'saved' as const }
    replaceActivityLog(activityLog.map(item => item.id === entry.id ? canonical : item))
  } catch (error) {
    console.error('Failed to persist activity:', error)
    setDeliveryStatus(entry.id, 'failed')
  }
}

export async function logActivity(action: string, detail: string): Promise<ActivityEntry> {
  const occurredAt = new Date()
  const entry = createPendingActivity(
    occurredAt.getTime() * 1000 + Math.floor(Math.random() * 1000),
    action,
    detail,
    occurredAt,
  )
  replaceActivityLog([entry, ...activityLog])
  await persistActivity(entry)
  return entry
}

export function retryActivity(id: number) {
  const entry = activityLog.find(item => item.id === id && item.deliveryStatus === 'failed')
  if (!entry) return
  setDeliveryStatus(id, 'pending')
  void persistActivity({ ...entry, deliveryStatus: 'pending' })
}

export function getActivityLog(): ActivityEntry[] {
  return [...activityLog]
}

export function clearActivityLog() {
  activityUserId = null
  replaceActivityLog([])
}

export async function loadActivityLog(): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured || !supabase) return getActivityLog()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user?.id) return getActivityLog()
  if (activityUserId && activityUserId !== session.user.id) {
    replaceActivityLog([])
  }
  activityUserId = session.user.id
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
  replaceActivityLog(mergeActivityEntries(
    activityLog,
    (data || []) as CanonicalActivityEntry[],
    activityRevision !== revisionAtRequestStart,
  ))
  return getActivityLog()
}
