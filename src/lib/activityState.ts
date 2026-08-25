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

export function createActivityId(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const words = new Uint32Array(2)
    globalThis.crypto.getRandomValues(words)
    const id = (words[0] & 0x1fffff) * 0x100000000 + words[1]
    return id || 1
  }

  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) || 1
}

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

export function isSameCanonicalActivity(
  canonical: CanonicalActivityEntry,
  pending: ActivityStateEntry,
): boolean {
  return canonical.id === pending.id
    && canonical.action === pending.action
    && canonical.detail === pending.detail
    && canonical.timestamp === pending.timestamp
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

  return [...localEntries, ...savedEntries]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, MAX_ACTIVITIES)
}

export function visibleActivityEntries(
  entries: ActivityStateEntry[],
  expanded: boolean,
): ActivityStateEntry[] {
  return entries.slice(0, expanded ? MAX_ACTIVITIES : COLLAPSED_ACTIVITIES)
}
