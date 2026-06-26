const STORAGE_KEY = 'exodia-activity-log'
const MAX_ACTIVITIES = 100

export interface ActivityEntry {
  id: number
  action: string
  detail: string
  timestamp: string
}

export function logActivity(action: string, detail: string) {
  const entry: ActivityEntry = {
    id: Date.now(),
    action,
    detail,
    timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const log: ActivityEntry[] = raw ? JSON.parse(raw) : []
    log.unshift(entry)
    if (log.length > MAX_ACTIVITIES) log.length = MAX_ACTIVITIES
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch {}
}

export function getActivityLog(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}