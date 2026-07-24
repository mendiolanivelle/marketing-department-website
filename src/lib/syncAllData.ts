import { supabase, isSupabaseConfigured } from './supabase'

const LOCAL_KEYS = [
  { key: 'exodia-file-tracker-assets', table: 'file_tracker_assets' },
  { key: 'exodia-calendar-items', table: 'calendar_items' },
  { key: 'exodia-campaigns', table: 'campaigns' },
]

export async function syncAllLocalData() {
  if (!isSupabaseConfigured || !supabase) return
  try {
    const token = (await supabase.auth.getSession())?.data?.session?.access_token
    if (!token) return
    const payload: Record<string, any[]> = {}
    for (const { key, table } of LOCAL_KEYS) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const data = JSON.parse(raw)
        if (Array.isArray(data) && data.length > 0) {
          payload[table] = data
        }
      } catch {}
    }
    if (Object.keys(payload).length === 0) return
    await fetch('/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
  } catch {}
}