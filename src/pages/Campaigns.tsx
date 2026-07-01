import { useState } from 'react'

interface Campaign {
  id: number
  name: string
  dept: string
  status: string
  due: string
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem('exodia-campaigns')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'HR Recruitment Drive', dept: 'HR', status: 'Ongoing', due: 'Jul 15' },
      { id: 2, name: 'Q3 Product Launch', dept: 'Product', status: 'Pending', due: 'Aug 01' },
      { id: 3, name: 'Brand Awareness Campaign', dept: 'Marketing', status: 'Pending', due: 'Jul 30' },
      { id: 4, name: 'Holiday Promo Q4', dept: 'Sales', status: 'Done', due: 'Jun 28' },
      { id: 5, name: 'Social Media Blitz', dept: 'Marketing', status: 'Ongoing', due: 'Jul 20' },
    ]
  })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', dept: '', status: 'Pending', due: '' })

  const addCampaign = () => {
    if (!form.name.trim()) return
    const id = campaigns.length > 0 ? Math.max(...campaigns.map(c => c.id)) + 1 : 1
    const updated = [...campaigns, { ...form, id }]
    setCampaigns(updated)
    localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
    setShowAdd(false)
    setForm({ name: '', dept: '', status: 'Pending', due: '' })
  }

  const editCampaign = (camp: Campaign) => {
    setForm({ name: camp.name, dept: camp.dept, status: camp.status, due: camp.due })
    setEditId(camp.id)
  }

  const saveEdit = () => {
    if (!form.name.trim() || editId === null) return
    const updated = campaigns.map(c => c.id === editId ? { ...c, ...form } : c)
    setCampaigns(updated)
    localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
    setEditId(null)
    setForm({ name: '', dept: '', status: 'Pending', due: '' })
  }

  const deleteCampaign = (id: number) => {
    const updated = campaigns.filter(c => c.id !== id)
    setCampaigns(updated)
    localStorage.setItem('exodia-campaigns', JSON.stringify(updated))
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
      {/* Header */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--accent-light)' }}>
            <svg className="w-7 h-7" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Campaigns</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Track, manage, and monitor all marketing campaigns
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12 sm:pb-20 -mt-4 sm:-mt-6">
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
                    <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{campaigns.length} total campaigns</p>
                  </div>
                </div>
                <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Campaign
                </button>
              </div>
              {/* Full-width status bars */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Pending</span>
                    <span className="text-lg font-bold" style={{ color: '#1B1A1C' }}>{statusCounts.pending}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#FFF7ED' }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${campaigns.length > 0 ? (statusCounts.pending / campaigns.length) * 100 : 0}%`, backgroundColor: '#EA580C' }}></div>
                  </div>
                </div>
                <div className="flex-1 p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Ongoing</span>
                    <span className="text-lg font-bold" style={{ color: '#3E4048' }}>{statusCounts.ongoing}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#EBF5FF' }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${campaigns.length > 0 ? (statusCounts.ongoing / campaigns.length) * 100 : 0}%`, backgroundColor: '#2563EB' }}></div>
                  </div>
                </div>
                <div className="flex-1 p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Done (This Month)</span>
                    <span className="text-lg font-bold" style={{ color: '#FF5900' }}>{statusCounts.done}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#F0FDF4' }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${campaigns.length > 0 ? (statusCounts.done / campaigns.length) * 100 : 0}%`, backgroundColor: '#16A34A' }}></div>
                  </div>
                </div>
              </div>
              {/* All campaigns list */}
              <div className="space-y-2">
                {campaigns.map((camp) => {
                  const sc = statusColors[camp.status] || { bg: 'var(--accent-light)', text: 'var(--accent)' }
                  return (
                    <div key={camp.id} className="group flex items-center gap-3 p-3.5 rounded-xl theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.text }}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{camp.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{camp.dept} &middot; Due: {camp.due}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.text }}>{camp.status}</span>
                      <button onClick={() => editCampaign(camp)} className="p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100" style={{ color: '#9CA3AF' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
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
      </section>

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
              <input type="text" placeholder="Due Date (e.g. Aug 01)" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
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
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }} onClick={() => { setEditId(null); setForm({ name: '', dept: '', status: 'Pending', due: '' }) }} />
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
              <input type="text" placeholder="Due Date (e.g. Aug 01)" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setEditId(null); setForm({ name: '', dept: '', status: 'Pending', due: '' }) }} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}