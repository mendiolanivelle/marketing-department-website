import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function displayDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${MONTH_NAMES[parseInt(m)-1] || ''} ${parseInt(d)}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseCampaignDate(due: string): string {
  if (due.includes('-')) return due
  const parts = due.split(' ')
  if (parts.length === 2 && MONTH_MAP[parts[0]]) {
    const year = new Date().getFullYear()
    return `${year}-${MONTH_MAP[parts[0]]}-${String(parseInt(parts[1])).padStart(2, '0')}`
  }
  return todayISO()
}

function addToCalendar(campaign: Campaign) {
  const key = 'exodia-calendar-items'
  const saved = localStorage.getItem(key)
  const items = saved ? JSON.parse(saved) : []
  const newItem = {
    id: crypto.randomUUID(),
    title: campaign.name,
    type: 'task',
    date: parseCampaignDate(campaign.due),
    start_time: null,
    end_time: null,
    description: `Campaign for ${campaign.dept}`,
    location: null,
    color: '#1a73e8',
    assignees: [],
    notes: `Status: ${campaign.status}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  items.push(newItem)
  localStorage.setItem(key, JSON.stringify(items))
  if (isSupabaseConfigured && supabase) {
    supabase.from('calendar_items').insert([newItem]).maybeSingle()
  }
  window.dispatchEvent(new CustomEvent('calendar-updated'))
}

function removeFromCalendar(campaignName: string) {
  const key = 'exodia-calendar-items'
  const saved = localStorage.getItem(key)
  if (!saved) return
  const items = JSON.parse(saved)
  const removed = items.find((i: any) => i.title === campaignName)
  const filtered = items.filter((i: any) => i.title !== campaignName)
  localStorage.setItem(key, JSON.stringify(filtered))
  if (removed && isSupabaseConfigured && supabase) {
    supabase.from('calendar_items').delete().eq('id', removed.id).maybeSingle()
  }
  window.dispatchEvent(new CustomEvent('calendar-updated'))
}

function updateInCalendar(oldName: string, campaign: Campaign) {
  const key = 'exodia-calendar-items'
  const saved = localStorage.getItem(key)
  if (!saved) return
  let matchedItem: any = null
  const items = JSON.parse(saved).map((i: any) => {
    if (i.title === oldName || i.title === campaign.name) {
      matchedItem = i
      return { ...i, title: campaign.name, date: parseCampaignDate(campaign.due), description: `Campaign for ${campaign.dept}`, notes: `Status: ${campaign.status}`, updated_at: new Date().toISOString() }
    }
    return i
  })
  localStorage.setItem(key, JSON.stringify(items))
  if (matchedItem && isSupabaseConfigured && supabase) {
    supabase.from('calendar_items').update({ title: campaign.name, date: parseCampaignDate(campaign.due), description: `Campaign for ${campaign.dept}`, notes: `Status: ${campaign.status}`, updated_at: new Date().toISOString() }).eq('id', matchedItem.id).maybeSingle()
  }
  window.dispatchEvent(new CustomEvent('calendar-updated'))
}

interface Campaign {
  id: number
  name: string
  dept: string
  status: string
  due: string
  requesterName?: string
  requesterEmail?: string
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem('exodia-campaigns')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'HR Recruitment Drive', dept: 'HR', status: 'Ongoing', due: displayDate('2026-07-15') },
      { id: 2, name: 'Q3 Product Launch', dept: 'Product', status: 'Pending', due: displayDate('2026-08-01') },
      { id: 3, name: 'Brand Awareness Campaign', dept: 'Marketing', status: 'Pending', due: displayDate('2026-07-30') },
      { id: 4, name: 'Holiday Promo Q4', dept: 'Sales', status: 'Done', due: displayDate('2026-06-28') },
      { id: 5, name: 'Social Media Blitz', dept: 'Marketing', status: 'Ongoing', due: displayDate('2026-07-20') },
    ]
  })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editOldName, setEditOldName] = useState('')
  const [notifyId, setNotifyId] = useState<number | null>(null)
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null)
  const [showNotifyConfirm, setShowNotifyConfirm] = useState(false)
  const [notifyLinks, setNotifyLinks] = useState<string[]>([])
  const [notifyLinkInput, setNotifyLinkInput] = useState('')
  const [form, setForm] = useState({ name: '', dept: '', status: 'Pending', due: todayISO() })
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const displayedCampaigns = filterStatus ? campaigns.filter(c => c.status === filterStatus) : campaigns
  const [note, setNote] = useState('')

  useEffect(() => {
    const refresh = () => {
      const saved = localStorage.getItem('exodia-campaigns')
      if (saved) setCampaigns(JSON.parse(saved))
    }
    window.addEventListener('calendar-updated', refresh)
    window.addEventListener('marketing-request-updated', refresh)
    return () => {
      window.removeEventListener('calendar-updated', refresh)
      window.removeEventListener('marketing-request-updated', refresh)
    }
  }, [])

  const showNote = (msg: string) => {
    setNote(msg)
    setTimeout(() => setNote(''), 3000)
  }

  const addCampaign = () => {
    if (!form.name.trim()) return
    const id = campaigns.length > 0 ? Math.max(...campaigns.map(c => c.id)) + 1 : 1
    const campaign = { ...form, id }
    const updated = [...campaigns, campaign]
    setCampaigns(updated)
    localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
    addToCalendar(campaign)
    showNote(`Campaign "${campaign.name}" created — added to Calendar`)
    setShowAdd(false)
    setForm({ name: '', dept: '', status: 'Pending', due: todayISO() })
  }

  const editCampaign = (camp: Campaign) => {
    setForm({ name: camp.name, dept: camp.dept, status: camp.status, due: parseCampaignDate(camp.due) })
    setEditId(camp.id)
    setEditOldName(camp.name)
  }

  const saveEdit = () => {
    if (!form.name.trim() || editId === null) return
    const updated = campaigns.map(c => c.id === editId ? { ...c, ...form } : c)
    setCampaigns(updated)
    localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
    updateInCalendar(editOldName, { ...form, id: editId } as Campaign)
    showNote(`Campaign "${form.name}" updated — Calendar synced`)
    setEditId(null)
    setEditOldName('')
    setForm({ name: '', dept: '', status: 'Pending', due: todayISO() })
  }

  const deleteCampaign = (id: number) => {
    const camp = campaigns.find(c => c.id === id)
    const updated = campaigns.filter(c => c.id !== id)
    setCampaigns(updated)
    localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
    if (camp) { removeFromCalendar(camp.name); showNote(`Campaign "${camp.name}" removed from Calendar`) }
  }

  const statusCounts = {
    pending: campaigns.filter(c => c.status === 'Pending').length,
    ongoing: campaigns.filter(c => c.status === 'Ongoing').length,
    done: campaigns.filter(c => c.status === 'Done').length,
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    Pending: { bg: '#FFF7ED', text: '#EA580C' },
    Ongoing: { bg: '#EBF5FF', text: '#2563EB' },
    Done: { bg: '#F0FDF4', text: '#16A34A' },
  }

  return (
    <div>
      {note && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all" style={{ backgroundColor: '#1B1A1C', color: '#FFFFFF' }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {note}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF5900)' }}></div>
          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Campaigns</h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Track, manage, and monitor all marketing campaigns</p>
                </div>
              </div>
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5" style={{ backgroundColor: 'var(--accent)', boxShadow: '0 4px 12px rgba(255,89,0,0.25)', color: '#FFFFFF' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Campaign
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto">
          {/* Campaign Overview - different design from dashboard */}
          <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF5900)' }}></div>
            <div className="p-5 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Campaign Overview</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{displayedCampaigns.length} campaign{displayedCampaigns.length !== 1 ? 's' : ''}{filterStatus ? ` (${filterStatus})` : ''}</p>
                  </div>
                </div>
              </div>
              {/* Full-width status bars */}
              <div className="flex gap-3 mb-6">
                {[
                  { label: 'Total', key: null, count: campaigns.length, color: '#FF5900', bg: '#FFF0E6', barColor: '#FF5900' },
                  { label: 'Pending', key: 'Pending', count: statusCounts.pending, color: '#EA580C', bg: '#FFF7ED', barColor: '#EA580C' },
                  { label: 'Ongoing', key: 'Ongoing', count: statusCounts.ongoing, color: '#2563EB', bg: '#EBF5FF', barColor: '#2563EB' },
                  { label: 'Done', key: 'Done', count: statusCounts.done, color: '#16A34A', bg: '#F0FDF4', barColor: '#16A34A' },
                ].map((stat) => {
                  const isActive = stat.key === null ? filterStatus === null : filterStatus === stat.key
                  return (
                    <button
                      key={stat.label}
                      onClick={() => setFilterStatus(stat.key === null ? null : filterStatus === stat.key ? null : stat.key)}
                      className="flex-1 p-4 rounded-xl border text-left transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        backgroundColor: isActive ? stat.bg : 'var(--bg-secondary)',
                        borderColor: isActive ? stat.color : 'var(--border-secondary)',
                        boxShadow: isActive ? `0 0 0 1.5px ${stat.color}` : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.label}</span>
                        <span className="text-lg font-bold" style={{ color: stat.color }}>{stat.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: stat.bg }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${campaigns.length > 0 ? (stat.count / campaigns.length) * 100 : 0}%`, backgroundColor: stat.barColor }}></div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {/* All campaigns list */}
              <div className="space-y-2">
                {[...displayedCampaigns].reverse().map((camp) => {
                  const sc = statusColors[camp.status] || { bg: 'var(--accent-light)', text: 'var(--accent)' }
                  return (
                    <div key={camp.id} className="group flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition hover:opacity-80 theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }} onClick={() => setViewingCampaign(camp)}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.text }}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{camp.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{camp.dept} &middot; Due: {displayDate(camp.due)}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.text }}>{camp.status}</span>
                      <button onClick={() => deleteCampaign(camp.id)} className="p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100" style={{ color: 'var(--accent)' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Campaign Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }} onClick={() => setShowAdd(false)} />
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>New Campaign</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Campaign Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Requesting Dept (e.g. HR)" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }}>
                <option value="Pending">Pending</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Done">Done</option>
              </select>
              <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addCampaign} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {editId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }} onClick={() => { setEditId(null); setForm({ name: '', dept: '', status: 'Pending', due: todayISO() }) }} />
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Campaign</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Campaign Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Requesting Dept (e.g. HR)" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }}>
                <option value="Pending">Pending</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Done">Done</option>
              </select>
              <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setEditId(null); setForm({ name: '', dept: '', status: 'Pending', due: todayISO() }) }} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF-style Campaign Document Modal */}
      {viewingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setViewingCampaign(null)}>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none shadow-2xl" style={{ backgroundColor: '#FFFFFF' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-8 py-4 border-b" style={{ backgroundColor: '#1B1A1C', borderColor: '#2D2B2E' }}>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Campaign Document</span>
              </div>
              <button onClick={() => setViewingCampaign(null)} className="p-1.5 rounded-lg transition hover:opacity-70" style={{ color: '#9CA3AF' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-10 py-8">
              <div className="text-center mb-8 pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B1A1C' }}>{viewingCampaign.name}</h2>
                <select
                  value={viewingCampaign.status}
                  onChange={(e) => {
                    const newStatus = e.target.value
                    const updated = campaigns.map(c => c.id === viewingCampaign.id ? { ...c, status: newStatus } : c)
                    setCampaigns(updated)
                    localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
                    updateInCalendar(viewingCampaign.name, { ...viewingCampaign, status: newStatus })
                    setViewingCampaign({ ...viewingCampaign, status: newStatus })
                  }}
                  className="text-sm px-3 py-1 rounded-full font-medium outline-none cursor-pointer border-0"
                  style={{ backgroundColor: statusColors[viewingCampaign.status]?.bg || '#F3F4F6', color: statusColors[viewingCampaign.status]?.text || '#6B7280' }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Department</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingCampaign.dept}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Due Date</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{displayDate(viewingCampaign.due)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Requester</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingCampaign.requesterName || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Requester Email</p>
                  <p className="text-sm" style={{ color: '#FF5900' }}>{viewingCampaign.requesterEmail || '—'}</p>
                </div>
              </div>

              <div className="pt-6 border-t text-center" style={{ borderColor: '#E5E7EB' }}>
                <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Exodia Game Development &middot; Marketing Department</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-8 py-4 border-t" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
              <button onClick={() => setViewingCampaign(null)} className="px-4 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: '#1B1A1C', color: '#FFFFFF' }}>
                Close
              </button>
              {viewingCampaign.status === 'Done' && viewingCampaign.requesterEmail && (
                <button
                  onClick={() => {
                    setForm({ name: viewingCampaign.name, dept: viewingCampaign.dept, status: 'Done', due: parseCampaignDate(viewingCampaign.due) })
                    setNotifyId(viewingCampaign.id)
                    setNotifyLinks([])
                    setNotifyLinkInput('')
                    setShowNotifyConfirm(true)
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition hover:opacity-80"
                  style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Complete & Notify
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Preview & Send Modal */}
      {showNotifyConfirm && notifyId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { setShowNotifyConfirm(false); setNotifyId(null) }}>
          <div className="relative w-full max-w-lg rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Email Preview</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>This notification will be sent to the requester.</p>
            {(() => {
              const camp = campaigns.find(c => c.id === notifyId)
              return (
                <div className="space-y-3">
                  <div className="rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: '#F3F4F6' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FF5900' }}>
                        <span className="text-[10px] text-white font-bold">M</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#1B1A1C' }}>Marketing Department</p>
                        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>to {camp?.requesterEmail || '—'}</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium mb-2" style={{ color: '#1B1A1C' }}>Subject: Campaign Completed — {form.name}</p>
                    <div className="text-xs leading-relaxed" style={{ color: '#4B5563', lineHeight: 1.6 }}>
                      <p>Hi {camp?.requesterName || 'there'},</p>
                      <p className="mt-2">Your marketing request for <strong>"{form.name}"</strong> has been completed by the Marketing Department.</p>
                      {notifyLinks.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium mb-1" style={{ color: '#1B1A1C' }}>Attached Resources:</p>
                          {notifyLinks.map((link, i) => (
                            <p key={i} className="text-xs" style={{ color: '#FF5900' }}>{link}</p>
                          ))}
                        </div>
                      )}
                      <p className="mt-2">Thank you for your request.</p>
                      <p className="mt-4" style={{ color: '#9CA3AF' }}>Exodia Game Development &middot; Marketing Department</p>
                    </div>
                  </div>
                  {/* Attach links */}
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Attach Resource Links</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={notifyLinkInput}
                        onChange={(e) => setNotifyLinkInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && notifyLinkInput.trim()) { setNotifyLinks(prev => [...prev, notifyLinkInput.trim()]); setNotifyLinkInput('') } }}
                        placeholder="Paste a link..."
                        className="flex-1 px-3 py-2 border rounded-lg text-xs outline-none"
                        style={{ borderColor: 'var(--border-primary)' }}
                      />
                      <button
                        onClick={() => { if (notifyLinkInput.trim()) { setNotifyLinks(prev => [...prev, notifyLinkInput.trim()]); setNotifyLinkInput('') } }}
                        className="px-3 py-2 rounded-lg text-xs font-medium transition hover:opacity-80"
                        style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                      >
                        Add
                      </button>
                    </div>
                    {notifyLinks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {notifyLinks.map((link, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <span className="text-xs truncate flex-1" style={{ color: 'var(--accent)' }}>{link}</span>
                            <button onClick={() => setNotifyLinks(prev => prev.filter((_, j) => j !== i))} className="p-0.5 rounded transition hover:opacity-70" style={{ color: '#DC2626' }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => { setShowNotifyConfirm(false); setNotifyId(null) }} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                    <button
                      onClick={async () => {
                        const camp = campaigns.find(c => c.id === notifyId)
                        if (!camp) return
                        const updated = campaigns.map(c => c.id === notifyId ? { ...c, ...form, status: 'Done' } : c)
                        setCampaigns(updated)
                        localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
                        updateInCalendar(camp.name, { ...camp, ...form, status: 'Done', id: notifyId })
                        if (isSupabaseConfigured && supabase && camp.requesterEmail) {
                          try {
                            await supabase.functions.invoke('send-edit-link', {
                              body: { to: camp.requesterEmail, name: camp.requesterName || camp.dept, title: form.name, editLink: window.location.origin + '/#/requests', links: notifyLinks },
                            })
                            showNote(`"${form.name}" completed — notified ${camp.requesterEmail}`)
                          } catch { showNote(`"${form.name}" completed — notification failed`) }
                        }
                        setShowNotifyConfirm(false)
                        setNotifyId(null)
                        setViewingCampaign(null)
                      }}
                      className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-1.5"
                      style={{ backgroundColor: '#16A34A', fontWeight: 500 }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Send to Requester
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}