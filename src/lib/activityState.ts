export type ActivityDeliveryStatus = 'pending' | 'saved' | 'failed'

export interface ActivityStateEntry {
  id: number
  action: string
  detail: string
  timestamp: string
  deliveryStatus: ActivityDeliveryStatus
}

export interface CanonicalActivityEntry {
  id: number
  action: string
  detail: string
  timestamp: string
}

const MAX_ACTIVITIES = 100
const COLLAPSED_ACTIVITIES = 8

export function createPendingActivity(
  id: number,
  action: string,
  detail: string,
  occurredAt = new Date(),
): ActivityStateEntry {
  return {
    id,
    action,
    detail,
    timestamp: occurredAt.toISOString(),
    deliveryStatus: 'pending',
  }
}

export function setActivityDeliveryStatus(
  entries: ActivityStateEntry[],
  id: number,
  deliveryStatus: ActivityDeliveryStatus,
): ActivityStateEntry[] {
  return entries.map(entry => entry.id === id ? { ...entry, deliveryStatus } : entry)
}

export function mergeActivityEntries(
  currentEntries: ActivityStateEntry[],
  remoteEntries: CanonicalActivityEntry[],
  preserveSavedEntries = false,
): ActivityStateEntry[] {
  const remoteIds = new Set(remoteEntries.map(entry => entry.id))
  const localEntries = currentEntries.filter(entry => (
    !remoteIds.has(entry.id)
    && (entry.deliveryStatus !== 'saved' || preserveSavedEntries)
  ))
  const savedEntries = remoteEntries.map(entry => ({
    ...entry,
    deliveryStatus: 'saved' as const,
  }))

  return [...localEntries, ...savedEntries].slice(0, MAX_ACTIVITIES)
}

export function visibleActivityEntries(
  entries: ActivityStateEntry[],
  expanded: boolean,
): ActivityStateEntry[] {
  return entries.slice(0, expanded ? MAX_ACTIVITIES : COLLAPSED_ACTIVITIES)
}
