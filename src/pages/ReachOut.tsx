import { useState, useEffect } from 'react'

interface EmailHistoryItem {
  id: string
  subject: string
  body: string
  sentAt: string
  direction: 'sent' | 'received'
}

interface OutreachLead {
  id: number
  name: string
  email: string
  company: string
  status: 'pending' | 'sent' | 'replied' | 'follow-up'
  lastContacted: string
  notes: string
  emailHistory: EmailHistoryItem[]
}

const defaultLeads: OutreachLead[] = [
  { id: 1, name: 'John Smith', email: 'john@acme.com', company: 'Acme Corp', status: 'pending', lastContacted: '', notes: '', emailHistory: [] },
  { id: 2, name: 'Sarah Lee', email: 'sarah@techstart.io', company: 'TechStart Inc', status: 'sent', lastContacted: 'Jun 22', notes: 'Awaiting response on proposal', emailHistory: [] },
  { id: 3, name: 'Mike Chen', email: 'mike@globalmedia.com', company: 'Global Media', status: 'replied', lastContacted: 'Jun 20', notes: 'Interested, scheduling call', emailHistory: [] },
  { id: 4, name: 'Emma Davis', email: 'emma@brandify.co', company: 'Brandify', status: 'follow-up', lastContacted: 'Jun 15', notes: 'Need to follow up by end of week', emailHistory: [] },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  'pending': { label: 'Pending', color: '#3E4048' },
  'sent': { label: 'Sent', color: '#4A90D9' },
  'replied': { label: 'Replied', color: '#0B8043' },
  'follow-up': { label: 'Follow Up', color: '#FF5900' },
}

const sortLeads = (leads: OutreachLead[]) => {
  const priority: Record<string, number> = { 'follow-up': 0, 'pending': 1, 'sent': 2, 'replied': 3 }
  return [...leads].sort((a, b) => (priority[a.status] ?? 99) - (priority[b.status] ?? 99))
}

export default function ReachOut() {
  const [leads, setLeads] = useState<OutreachLead[]>(() => {
    const saved = localStorage.getItem('exodia-outreach-leads')
    return saved ? JSON.parse(saved) : defaultLeads
  })

  useEffect(() => {
    localStorage.setItem('exodia-outreach-leads', JSON.stringify(leads))
  }, [leads])

  const [showAdd, setShowAdd] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null)
  const [newLead, setNewLead] = useState({ name: '', email: '', company: '' })
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [editingLead, setEditingLead] = useState<OutreachLead | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showThread, setShowThread] = useState(false)
  const [threadLead, setThreadLead] = useState<OutreachLead | null>(null)

  const addLead = () => {
    if (!newLead.name.trim() || !newLead.email.trim()) return
    const id = leads.length > 0 ? Math.max(...leads.map(l => l.id)) + 1 : 1
    setLeads(sortLeads([...leads, { ...newLead, id, status: 'pending' as const, lastContacted: '', notes: '', emailHistory: [] }]))
    setNewLead({ name: '', email: '', company: '' })
    setShowAdd(false)
  }

  const deleteLead = (id: number) => {
    setLeads(leads.filter(l => l.id !== id))
  }

  const updateStatus = (id: number, status: OutreachLead['status']) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    setLeads(sortLeads(leads.map(l => l.id === id ? { ...l, status, lastContacted: today } : l)))
  }

  const saveLeadEdit = () => {
    if (!editingLead) return
    setLeads(sortLeads(leads.map(l => l.id === editingLead.id ? editingLead : l)))
    setEditingLead(null)
  }

  const sendEmail = () => {
    if (!selectedLead || !emailSubject.trim()) return
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const now = new Date().toISOString()
    const newEmail: EmailHistoryItem = {
      id: crypto.randomUUID(),
      subject: emailSubject.trim(),
      body: emailBody.trim(),
      sentAt: now,
      direction: 'sent',
    }
    setLeads(sortLeads(leads.map(l => l.id === selectedLead.id ? {
      ...l,
      status: 'sent',
      lastContacted: today,
      emailHistory: [...l.emailHistory, newEmail],
    } : l)))
    setShowEmail(false)
    setEmailSubject('')
    setEmailBody('')
    setSelectedLead(null)
  }

  const addNote = (id: number, note: string) => {
    if (!note.trim()) return
    setLeads(leads.map(l => l.id === id ? { ...l, notes: l.notes ? `${l.notes}\n${note.trim()}` : note.trim() } : l))
  }

  const filtered = filterStatus === 'all' ? leads : leads.filter(l => l.status === filterStatus)

  return (
    <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Reach Out</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Email outreach and follow-up management</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5"
          style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Follow Up', count: leads.filter(l => l.status === 'follow-up').length, color: 'var(--accent)' },
          { label: 'Pending', count: leads.filter(l => l.status === 'pending').length, color: 'var(--text-secondary)' },
          { label: 'Sent', count: leads.filter(l => l.status === 'sent').length },
          { label: 'Replied', count: leads.filter(l => l.status === 'replied').length },
        ].map((stat, i) => (
          <div key={i} className="p-4 rounded-xl border-2 exodia-card text-center theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <div className="text-2xl sm:text-3xl mb-1" style={{ color: stat.color || 'var(--text-primary)', fontWeight: 700 }}>{stat.count}</div>
            <div className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'follow-up', 'pending', 'sent', 'replied'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm capitalize transition"
            style={{
              backgroundColor: filterStatus === s ? 'var(--accent)' : 'var(--bg-card)',
              color: filterStatus === s ? '#FFFFFF' : 'var(--text-secondary)',
              borderColor: 'var(--border-primary)',
              fontWeight: 500,
            }}
          >
            {s === 'all' ? 'All' : statusConfig[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Lead List */}
      <div className="space-y-3">
        {filtered.map((lead) => {
          const status = statusConfig[lead.status]
          return (
            <div
              key={lead.id}
              className="group rounded-xl border-2 exodia-card p-4 sm:p-5 transition-all hover:shadow-md"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', borderLeft: `4px solid ${status.color}` }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
                      <span style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>{lead.name.charAt(0)}{lead.company.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{lead.name}</h3>
                      <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{lead.company} &middot; {lead.email}</p>
                    </div>
                  </div>
                  {lead.notes && (
                    <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{lead.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${status.color}20`, color: status.color, fontWeight: 500 }}>
                    {status.label}
                  </span>
                  {lead.lastContacted && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{lead.lastContacted}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  onClick={() => { setSelectedLead(lead); setShowEmail(true); setEmailSubject(''); setEmailBody('') }}
                  className="px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1"
                  style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF', fontWeight: 500 }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Email
                </button>
                {lead.emailHistory.length > 0 && (
                  <button
                    onClick={() => { setThreadLead(lead); setShowThread(true) }}
                    className="px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1"
                    style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--accent)', border: '1px solid var(--border-primary)', fontWeight: 500 }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    Thread ({lead.emailHistory.length})
                  </button>
                )}
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.id, e.target.value as OutreachLead['status'])}
                  className="px-2 py-1.5 text-xs rounded-lg border outline-none cursor-pointer"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                >
                  <option value="pending">{statusConfig.pending.label}</option>
                  <option value="sent">{statusConfig.sent.label}</option>
                  <option value="replied">{statusConfig.replied.label}</option>
                  <option value="follow-up">{statusConfig['follow-up'].label}</option>
                </select>
                <button onClick={() => setEditingLead(lead)} className="p-1.5 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Edit">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => deleteLead(lead.id)} className="p-1.5 rounded-lg transition" style={{ color: 'var(--accent)' }} title="Delete">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No leads found. Add one to get started.</p>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAdd(false)}>
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Add Lead</h3>
            <input type="text" placeholder="Full Name" value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <input type="email" placeholder="Email" value={newLead.email} onChange={e => setNewLead({ ...newLead, email: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
            <input type="text" placeholder="Company" value={newLead.company} onChange={e => setNewLead({ ...newLead, company: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4" style={{ borderColor: 'var(--border-primary)' }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addLead} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingLead(null)}>
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Lead</h3>
            <input type="text" placeholder="Full Name" value={editingLead.name} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <input type="email" placeholder="Email" value={editingLead.email} onChange={e => setEditingLead({ ...editingLead, email: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
            <input type="text" placeholder="Company" value={editingLead.company} onChange={e => setEditingLead({ ...editingLead, company: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
            <div className="mb-4">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Notes</label>
              <textarea placeholder="Add notes..." value={editingLead.notes} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} rows={3} className="w-full px-3 py-2.5 border rounded-lg outline-none resize-none" style={{ borderColor: 'var(--border-primary)' }} />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingLead(null)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveLeadEdit} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {showEmail && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowEmail(false)}>
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Compose Email</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>To: {selectedLead.email} ({selectedLead.name}, {selectedLead.company})</p>

            {selectedLead.emailHistory.length > 0 && (
              <div className="mb-4 rounded-xl border" style={{ borderColor: 'var(--border-secondary)', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-secondary)' }}>Previous conversation</div>
                <div className="max-h-48 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                  {selectedLead.emailHistory.map((email) => (
                    <div key={email.id} className="px-3 py-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: email.direction === 'sent' ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {email.direction === 'sent' ? 'You:' : `${selectedLead.name}:`}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {new Date(email.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{email.subject}</p>
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{email.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input type="text" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <textarea placeholder="Write your email..." value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4 resize-none" style={{ borderColor: 'var(--border-primary)' }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowEmail(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={sendEmail} disabled={!emailSubject.trim()} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Send Email</button>
            </div>
          </div>
        </div>
      )}

      {/* Thread View Modal */}
      {showThread && threadLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowThread(false)}>
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Email Thread</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{threadLead.name} &middot; {threadLead.email}</p>
              </div>
              <button onClick={() => setShowThread(false)} className="p-1.5 rounded-lg transition" style={{ color: 'var(--accent)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
              {threadLead.emailHistory.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No emails sent yet.</p>
              ) : (
                [...threadLead.emailHistory].reverse().map((email) => (
                  <div
                    key={email.id}
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: email.direction === 'sent' ? 'var(--accent-light)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-secondary)',
                      marginLeft: email.direction === 'received' ? '24px' : '0',
                      marginRight: email.direction === 'sent' ? '24px' : '0',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium" style={{ color: email.direction === 'sent' ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {email.direction === 'sent' ? 'You' : threadLead.name}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {new Date(email.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{email.subject}</p>
                    <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{email.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => { setShowThread(false); setSelectedLead(threadLead); setShowEmail(true); setEmailSubject(''); setEmailBody('') }}
                className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}