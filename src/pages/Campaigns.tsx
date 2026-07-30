import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface AccessibleDialogProps {
  children: ReactNode
  labelledBy: string
  describedBy?: string
  role?: 'dialog' | 'alertdialog'
  requestClose: () => void
  preventClose?: boolean
  returnFocusTo?: HTMLElement | null
}

function AccessibleDialog({
  children,
  labelledBy,
  describedBy,
  role = 'dialog',
  requestClose,
  preventClose = false,
  returnFocusTo,
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    const focusFrame = requestAnimationFrame(() => {
      const target = dialog.querySelector<HTMLElement>(
        '[data-dialog-autofocus], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      ;(target || dialog).focus()
    })

    return () => {
      cancelAnimationFrame(focusFrame)
      if (dialog.open) dialog.close()
      const target = returnFocusTo || previousFocusRef.current
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus()
      })
    }
  }, [returnFocusTo])

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault()
        if (!preventClose) requestClose()
      }}
      className="fixed inset-0 m-0 h-full w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget && !preventClose) requestClose()
        }}
      >
        {children}
      </div>
    </dialog>
  )
}

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function displayDate(iso: string): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${MONTH_NAMES[parseInt(m)-1] || ''} ${parseInt(d)}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function randomSafeInteger(): number {
  const values = crypto.getRandomValues(new Uint32Array(2))
  return ((values[0] & 0x1f_ffff) * 0x1_0000_0000 + values[1]) || 1
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

interface Campaign {
  id: number
  name: string
  dept: string
  status: string
  due: string
  requesterName?: string
  requesterEmail?: string
  priority?: string
  requestType?: string[]
  description?: string
  tracking_id?: string | null
  isLocalOnly?: boolean
}

function mapCampaignRow(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    dept: row.dept || '',
    status: row.status || 'Pending',
    due: row.due || '',
    requesterName: row.requester_name || '',
    requesterEmail: row.requester_email || '',
    priority: row.priority || '',
    requestType: row.request_type || [],
    description: row.description || '',
    tracking_id: row.tracking_id || null,
    isLocalOnly: false,
  }
}

async function addToCalendar(campaign: Campaign) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Database unavailable')
  const desc = [`Requested by ${campaign.requesterName || '—'}`, `Dept: ${campaign.dept}`, `Priority: ${campaign.priority || '—'}`, `Due: ${campaign.due}`].filter(Boolean).join(' · ')
  const notes = [`Status: ${campaign.status}`, campaign.description ? `Description: ${campaign.description}` : '', campaign.requestType?.length ? `Type: ${campaign.requestType.join(', ')}` : ''].filter(Boolean).join('\n')
  const now = new Date().toISOString()
  const newItem = {
    id: crypto.randomUUID(),
    title: campaign.name,
    type: 'task',
    date: parseCampaignDate(campaign.due),
    start_time: null,
    end_time: null,
    description: desc,
    location: null,
    color: '#1a73e8',
    assignees: [],
    notes: notes,
    created_at: now,
    updated_at: now,
  }
  const { error } = await supabase.from('calendar_items').insert([newItem])
  if (error) throw error
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    if (isSupabaseConfigured) return []
    const saved = localStorage.getItem('exodia-campaigns')
    if (!saved) return []
    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed)
        ? parsed.map((campaign: Campaign) => ({ ...campaign, isLocalOnly: true }))
        : []
    } catch {
      return []
    }
  })
  const [requests, setRequests] = useState<Campaign[]>([])
  const [canonicalReady, setCanonicalReady] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [notifyId, setNotifyId] = useState<number | null>(null)
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null)
  const [showNotifyConfirm, setShowNotifyConfirm] = useState(false)
  const [showNotifySuccess, setShowNotifySuccess] = useState(false)
  const [notifyLinks, setNotifyLinks] = useState<string[]>([])
  const [notifyLinkInput, setNotifyLinkInput] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [form, setForm] = useState({ name: '', dept: '', status: 'Pending', due: todayISO(), requesterName: '', requesterEmail: '', priority: '', requestType: [] as string[], description: '' })
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lastCampaignTriggerRef = useRef<HTMLElement | null>(null)

  const allItems = useMemo(() => [...requests, ...campaigns], [requests, campaigns])
  const displayedCampaigns = filterStatus ? allItems.filter(c => c.status === filterStatus) : allItems
  const [note, setNote] = useState('')
  const [noteIsError, setNoteIsError] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    const client = supabase
    const fetchCanonicalCampaigns = async () => {
      const [campaignResult, requestResult] = await Promise.all([
        client.from('campaigns').select('*').order('created_at', { ascending: false }),
        client.from('marketing_requests').select('*').order('created_at', { ascending: false }),
      ])
      if (campaignResult.error || requestResult.error) {
        console.error('Failed to load canonical campaigns:', campaignResult.error || requestResult.error)
        setCampaigns([])
        setRequests([])
        setCanonicalReady(false)
        setNoteIsError(true)
        setNote('Canonical campaigns could not be loaded. Changes are disabled to prevent duplicates.')
        return
      }

      setCampaigns((campaignResult.data || []).map(mapCampaignRow))
      setRequests((requestResult.data || []).map((request: any, index: number) => ({
        id: -(request.id || index + 1),
        name: request.title || request.name || 'Untitled',
        dept: request.department || '',
        status: request.status || 'Pending',
        due: request.date_needed || '',
        requesterName: request.name || '',
        requesterEmail: request.email || '',
        priority: request.priority || '',
        requestType: request.request_type || [],
        description: request.description || '',
        tracking_id: request.tracking_id || null,
      })))
      setCanonicalReady(true)
      setNote('')
    }

    void fetchCanonicalCampaigns()
    const channel = client.channel('canonical-campaigns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => { void fetchCanonicalCampaigns() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_requests' }, () => { void fetchCanonicalCampaigns() })
      .subscribe()
    return () => { try { client.removeChannel(channel) } catch {} }
  }, [])

  const showNote = (msg: string, isError = false) => {
    setNoteIsError(isError)
    setNote(msg)
    setTimeout(() => setNote(''), 3000)
  }

  const addCampaign = async () => {
    if (!form.name.trim()) return
    if (!isSupabaseConfigured || !supabase) {
      showNote('Campaign could not be created because the database is unavailable.', true)
      return
    }
    if (!canonicalReady) {
      showNote('Canonical campaigns have not loaded successfully. No campaign was created.', true)
      return
    }
    setBusy(true)
    try {
      const id = randomSafeInteger()
      const { data, error } = await supabase.from('campaigns').insert([{
        id,
        name: form.name.trim(),
        dept: form.dept,
        status: form.status,
        due: form.due,
        requester_name: form.requesterName || '',
        requester_email: form.requesterEmail || '',
        priority: form.priority || '',
        request_type: form.requestType || [],
        description: form.description || '',
        tracking_id: null,
      }]).select('*').single()
      if (error || !data) throw error || new Error('Campaign was not returned after creation')

      const campaign = mapCampaignRow(data)
      let calendarSynced = true
      try {
        await addToCalendar(campaign)
      } catch (calendarError) {
        calendarSynced = false
        console.error('Campaign saved but Calendar sync failed:', calendarError)
      }

      setCampaigns(current => [...current, campaign])
      showNote(
        calendarSynced
          ? `Campaign "${campaign.name}" created and added to Calendar.`
          : `Campaign "${campaign.name}" was created, but Calendar sync failed.`,
        !calendarSynced,
      )
      setShowAdd(false)
      setForm({ name: '', dept: '', status: 'Pending', due: todayISO(), requesterName: '', requesterEmail: '', priority: '', requestType: [], description: '' })
    } catch (error) {
      console.error('Failed to create campaign:', error)
      showNote('Campaign could not be created. No local record was added.', true)
    } finally {
      setBusy(false)
    }
  }

  const updateStatus = async (campaign: Campaign, status: string) => {
    if (campaign.status === status) return
    if (campaign.isLocalOnly) {
      showNote('This legacy browser-only campaign is view-only and was not changed.', true)
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      showNote('Status could not be changed because the database is unavailable.', true)
      return
    }
    if (!canonicalReady) {
      showNote('Canonical campaigns have not loaded successfully. Status was not changed.', true)
      return
    }
    setBusy(true)
    try {
      const recordId = Math.abs(campaign.id)
      const result = campaign.id < 0
        ? await supabase.from('marketing_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', recordId).select('id').maybeSingle()
        : await supabase.from('campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', recordId).select('id').maybeSingle()
      if (result.error || !result.data) throw result.error || new Error('Record not found')

      if (campaign.id < 0) {
        setRequests(current => current.map(item => item.id === campaign.id ? { ...item, status } : item))
      } else {
        setCampaigns(current => current.map(item => item.id === campaign.id ? { ...item, status } : item))
      }
      setViewingCampaign(current => current?.id === campaign.id ? { ...current, status } : current)
      showNote('Status updated. Existing Calendar entries were left unchanged.')
    } catch (error) {
      console.error('Failed to update campaign status:', error)
      showNote('Status could not be updated. The displayed record was left unchanged.', true)
    } finally {
      setBusy(false)
    }
  }

  const deleteCampaign = async (id: number) => {
    const campaign = allItems.find(item => item.id === id)
    if (!campaign) return
    if (campaign.isLocalOnly) {
      showNote('This legacy browser-only campaign is view-only and was not deleted.', true)
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      showNote('The record could not be deleted because the database is unavailable.', true)
      return
    }
    if (!canonicalReady) {
      showNote('Canonical campaigns have not loaded successfully. The record was not deleted.', true)
      return
    }
    if (!window.confirm(`Delete "${campaign.name}"?`)) return

    setBusy(true)
    try {
      const recordId = Math.abs(id)
      const result = id < 0
        ? await supabase.from('marketing_requests').delete().eq('id', recordId).select('id').maybeSingle()
        : await supabase.from('campaigns').delete().eq('id', recordId).select('id').maybeSingle()
      if (result.error || !result.data) throw result.error || new Error('Record not found')

      if (id < 0) setRequests(current => current.filter(item => item.id !== id))
      else setCampaigns(current => current.filter(item => item.id !== id))
      setViewingCampaign(current => current?.id === id ? null : current)
      showNote(`"${campaign.name}" was deleted. Existing Calendar entries were left unchanged.`)
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      showNote('The record could not be deleted. The displayed record was left unchanged.', true)
    } finally {
      setBusy(false)
    }
  }

  const notifyRequester = async () => {
    const campaign = viewingCampaign
    if (!campaign || notifyId === null) return
    if (campaign.isLocalOnly) {
      showNote('This legacy browser-only campaign cannot send a completion notice.', true)
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      showNote('The completion notice could not be sent because the service is unavailable.', true)
      return
    }
    if (!canonicalReady) {
      showNote('Canonical campaigns have not loaded successfully. No completion notice was sent.', true)
      return
    }

    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('notify-complete', {
        body: {
          source: campaign.id < 0 ? 'marketing_requests' : 'campaigns',
          recordId: Math.abs(campaign.id),
          links: notifyLinks,
          description: notifyMessage || campaign.description || '',
        },
      })
      if (error || data?.success !== true) throw error || new Error('Notification was not confirmed')
      setShowNotifyConfirm(false)
      setNotifyId(null)
      setViewingCampaign(null)
      setShowNotifySuccess(true)
    } catch (error) {
      console.error('Failed to send completion notice:', error)
      showNote('The completion notice was not sent. The preview remains open.', true)
    } finally {
      setBusy(false)
    }
  }

  const statusCounts = {
    pending: allItems.filter(c => c.status === 'Pending').length,
    ongoing: allItems.filter(c => c.status === 'Ongoing').length,
    done: allItems.filter(c => c.status === 'Done').length,
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    Pending: { bg: '#FFF7ED', text: '#EA580C' },
    Ongoing: { bg: '#EBF5FF', text: '#2563EB' },
    Done: { bg: '#F0FDF4', text: '#16A34A' },
  }

  return (
    <div>
      {note && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all"
          style={{ backgroundColor: '#1B1A1C', color: '#FFFFFF' }}
          role={noteIsError ? 'alert' : 'status'}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" style={{ color: noteIsError ? '#EF4444' : '#16A34A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={noteIsError ? 'M6 18L18 6M6 6l12 12' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
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
              <button onClick={() => setShowAdd(true)} disabled={!canonicalReady} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0" style={{ backgroundColor: 'var(--accent)', boxShadow: '0 4px 12px rgba(255,89,0,0.25)', color: '#FFFFFF' }}>
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
                  { label: 'Total', key: null, count: allItems.length, color: '#CACDD7', bg: '#F3F4F6', barColor: '#CACDD7' },
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
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${allItems.length > 0 ? (stat.count / allItems.length) * 100 : 0}%`, backgroundColor: stat.barColor }}></div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {/* All campaigns list */}
              {displayedCampaigns.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No campaigns yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedCampaigns.map((camp) => {
                  const sc = statusColors[camp.status] || { bg: 'var(--accent-light)', text: 'var(--accent)' }
                  return (
                    <div
                      key={camp.id}
                      tabIndex={0}
                      aria-label={`View campaign ${camp.name}`}
                      className="group flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition hover:opacity-80 theme-transition"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                      onClick={(event) => {
                        event.currentTarget.focus()
                        lastCampaignTriggerRef.current = event.currentTarget
                        setViewingCampaign(camp)
                      }}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
                        event.preventDefault()
                        lastCampaignTriggerRef.current = event.currentTarget
                        setViewingCampaign(camp)
                      }}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.text }}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {camp.name}
                          {camp.priority && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold align-middle" style={{ backgroundColor: camp.priority === 'Rush' ? '#FEF2F2' : camp.priority === 'High' ? '#FFF7ED' : camp.priority === 'Standard' ? '#EFF6FF' : '#F0FDF4', color: camp.priority === 'Rush' ? '#DC2626' : camp.priority === 'High' ? '#FF5900' : camp.priority === 'Standard' ? '#2563EB' : '#16A34A' }}>{camp.priority}</span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{camp.tracking_id && <span style={{ color: '#FF5900' }}>{camp.tracking_id} &middot; </span>}{camp.dept}{camp.requesterName ? ` &middot; ${camp.requesterName}` : ''} &middot; Due: {displayDate(camp.due)}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.text }}>{camp.status}</span>
                      <span className="relative">
                        <select
                          value={camp.status}
                          disabled={busy}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation()
                            void updateStatus(camp, e.target.value)
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Ongoing">Ongoing</option>
                          <option value="Done">Done</option>
                        </select>
                      </span>
                      <button aria-label={`Delete campaign ${camp.name}`} disabled={busy} onClick={(event) => { event.stopPropagation(); void deleteCampaign(camp.id) }} className="p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed" style={{ color: 'var(--accent)' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Campaign Modal */}
      {showAdd && (
        <AccessibleDialog
          labelledBy="campaign-add-title"
          requestClose={() => setShowAdd(false)}
          preventClose={busy}
        >
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 id="campaign-add-title" className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>New Campaign</h3>
            <div className="space-y-3">
              <input data-dialog-autofocus type="text" placeholder="Campaign Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <input type="text" placeholder="Requesting Dept (e.g. HR)" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }}>
                <option value="Pending">Pending</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Done">Done</option>
              </select>
              <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none" style={{ borderColor: 'var(--border-primary)' }} />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button disabled={busy} onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button disabled={busy} onClick={() => void addCampaign()} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>{busy ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* PDF-style Campaign Document Modal */}
      {viewingCampaign && (
        <AccessibleDialog
          labelledBy="campaign-document-title"
          requestClose={() => setViewingCampaign(null)}
          preventClose={busy}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between px-8 py-4 border-b" style={{ backgroundColor: '#1B1A1C', borderColor: '#2D2B2E' }}>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <span id="campaign-document-title" className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Campaign Document</span>
              </div>
              <button
                data-dialog-autofocus
                aria-label="Close campaign document"
                disabled={busy}
                onClick={() => setViewingCampaign(null)}
                className="p-1.5 rounded-lg transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: '#9CA3AF' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-10 py-8">
              <div className="text-center mb-8 pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B1A1C' }}>{viewingCampaign.name}</h2>
                {viewingCampaign.tracking_id && (
                  <p className="text-sm font-mono mb-3" style={{ color: '#FF5900' }}>{viewingCampaign.tracking_id}</p>
                )}
                <select
                  value={viewingCampaign.status}
                  disabled={busy}
                  onChange={(e) => {
                    void updateStatus(viewingCampaign, e.target.value)
                  }}
                  className="text-sm px-3 py-1 rounded-full font-medium outline-none cursor-pointer border-0"
                  style={{ backgroundColor: statusColors[viewingCampaign.status]?.bg || '#F3F4F6', color: statusColors[viewingCampaign.status]?.text || '#6B7280' }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Done">Done</option>
                </select>
              </div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mb-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Requester</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingCampaign.requesterName || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Department</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingCampaign.dept}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Email</p>
                  <p className="text-sm" style={{ color: '#FF5900' }}>{viewingCampaign.requesterEmail || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Date Needed</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{displayDate(viewingCampaign.due)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Priority</p>
                  <p className="text-sm font-semibold" style={{ color: viewingCampaign.priority === 'Rush' ? '#DC2626' : viewingCampaign.priority === 'High' ? '#FF5900' : viewingCampaign.priority === 'Standard' ? '#2563EB' : viewingCampaign.priority === 'Low' ? '#16A34A' : '#1B1A1C' }}>{viewingCampaign.priority || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Request Type</p>
                  <p className="text-sm" style={{ color: '#1B1A1C' }}>{viewingCampaign.requestType && viewingCampaign.requestType.length > 0 ? viewingCampaign.requestType.join(', ') : '—'}</p>
                </div>
              </div>
              {viewingCampaign.description && (
                <div className="mb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Description</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#1B1A1C', lineHeight: 1.7 }}>{viewingCampaign.description}</p>
                </div>
              )}
              <div className="pt-6 border-t text-center" style={{ borderColor: '#E5E7EB' }}>
                <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Exodia Game Development &middot; Marketing Department</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-8 py-4 border-t" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
              {viewingCampaign.status === 'Done' && (
                <button
                  onClick={() => {
                    if (viewingCampaign.isLocalOnly) {
                      showNote('This legacy browser-only campaign cannot send a completion notice.', true)
                      return
                    }
                    setNotifyId(viewingCampaign.id)
                    setNotifyLinks([])
                    setNotifyLinkInput('')
                    setNotifyMessage(viewingCampaign.description || '')
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
              <button disabled={busy} onClick={() => setViewingCampaign(null)} className="px-4 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80 ml-auto disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: '#1B1A1C', color: '#FFFFFF' }}>
                Close
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Email Preview & Send Modal */}
      {showNotifyConfirm && notifyId !== null && (
        <AccessibleDialog
          labelledBy="campaign-notify-title"
          describedBy="campaign-notify-description"
          requestClose={() => {
            setShowNotifyConfirm(false)
            setNotifyId(null)
          }}
          preventClose={busy}
        >
          <div className="relative w-full max-w-lg rounded-2xl border flex flex-col" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', maxHeight: '90vh' }}>
            <div className="px-6 pt-6 pb-3 flex-shrink-0">
              <h3 id="campaign-notify-title" className="text-lg mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Email Preview</h3>
              <p id="campaign-notify-description" className="text-xs mb-0" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>This notification will be sent to the requester.</p>
            </div>
            <div className="px-6 overflow-y-auto flex-1 space-y-3">
            {(() => {
              const camp = viewingCampaign
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
                    <p className="text-xs font-medium mb-2" style={{ color: '#1B1A1C' }}>Subject: [Completed] {camp?.tracking_id || ''}: {camp?.name || ''}</p>
                    <div className="text-xs leading-relaxed" style={{ color: '#4B5563', lineHeight: 1.6 }}>
                      <p>Hi {camp?.requesterName || 'there'},</p>
                      <p className="mt-2">Great news! The Marketing team has completed your request.</p>
                      {/* Summary Box */}
                      <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#F3F4F6' }}>
                        <p className="text-xs font-bold mb-2" style={{ color: '#1B1A1C' }}>📋 Request Summary</p>
                        <p className="text-xs" style={{ color: '#4B5563' }}>Tracking ID: <span style={{ color: '#FF5900', fontWeight: 600 }}>{camp?.tracking_id || '—'}</span></p>
                        <p className="text-xs mt-1" style={{ color: '#4B5563' }}>Project Name: {camp?.name || '—'}</p>
                        <p className="text-xs mt-1" style={{ color: '#4B5563' }}>Original Priority: {camp?.priority || '—'}</p>
                      </div>
                      {/* Final Deliverables */}
                      <div className="mt-3">
                        <p className="text-xs font-bold mb-1" style={{ color: '#1B1A1C' }}>Final Deliverables</p>
                        <p className="text-xs" style={{ color: '#4B5563' }}>Please find your completed assets at the links below:</p>
                        {notifyLinks.length > 0 ? (
                          <ul className="mt-1 space-y-0.5 list-disc pl-4">
                            {notifyLinks.map((link, i) => (
                              <li key={i} className="text-xs" style={{ color: '#FF5900' }}>{link}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs mt-1 italic" style={{ color: '#9CA3AF' }}>(No file links attached)</p>
                        )}
                      </div>
                      {/* Delivery Notes */}
                      <div className="mt-3">
                        <p className="text-xs font-bold mb-1" style={{ color: '#1B1A1C' }}>📝 Delivery Notes from the Team</p>
                        <p className="text-xs" style={{ color: '#4B5563' }}>{notifyMessage || 'Your request has been completed.'}</p>
                      </div>
                      <p className="mt-3 text-xs" style={{ color: '#4B5563' }}>If you need any minor tweaks, just reply to this email or message us on the internal portal.</p>
                      <p className="mt-4" style={{ color: '#9CA3AF' }}>Exodia Game Development &middot; Marketing Department</p>
                    </div>
                  </div>
                  {/* Attach links */}
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Attach Resource Links</p>
                    <div className="flex gap-2">
                      <input
                        data-dialog-autofocus
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
                            <button aria-label={`Remove resource link ${i + 1}`} onClick={() => setNotifyLinks(prev => prev.filter((_, j) => j !== i))} className="p-0.5 rounded transition hover:opacity-70" style={{ color: '#DC2626' }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Delivery Notes editor */}
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>📝 Delivery Notes from the Team</p>
                    <textarea
                      value={notifyMessage}
                      onChange={(e) => setNotifyMessage(e.target.value)}
                      placeholder="Add a personalized message..."
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-xs outline-none resize-none"
                      style={{ borderColor: 'var(--border-primary)' }}
                    />
                  </div>
                </div>
              )
            })()}
            </div>
            <div className="px-6 py-4 border-t flex-shrink-0 flex gap-3 justify-end" style={{ borderColor: '#E5E7EB' }}>
              <button disabled={busy} onClick={() => { setShowNotifyConfirm(false); setNotifyId(null) }} className="px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button
                disabled={busy}
                onClick={() => void notifyRequester()}
                className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#16A34A', fontWeight: 500 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {busy ? 'Sending...' : 'Send to Requester'}
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Success Popup */}
      {showNotifySuccess && (
        <AccessibleDialog
          role="alertdialog"
          labelledBy="campaign-success-title"
          describedBy="campaign-success-description"
          requestClose={() => setShowNotifySuccess(false)}
          returnFocusTo={lastCampaignTriggerRef.current}
        >
          <div className="relative rounded-2xl border p-8 max-w-sm w-full text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F0FDF4' }}>
              <svg className="w-8 h-8" style={{ color: '#16A34A' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 id="campaign-success-title" className="text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Notification Sent!</h3>
            <p id="campaign-success-description" className="text-sm mb-6" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              The requester has been notified of the completed campaign.
            </p>
            <button
              data-dialog-autofocus
              onClick={() => setShowNotifySuccess(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition hover:opacity-80"
              style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
            >
              Got it
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  )
}
