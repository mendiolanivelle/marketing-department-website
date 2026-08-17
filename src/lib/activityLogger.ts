import { createActivityInsert } from './dashboardData'
import { isSupabaseConfigured, supabase } from './supabase'

const MAX_ACTIVITIES = 100

export interface ActivityEntry {
  id: number
  action: string
  detail: string
  timestamp: string
}

const activityLog: ActivityEntry[] = []

const notifyActivityChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('activity-updated'))
}

export function logActivity(action: string, detail: string) {
  const occurredAt = new Date()
  const entry: ActivityEntry = {
    id: occurredAt.getTime() * 1000 + Math.floor(Math.random() * 1000),
    action,
    detail,
    timestamp: occurredAt.toISOString(),
  }
  activityLog.unshift(entry)
  if (activityLog.length > MAX_ACTIVITIES) activityLog.length = MAX_ACTIVITIES
  notifyActivityChanged()

  if (!isSupabaseConfigured || !supabase) return
  const client = supabase
  void (async () => {
    const { data: { session } } = await client.auth.getSession()
    if (!session?.user?.id) return
    const { data, error } = await client
      .from('activity_log')
      .insert(createActivityInsert(action, detail, session.user.id, occurredAt))
      .select('id, action, detail, timestamp')
      .single()
    if (error) {
      console.error('Failed to persist activity:', error)
      return
    }
    const optimisticIndex = activityLog.findIndex(item => item === entry)
    if (optimisticIndex >= 0 && data) {
      activityLog[optimisticIndex] = data as ActivityEntry
    } else if (data && !activityLog.some(item => item.id === data.id)) {
      activityLog.unshift(data as ActivityEntry)
      if (activityLog.length > MAX_ACTIVITIES) activityLog.length = MAX_ACTIVITIES
    }
    notifyActivityChanged()
  })()
}

export function getActivityLog(): ActivityEntry[] {
  return [...activityLog]
}

export async function loadActivityLog(): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured || !supabase) return getActivityLog()
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, detail, timestamp')
    .order('created_at', { ascending: false })
    .limit(MAX_ACTIVITIES)
  if (error) {
    console.error('Failed to load activity:', error)
    return getActivityLog()
  }
  activityLog.splice(0, activityLog.length, ...((data || []) as ActivityEntry[]))
  return getActivityLog()
}
