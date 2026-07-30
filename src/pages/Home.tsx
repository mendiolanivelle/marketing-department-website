import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity, getActivityLog } from '../lib/activityLogger'
import type { ActivityEntry } from '../lib/activityLogger'

const readBrowserArray = (key: string): any[] => {
  const saved = localStorage.getItem(key)
  if (!saved) return []
  try {
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const readBrowserCalendarItems = () => readBrowserArray('exodia-calendar-items')
const readBrowserCampaigns = () => readBrowserArray('exodia-campaigns')

export default function Home() {
  const [leadStats, setLeadStats] = useState({
    totalLeads: 0,
    emailsSent: 0,
    replied: 0,
    noReply: 0,
    meetingsLeft: 0,
  })
  const [leadCountReady, setLeadCountReady] = useState(!isSupabaseConfigured)
  const [calendarItems, setCalendarItems] = useState<any[]>(() => isSupabaseConfigured ? [] : readBrowserCalendarItems())
  const [calendarReady, setCalendarReady] = useState(false)
  const remoteCalendarItemIdsRef = useRef(new Set<string>())
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null)
  const [showPipeline, setShowPipeline] = useState(false)
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() =>
    readBrowserArray('exodia-read-announcements').filter((id): id is string => typeof id === 'string'),
  )
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)
  const [showReadAnnouncements, setShowReadAnnouncements] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', date: new Date().toISOString().split('T')[0], tag: 'Event', content: '' })
  const [tasks, setTasks] = useState(() => isSupabaseConfigured ? [] : readBrowserArray('exodia-tasks'))
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTaskText, setEditingTaskText] = useState('')
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [campaigns, setCampaigns] = useState<any[]>(() => isSupabaseConfigured ? [] : readBrowserCampaigns())
  const [campaignCountsReady, setCampaignCountsReady] = useState(!isSupabaseConfigured)

  // Refresh activity log on mount and when navigating back to dashboard
  const location = useLocation()
  useEffect(() => {
    setActivityLog(getActivityLog())
    const refresh = () => setActivityLog(getActivityLog())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [location.key])

  // Browser-only tasks remain device-local until their migration is defined.
  useEffect(() => {
    if (isSupabaseConfigured) return
    localStorage.setItem('exodia-tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('exodia-read-announcements', JSON.stringify(readAnnouncementIds))
  }, [readAnnouncementIds])

  const syncCalendarItems = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      remoteCalendarItemIdsRef.current = new Set()
      setCalendarItems(readBrowserCalendarItems())
      setCalendarReady(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('calendar_items')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const remoteItems = data || []
      remoteCalendarItemIdsRef.current = new Set(remoteItems.map(item => item.id))
      setCalendarItems(remoteItems)
      setSelectedAnnouncement(current => current ? remoteItems.find(item => item.id === current.id) || null : null)
      setCalendarReady(true)
    } catch (err) {
      console.error('Failed to sync calendar items:', err)
      remoteCalendarItemIdsRef.current = new Set()
      setCalendarItems([])
      setSelectedAnnouncement(null)
      setCalendarReady(false)
    }
  }, [])

  useEffect(() => {
    void syncCalendarItems()
    if (!isSupabaseConfigured || !supabase) return
    const client = supabase
    const calChannel = client
      .channel('calendar-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_items' }, () => {
        void syncCalendarItems()
      })
      .subscribe()
    return () => { try { client.removeChannel(calChannel) } catch {} }
  }, [syncCalendarItems])

  useEffect(() => {
    const handler = () => { void syncCalendarItems() }
    window.addEventListener('calendar-updated', handler)
    return () => window.removeEventListener('calendar-updated', handler)
  }, [syncCalendarItems])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    const client = supabase
    const syncCampaigns = async () => {
      const [campaignResult, requestResult] = await Promise.all([
        client.from('campaigns').select('id, status'),
        client.from('marketing_requests').select('id, status'),
      ])
      if (campaignResult.error || requestResult.error) {
        console.error('Failed to sync dashboard campaign counts:', campaignResult.error || requestResult.error)
        setCampaigns([])
        setCampaignCountsReady(false)
        return
      }

      const remoteCampaigns = [
        ...(campaignResult.data || []).map(row => ({ id: row.id, status: row.status || 'Pending' })),
        ...(requestResult.data || []).map(row => ({ id: -Number(row.id), status: row.status || 'Pending' })),
      ]
      setCampaigns(remoteCampaigns)
      setCampaignCountsReady(true)
    }

    void syncCampaigns()
    const channel = client
      .channel('dashboard-campaign-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => { void syncCampaigns() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_requests' }, () => { void syncCampaigns() })
      .subscribe()
    return () => { try { client.removeChannel(channel) } catch {} }
  }, [])

  const fetchLeadStats = useCallback(async () => {
    // Helper: count total leads from Lead Generation data
    const countTotalLeads = () => {
      if (!isSupabaseConfigured || !supabase) {
        const files = readBrowserArray('exodia-lead-files')
        let total = 0
        for (const f of files) {
          if (f?.name === 'Duplicate Leads' || !Array.isArray(f?.columns)) continue
          const rows = readBrowserArray(`exodia-lead-rows-${f.id}`)
          for (const row of rows) {
            const data = row?.data
            if (!data || typeof data !== 'object') continue
            const companyCol = f.columns.find((column: unknown) => typeof column === 'string' && column.toLowerCase().includes('company'))
            if (companyCol && typeof data[companyCol] === 'string' && data[companyCol].trim()) {
              total++
            }
          }
        }
        return total
      }
      return 0 // Supabase case handled below
    }

    // Read messaging stats from localStorage
    const getMessagingStats = () => {
      const empty = { emailsSent: 0, replied: 0, noReply: 0, meetingsLeft: 0 }
      if (isSupabaseConfigured) return empty
      const leads = readBrowserArray('exodia-outreach-leads')
      return {
        emailsSent: leads.filter((lead: any) => lead.status === 'sent').length,
        replied: leads.filter((lead: any) => lead.status === 'replied').length,
        noReply: leads.filter((lead: any) => lead.status === 'no-reply').length,
        meetingsLeft: leads.filter((lead: any) => lead.status === 'meeting-booked').length,
      }
    }

    // Total from Lead Generation (Supabase or localStorage)
    let totalLeads = countTotalLeads()

    if (isSupabaseConfigured && supabase) {
      setLeadCountReady(false)
      try {
        const { data: files, error: filesError } = await supabase
          .from('lead_files')
          .select('id, name, columns')
        if (filesError) throw filesError

        const nonDuplicateFiles = (files || []).filter(f => f.name !== 'Duplicate Leads')
        const nonDuplicateFileIds = nonDuplicateFiles.map(f => f.id)
        totalLeads = 0

        if (nonDuplicateFileIds.length > 0) {
          const { data: allRows, error: rowsError } = await supabase
            .from('lead_rows')
            .select('file_id, data')
            .in('file_id', nonDuplicateFileIds)
          if (rowsError) throw rowsError

          for (const row of allRows || []) {
            const data = row.data as Record<string, string>
            const file = nonDuplicateFiles.find(f => f.id === row.file_id)
            if (!file) continue
            const columns = file.columns as string[]
            const companyCol = columns.find(col => col.toLowerCase().includes('company'))
            if (companyCol && data[companyCol]?.trim()) totalLeads++
          }
        }
        setLeadCountReady(true)
      } catch (err) {
        console.error('Error fetching lead stats:', err)
        setLeadCountReady(false)
      }
    }

    const msgStats = getMessagingStats()
    setLeadStats({ totalLeads, ...msgStats })
  }, [])

  useEffect(() => {
    fetchLeadStats()
    if (!isSupabaseConfigured || !supabase) return

    const filesChannel = supabase
      .channel('lead_files_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_files' }, () => { fetchLeadStats() })
      .subscribe()

    const rowsChannel = supabase
      .channel('lead_rows_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_rows' }, () => { fetchLeadStats() })
      .subscribe()

    return () => {
      try { supabase?.removeChannel(filesChannel) } catch {}
      try { supabase?.removeChannel(rowsChannel) } catch {}
    }
  }, [fetchLeadStats])

  // Poll localStorage every 3s for lead stat changes (syncs with LeadGeneration)
  useEffect(() => {
    if (isSupabaseConfigured && supabase) return
    const interval = setInterval(fetchLeadStats, 10000)
    return () => clearInterval(interval)
  }, [fetchLeadStats])

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
    const task = tasks.find(t => t.id === id)
    if (task) logActivity('Task', task.done ? `Unchecked "${task.text}"` : `Completed "${task.text}"`)
    setActivityLog(getActivityLog())
  }

  const addTask = () => {
    if (!newTaskText.trim()) return
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1
    setTasks([{ id: newId, text: newTaskText.trim(), done: false }, ...tasks])
    setNewTaskText('')
    logActivity('Task', `Added "${newTaskText.trim()}"`)
    setActivityLog(getActivityLog())
  }

  const deleteTask = (id: number) => {
    if (!window.confirm('Delete this task?')) return
    const task = tasks.find(t => t.id === id)
    setTasks(tasks.filter(t => t.id !== id))
    if (task) logActivity('Task', `Deleted "${task.text}"`)
    setActivityLog(getActivityLog())
  }

  const startEditingTask = (task: { id: number; text: string }) => {
    setEditingTaskId(task.id)
    setEditingTaskText(task.text)
  }

  const saveTaskEdit = () => {
    if (editingTaskId === null) return
    if (!editingTaskText.trim()) {
      deleteTask(editingTaskId)
    } else {
      setTasks(tasks.map(t => t.id === editingTaskId ? { ...t, text: editingTaskText.trim() } : t))
    }
    setEditingTaskId(null)
    setEditingTaskText('')
  }

  const tagFromType = (type: string) => {
    if (type === 'meeting') return 'Meeting'
    if (type === 'event') return 'Event'
    if (type === 'task') return 'Update'
    return 'Event'
  }

  const typeFromTag = (tag: string) => {
    if (tag === 'Meeting') return 'meeting'
    if (tag === 'Event') return 'event'
    if (tag === 'Update' || tag === 'Deadline') return 'task'
    return 'event'
  }

  const formatCalendarDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const canMutateAnnouncement = (id?: string) => {
    if (!isSupabaseConfigured || !supabase) {
      window.alert('Announcements are read-only until canonical storage is available.')
      return false
    }
    if (!calendarReady) {
      window.alert('Canonical announcement data has not loaded successfully. No changes were made.')
      return false
    }
    if (id && !remoteCalendarItemIdsRef.current.has(id)) {
      window.alert('This browser-only announcement is preserved as read-only because it has no canonical record.')
      return false
    }
    return true
  }

  const addAnnouncement = async () => {
    if (!newAnnouncement.title.trim()) return
    if (!canMutateAnnouncement() || !supabase) return
    const now = new Date().toISOString()
    const newItem = {
      id: crypto.randomUUID(),
      title: newAnnouncement.title.trim(),
      type: typeFromTag(newAnnouncement.tag),
      date: newAnnouncement.date || new Date().toISOString().split('T')[0],
      start_time: null,
      end_time: null,
      description: newAnnouncement.content.trim() || null,
      location: null,
      color: newAnnouncement.tag === 'Meeting' ? '#FF5900' : newAnnouncement.tag === 'Event' ? '#0B8043' : '#1a73e8',
      assignees: [],
      notes: '',
      created_at: now,
      updated_at: now,
    }
    try {
      const { data, error } = await supabase
        .from('calendar_items')
        .insert([newItem])
        .select('*')
        .single()
      if (error) throw error
      if (!data) throw new Error('The canonical announcement was not returned after creation.')

      remoteCalendarItemIdsRef.current.add(data.id)
      setCalendarItems(prev => [data, ...prev.filter(item => item.id !== data.id)])
      setNewAnnouncement({ title: '', date: new Date().toISOString().split('T')[0], tag: 'Event', content: '' })
      setShowAddAnnouncement(false)
      logActivity('Announcement', `Added "${data.title}"`)
      setActivityLog(getActivityLog())
      window.dispatchEvent(new CustomEvent('calendar-updated'))
    } catch (error) {
      console.error('Failed to create announcement:', error)
      window.alert('The announcement was not created. No visible or browser-only data was changed.')
    }
  }

  const deleteAnnouncement = async (id: string) => {
    if (!canMutateAnnouncement(id) || !supabase) return
    if (!window.confirm('Delete this announcement?')) return
    const item = calendarItems.find(a => a.id === id)
    try {
      const { data, error } = await supabase
        .from('calendar_items')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('The canonical announcement no longer exists.')

      remoteCalendarItemIdsRef.current.delete(id)
      setCalendarItems(prev => prev.filter(announcement => announcement.id !== id))
      if (selectedAnnouncement?.id === id) setSelectedAnnouncement(null)
      if (item) logActivity('Announcement', `Deleted "${item.title}"`)
      setActivityLog(getActivityLog())
      window.dispatchEvent(new CustomEvent('calendar-updated'))
    } catch (error) {
      console.error('Failed to delete announcement:', error)
      window.alert('The announcement was not deleted. No visible or browser-only data was changed.')
    }
  }

  const startEditingAnnouncement = (announcement: any) => {
    if (!canMutateAnnouncement(announcement.id)) return
    setEditingAnnouncement({
      ...announcement,
      tag: tagFromType(announcement.type),
      content: announcement.description || '',
    })
    setSelectedAnnouncement(null)
  }

  const saveAnnouncementEdit = async () => {
    if (!editingAnnouncement) return
    if (!canMutateAnnouncement(editingAnnouncement.id) || !supabase) return
    const update = {
      title: editingAnnouncement.title,
      type: typeFromTag(editingAnnouncement.tag),
      date: editingAnnouncement.date,
      description: editingAnnouncement.content || null,
      color: editingAnnouncement.tag === 'Meeting' ? '#FF5900' : editingAnnouncement.tag === 'Event' ? '#0B8043' : '#1a73e8',
      updated_at: new Date().toISOString(),
    }
    try {
      const { data, error } = await supabase
        .from('calendar_items')
        .update(update)
        .eq('id', editingAnnouncement.id)
        .eq('updated_at', editingAnnouncement.updated_at)
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('The canonical announcement no longer exists.')

      setCalendarItems(prev => prev.map(announcement => announcement.id === data.id ? data : announcement))
      setEditingAnnouncement(null)
      logActivity('Announcement', `Updated "${data.title}"`)
      setActivityLog(getActivityLog())
      window.dispatchEvent(new CustomEvent('calendar-updated'))
    } catch (error) {
      console.error('Failed to update announcement:', error)
      window.alert('The announcement was not updated. No visible or browser-only data was changed.')
    }
  }

  // Build fix: ensure JSX structure is balanced
  return (
    <div className="min-h-screen theme-transition" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4 sm:px-6 text-center sm:pt-20 sm:pb-12 theme-transition" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--accent-light)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-5xl mb-3 tracking-tight" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            Marketing Hub
          </h1>
          <p className="text-base sm:text-lg" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Central Portal for Marketing Department&rsquo;s Executions, Resources, Campaigns, and Team Updates
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12 sm:pb-20 -mt-4 sm:-mt-6">
        <div className="max-w-7xl mx-auto">
          {/* Announcements */}
          <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #FF8C33, var(--accent), #FF8C33)' }}></div>
            <div className="p-5 sm:p-8">
              <div className="flex items-center justify-between mb-5 sm:mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Announcements</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                      {calendarItems.filter(a => !readAnnouncementIds.includes(a.id)).length} unread
                      <button
                        onClick={() => setShowReadAnnouncements(!showReadAnnouncements)}
                        className="ml-2 underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        {showReadAnnouncements ? 'Hide read' : 'Show read'}
                      </button>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddAnnouncement(true)}
                  disabled={!calendarReady}
                  className="w-9 h-9 rounded-xl transition flex items-center justify-center hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                  title={calendarReady ? 'Add announcement' : 'Canonical announcements are unavailable'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {isSupabaseConfigured && !calendarReady && (
                <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Canonical announcements are unavailable. Changes are disabled to prevent duplicates.
                </p>
              )}
              {calendarItems.filter(item => showReadAnnouncements || !readAnnouncementIds.includes(item.id)).length === 0 ? (
                <div className="text-center py-10">
                  <svg className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                  <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No announcements</p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto pr-1 -mr-1 space-y-3 sm:space-y-4">
                  {calendarItems
                    .filter(item => showReadAnnouncements || !readAnnouncementIds.includes(item.id))
                    .map((item) => {
                  const tag = tagFromType(item.type)
                  const tagColors: Record<string, { bg: string; text: string }> = {
                    Meeting: { bg: '#EBF5FF', text: '#2563EB' },
                    Update: { bg: '#FFF7ED', text: '#EA580C' },
                    Event: { bg: '#F0FDF4', text: '#16A34A' },
                    Deadline: { bg: '#FEF2F2', text: '#DC2626' },
                  }
                  const isRead = readAnnouncementIds.includes(item.id)
                  const tc = tagColors[tag] || { bg: 'var(--accent-light)', text: 'var(--accent)' }
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAnnouncement(item)}
                      className="group rounded-xl p-4 sm:p-5 transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer theme-transition"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', opacity: isRead && showReadAnnouncements ? 0.5 : 1 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor: tc.bg, color: tc.text }}>
                          {tag}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{formatCalendarDate(item.date)}</span>
                      </div>
                      <p className="text-sm font-medium mb-2" style={{ color: isRead ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: isRead ? 400 : 600 }}>
                        {item.title}
                      </p>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                        {item.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>

          {/* Lead Pipeline */}
          <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
            <div className="p-5 sm:p-8">
              <div className="flex items-center justify-between mb-5 sm:mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lead Pipeline</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Click any stat below to view full details</p>
                  </div>
                </div>
                <Link to="/leads" className="text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1" style={{ color: 'var(--accent)', fontWeight: 500, backgroundColor: 'var(--accent-light)' }}>
                  View All Leads
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className={isSupabaseConfigured ? 'grid grid-cols-1 gap-3 sm:gap-4' : 'grid grid-cols-5 gap-3 sm:gap-4'}>
                {[
                  { label: 'Total Leads', value: leadCountReady ? leadStats.totalLeads : '—', color: '#1B1A1C' },
                  ...(!isSupabaseConfigured ? [
                    { label: 'Emails Sent', value: leadStats.emailsSent, color: '#3E4048' },
                    { label: 'Replied', value: leadStats.replied, color: '#FF5900' },
                    { label: 'No Reply', value: leadStats.noReply, color: '#DC2626' },
                    { label: 'Meetings', value: leadStats.meetingsLeft, color: '#2563EB' },
                  ] : []),
                ].map((stat, i) => (
                  <div key={i} onClick={() => setShowPipeline(true)} className="p-3 sm:p-4 rounded-xl text-center border cursor-pointer transition hover:-translate-y-0.5 theme-transition" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                    <div className="text-2xl sm:text-3xl mb-0.5" style={{ color: stat.color, fontWeight: 700 }}>{stat.value}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Campaign Highlights */}
          <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #FF8C33, #FF5900, #FF8C33)' }}></div>
            <div className="p-5 sm:p-8">
              <div className="flex items-center justify-between mb-5 sm:mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Campaign Highlights</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Quick glance at your campaign tracker</p>
                  </div>
                </div>
                <Link to="/campaigns" className="text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1" style={{ color: 'var(--accent)', fontWeight: 500, backgroundColor: 'var(--accent-light)' }}>
                  View All Campaigns
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              {/* Mini Status Counters */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
                {[
                  { label: 'Pending', value: campaigns.filter(c => c.status === 'Pending').length, color: '#1B1A1C' },
                  { label: 'Ongoing', value: campaigns.filter(c => c.status === 'Ongoing').length, color: '#3E4048' },
                  { label: 'Done', value: campaigns.filter(c => c.status === 'Done').length, color: '#FF5900' },
                ].map((stat, i) => (
                  <div key={i} className="p-3 sm:p-4 rounded-xl text-center border theme-transition" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                    <div className="text-2xl sm:text-3xl mb-0.5" style={{ color: stat.color, fontWeight: 700 }}>{campaignCountsReady ? stat.value : '—'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              {!campaignCountsReady && (
                <p role="status" className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Canonical campaign counts are unavailable.
                </p>
              )}
              
            </div>
          </div>

          {/* Bottom row */}
          <div className={isSupabaseConfigured ? 'grid grid-cols-1 gap-4 sm:gap-6' : 'grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6'}>
            {/* My Tasks */}
            {!isSupabaseConfigured && (
            <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
              <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33)' }}></div>
              <div className="p-5 sm:p-7">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h2 className="text-lg sm:text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>My Tasks</h2>
                </div>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Add a task..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTask() }}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
                  />
                  <button
                    onClick={addTask}
                    className="px-3 py-2 rounded-lg transition flex items-center justify-center"
                    style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {tasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No tasks yet</p>
                    </div>
                  ) : tasks.map((task) => (
                    <li key={task.id} className="group flex items-center gap-3 p-3 rounded-xl theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(task.id)}
                        className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {editingTaskId === task.id ? (
                        <input
                          type="text"
                          value={editingTaskText}
                          onChange={(e) => setEditingTaskText(e.target.value)}
                          onBlur={saveTaskEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveTaskEdit(); if (e.key === 'Escape') { setEditingTaskId(null); setEditingTaskText('') } }}
                          className="flex-1 text-sm px-2 py-0.5 border rounded outline-none"
                          style={{ borderColor: 'var(--accent)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="text-sm flex-1 cursor-pointer"
                          style={{ color: task.done ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 300, textDecoration: task.done ? 'line-through' : 'none' }}
                          onDoubleClick={() => startEditingTask(task)}
                        >
                          {task.text}
                        </span>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1 rounded-lg transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            )}

            {/* This Session */}
            <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
              <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF8C33, var(--accent))' }}></div>
              <div className="p-5 sm:p-7">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-lg sm:text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>This Session</h2>
                </div>
                {activityLog.length === 0 ? (
                  <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-sm">No activity yet</p>
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {activityLog.slice(0, 8).map((entry) => (
                      <li key={entry.id} className="p-3 rounded-xl theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
                            {entry.action}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.timestamp}</span>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{entry.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      

      {/* Announcement Popup */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }}
            onClick={() => setSelectedAnnouncement(null)}
          />
          <div className="relative rounded-2xl border p-6 sm:p-8 max-w-lg w-full theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md text-xs" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>
                  {tagFromType(selectedAnnouncement.type)}
                </span>
                <h3 className="text-xl mt-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedAnnouncement.title}</h3>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 rounded-lg transition"
                style={{ color: 'var(--accent)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{selectedAnnouncement.description}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{formatCalendarDate(selectedAnnouncement.date)}</span>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => startEditingAnnouncement(selectedAnnouncement)}
                  className="px-3 py-2 text-sm rounded-lg border transition"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => { void deleteAnnouncement(selectedAnnouncement.id) }}
                  className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-700 transition"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    const id = selectedAnnouncement.id
                    if (readAnnouncementIds.includes(id)) {
                      setReadAnnouncementIds(readAnnouncementIds.filter(i => i !== id))
                    } else {
                      setReadAnnouncementIds([...readAnnouncementIds, id])
                    }
                    setSelectedAnnouncement(null)
                  }}
                  className="px-4 py-2 text-sm rounded-lg transition exodia-btn-accent"
                >
                  {readAnnouncementIds.includes(selectedAnnouncement.id) ? 'Mark as Unread' : 'Mark as Read'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Announcement Modal */}
      {showAddAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }}
            onClick={() => setShowAddAnnouncement(false)}
          />
          <div className="relative rounded-2xl border p-6 max-w-lg w-full theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="text-xl mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Add New Announcement</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={newAnnouncement.title}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg outline-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              />
              <input
                type="date"
                value={newAnnouncement.date}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, date: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg outline-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              />
              <select
                value={newAnnouncement.tag}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, tag: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg outline-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              >
                <option value="Event">Event</option>
                <option value="Meeting">Meeting</option>
                <option value="Update">Update</option>
                <option value="Deadline">Deadline</option>
              </select>
              <textarea
                placeholder="Content"
                value={newAnnouncement.content}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2.5 border rounded-lg outline-none resize-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowAddAnnouncement(false)}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={addAnnouncement}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF', fontWeight: 500 }}
              >
                Add Announcement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {editingAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }}
            onClick={() => setEditingAnnouncement(null)}
          />
          <div className="relative rounded-2xl border p-6 max-w-lg w-full theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="text-xl mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Announcement</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={editingAnnouncement.title}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg outline-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              />
              <input
                type="date"
                value={editingAnnouncement.date}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, date: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg outline-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              />
              <select
                value={editingAnnouncement.tag}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, tag: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg outline-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              >
                <option value="Event">Event</option>
                <option value="Meeting">Meeting</option>
                <option value="Update">Update</option>
                <option value="Deadline">Deadline</option>
              </select>
              <textarea
                placeholder="Content"
                value={editingAnnouncement.content}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2.5 border rounded-lg outline-none resize-none"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setEditingAnnouncement(null)}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={saveAnnouncementEdit}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF', fontWeight: 500 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Pipeline Popup */}
      {showPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }}
            onClick={() => setShowPipeline(false)}
          />
          <div className="relative rounded-2xl border p-6 sm:p-8 max-w-4xl w-full theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-start justify-between mb-6">
              <h3 className="text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lead Pipeline Overview</h3>
              <button
                onClick={() => setShowPipeline(false)}
                className="p-1 rounded-lg transition"
                style={{ color: 'var(--accent)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={isSupabaseConfigured ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4'}>
              {[
                { label: 'Total Leads', value: leadCountReady ? leadStats.totalLeads : '—', sub: leadCountReady ? 'From all sources' : 'Canonical count unavailable', color: 'var(--text-primary)' },
                ...(!isSupabaseConfigured ? [
                  { label: 'Emails Sent', value: leadStats.emailsSent, sub: `${leadStats.totalLeads > 0 ? Math.round((leadStats.emailsSent / leadStats.totalLeads) * 100) : 0}% of total`, color: 'var(--text-primary)' },
                  { label: 'Replied', value: leadStats.replied, sub: `${leadStats.emailsSent > 0 ? Math.round((leadStats.replied / leadStats.emailsSent) * 100) : 0}% response rate`, color: 'var(--accent)' },
                  { label: 'No Reply', value: leadStats.noReply, sub: 'Follow-up needed', color: 'var(--text-primary)' },
                  { label: 'Meetings', value: leadStats.meetingsLeft, sub: 'Scheduled', color: 'var(--accent)' },
                ] : []),
              ].map((stat, i) => (
                <div key={i} className="p-5 rounded-xl border theme-transition" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                  <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{stat.label}</div>
                  <div className="text-4xl mb-2" style={{ color: stat.color, fontWeight: 700 }}>{stat.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{stat.sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Link to="/leads" className="px-6 py-2.5 text-sm rounded-lg transition exodia-btn-accent">
                View Full Pipeline
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
