const MAX_ACTIVITIES = 100

export interface ActivityEntry {
  id: number
  action: string
  detail: string
  timestamp: string
}

// Session-memory only until a user-scoped canonical audit log exists.
const activityLog: ActivityEntry[] = []

export function logActivity(action: string, detail: string) {
  const entry: ActivityEntry = {
    id: Date.now(),
    action,
    detail,
    timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }
  activityLog.unshift(entry)
  if (activityLog.length > MAX_ACTIVITIES) activityLog.length = MAX_ACTIVITIES
}

export function getActivityLog(): ActivityEntry[] {
  return [...activityLog]
}
