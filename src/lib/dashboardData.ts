export interface DashboardTask {
  id: number
  text: string
  done: boolean
}

export interface DashboardTaskInsert {
  text: string
  done: boolean
}

const taskKey = (task: DashboardTaskInsert) => `${task.text.trim()}\u0000${task.done ? '1' : '0'}`

export function selectUnsyncedBrowserTasks(
  canonicalTasks: DashboardTask[],
  browserTasks: unknown[],
): DashboardTaskInsert[] {
  const known = new Set(canonicalTasks.map(taskKey))
  const pending: DashboardTaskInsert[] = []

  for (const candidate of browserTasks) {
    if (!candidate || typeof candidate !== 'object') continue
    const { text, done } = candidate as { text?: unknown; done?: unknown }
    if (typeof text !== 'string' || !text.trim()) continue
    const task = { text: text.trim(), done: done === true }
    const key = taskKey(task)
    if (known.has(key)) continue
    known.add(key)
    pending.push(task)
  }

  return pending
}

export function createActivityInsert(
  action: string,
  detail: string,
  userId: string,
  occurredAt = new Date(),
) {
  return {
    action,
    detail,
    timestamp: occurredAt.toISOString(),
    user_id: userId,
  }
}
