import { useState, useMemo, useCallback, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'

type ItemType = 'event' | 'task' | 'meeting'

interface CalendarItem {
  id: string
  title: string
  type: ItemType
  date: string
  start_time: string | null
  end_time: string | null
  description: string | null
  location: string | null
  color: string
  assignees: string[]
  notes: string
  created_at: string
  updated_at: string
}

interface FormData {
  title: string
  type: ItemType
  date: string
  start_time: string
  end_time: string
  description: string
  location: string
  color: string
  assignees: string[]
  notes: string
}

const TYPE_CONFIG: Record<ItemType, { label: string; color: string; icon: string }> = {
  event: { label: 'Event', color: '#0B8043', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  task: { label: 'Task', color: '#1a73e8', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  meeting: { label: 'Meeting', color: '#FF5900', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDateKey(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function formatTime(time: string | null) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

const defaultForm: FormData = {
  title: '',
  type: 'event',
  date: '',
  start_time: '',
  end_time: '',
  description: '',
  location: '',
color: '#0B8043',
  assignees: [],
  notes: '',
}

export default function Calendar() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null)
  const [viewItem, setViewItem] = useState<CalendarItem | null>(null)
  const [editingNotes, setEditingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [form, setForm] = useState<FormData>({ ...defaultForm })
  const [assigneeInput, setAssigneeInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    // Always merge local calendar items (from Campaigns page, etc.)
    let localItems: CalendarItem[] = []
    const saved = localStorage.getItem('exodia-calendar-items')
    if (saved) {
      try { localItems = JSON.parse(saved) } catch {}
    }

    if (!isSupabaseConfigured || !supabase) {
      setItems(localItems)
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('calendar_items')
        .select('*')
        .order('date', { ascending: true })
      if (error) throw error
      if (data) {
        // Merge Supabase data with local items (local items take precedence)
        const supabaseIds = new Set(data.map((i: CalendarItem) => i.id))
        const merged = [...data, ...localItems.filter(i => !supabaseIds.has(i.id))]
        setItems(merged)
        localStorage.setItem('exodia-calendar-items', JSON.stringify(merged))
      }
    } catch (err) {
      console.error('Error fetching calendar items:', err)
      setItems(localItems)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()

    // Listen for real-time updates from Supabase
    if (!isSupabaseConfigured || !supabase) return

    const channel = supabase
      .channel('calendar_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_items' }, () => {
        fetchItems()
      })
      .subscribe()

    return () => {
      try { supabase?.removeChannel(channel) } catch {}
    }
  }, [fetchItems])

  // Listen for calendar updates from other pages (e.g. Campaigns)
  useEffect(() => {
    const handler = () => { fetchItems() }
    window.addEventListener('calendar-updated', handler)
    return () => window.removeEventListener('calendar-updated', handler)
  }, [fetchItems])

  // Persist items to localStorage (skip initial empty write before first fetch completes)
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('exodia-calendar-items', JSON.stringify(items))
    }
  }, [items, loading])

  // Sync viewItem when items refresh (e.g. campaign status update)
  useEffect(() => {
    if (viewItem) {
      const updated = items.find(i => i.id === viewItem.id)
      if (updated) setViewItem(updated)
    }
  }, [items])

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    const handler = () => fetchItems()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [fetchItems])

  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {}
    items.forEach((item) => {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    })
    return map
  }, [items])

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)

    const days: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month: currentMonth, year: currentYear, isCurrentMonth: true })
    }
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, month: nextMonth, year: nextYear, isCurrentMonth: false })
    }
    return days
  }, [currentYear, currentMonth])

  const goToPrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
    else { setCurrentMonth(currentMonth - 1) }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
    else { setCurrentMonth(currentMonth + 1) }
  }

  const goToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

  const isToday = (year: number, month: number, day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const openCreateModal = (date?: string) => {
    setEditingItem(null)
    setForm({ ...defaultForm, date: date || formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()) })
    setAssigneeInput('')
    setShowModal(true)
  }

  const openEditModal = (item: CalendarItem) => {
    setEditingItem(item)
    setForm({
      title: item.title,
      type: item.type,
      date: item.date,
      start_time: item.start_time || '',
      end_time: item.end_time || '',
      description: item.description || '',
      location: item.location || '',
      color: item.color,
      assignees: item.assignees || [],
      notes: item.notes || '',
    })
    setAssigneeInput('')
    setShowModal(true)
  }

  const openViewItem = (item: CalendarItem) => {
    setViewItem(item)
    setEditingNotes(item.notes || '')
  }

  const saveNotes = async () => {
    if (!viewItem || !supabase) return
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('calendar_items')
        .update({ notes: editingNotes })
        .eq('id', viewItem.id)
      if (error) throw error
      setViewItem({ ...viewItem, notes: editingNotes })
      setItems(prev => prev.map(i => i.id === viewItem.id ? { ...i, notes: editingNotes } : i))
    } catch (err) {
      console.error('Error saving notes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  const handleTypeChange = (type: ItemType) => {
    setForm({ ...form, type, color: TYPE_CONFIG[type].color })
  }

  const addAssignee = () => {
    const email = assigneeInput.trim().toLowerCase()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !form.assignees.includes(email)) {
      setForm({ ...form, assignees: [...form.assignees, email] })
      setAssigneeInput('')
    }
  }

  const removeAssignee = (email: string) => {
    setForm({ ...form, assignees: form.assignees.filter(a => a !== email) })
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    setSubmitting(true)

    const payload = {
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      color: form.color,
      assignees: form.assignees,
      notes: form.notes || '',
    }

    try {
      const now = new Date().toISOString()
      if (isSupabaseConfigured && supabase) {
        if (editingItem) {
          const { error } = await supabase
            .from('calendar_items')
            .update({ ...payload, updated_at: now })
            .eq('id', editingItem.id)
          if (error) throw error
          setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload, updated_at: now } as CalendarItem : i))
        } else {
          const id = crypto.randomUUID()
          const newItem: CalendarItem = { id, ...payload, created_at: now, updated_at: now }
          const { error } = await supabase
            .from('calendar_items')
            .insert([newItem])
          if (error) throw error
          setItems(prev => [...prev, newItem])
        }
      } else {
        if (editingItem) {
          setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload, updated_at: now } as CalendarItem : i))
        } else {
          const id = crypto.randomUUID()
          const newItem: CalendarItem = { id, ...payload, created_at: now, updated_at: now }
          setItems(prev => [...prev, newItem])
        }
      }
      setShowModal(false)
      setEditingItem(null)
      setForm({ ...defaultForm })
      logActivity('Calendar', editingItem ? `Updated "${payload.title}" (${payload.type})` : `Created "${payload.title}" (${payload.type})`)
    } catch (err) {
      console.error('Error saving calendar item:', err)
      alert('Failed to save item')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return
    const item = items.find(i => i.id === id)
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('calendar_items')
          .delete()
          .eq('id', id)
        if (error) throw error
      }
      setItems(prev => prev.filter(i => i.id !== id))
      if (item) logActivity('Calendar', `Deleted "${item.title}"`)
    } catch (err) {
      console.error('Error deleting calendar item:', err)
      alert('Failed to delete item')
    }
  }

  const selectedItems = selectedDate ? itemsByDate[selectedDate] || [] : []

  const rows: (typeof calendarDays)[] = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    rows.push(calendarDays.slice(i, i + 7))
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(27,26,28,0.06)] border border-[#E5E7EB] overflow-hidden">
          {/* Orange gradient accent bar */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-b border-[#E5E7EB] gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1B1A1C]">
                {MONTHS[currentMonth]} {currentYear}
              </h1>
              <div className="flex items-center gap-1">
                <button onClick={goToPrevMonth} className="p-1.5 hover:bg-orange-50 rounded-full transition">
                  <svg className="w-5 h-5 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button onClick={goToNextMonth} className="p-1.5 hover:bg-orange-50 rounded-full transition">
                  <svg className="w-5 h-5 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={goToToday}
                className="px-4 py-1.5 text-sm font-medium text-[#FF5900] border border-[#FF5900] rounded-lg hover:bg-orange-50 transition"
              >
                Today
              </button>
              <button
                onClick={() => openCreateModal()}
                className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition flex items-center gap-1.5 hover:-translate-y-0.5"
                style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.25)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[#E5E7EB]">
            {DAYS.map((day) => (
              <div key={day} className="py-2.5 text-center text-xs sm:text-sm font-semibold text-[#6B7280] uppercase tracking-wider">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[80px] sm:min-h-[110px] border-b border-r border-[#E5E7EB] p-1 sm:p-1.5 animate-pulse" style={{ backgroundColor: '#F9FAFB' }}>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-200 mb-1"></div>
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {rows.map((week, weekIdx) =>
                week.map((dayInfo) => {
                  const dateKey = formatDateKey(dayInfo.year, dayInfo.month, dayInfo.day)
                  const dayItems = itemsByDate[dateKey] || []
                  const todayFlag = isToday(dayInfo.year, dayInfo.month, dayInfo.day)
                  const isSelected = selectedDate === dateKey

                  return (
                    <div
                      key={`${weekIdx}-${dayInfo.day}`}
                      onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
                      className={`
                        min-h-[80px] sm:min-h-[110px] border-b border-r border-[#E5E7EB] p-1 sm:p-1.5 cursor-pointer transition-all
                        ${!dayInfo.isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'}
                        ${isSelected ? 'bg-orange-50/50 ring-1 ring-inset ring-[#FF5900]/20' : ''}
                        hover:bg-orange-50/30
                      `}
                    >
                      <div className="flex justify-between items-start mb-0.5">
                        <span
                          className={`
                            inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm rounded-full
                            ${todayFlag ? 'bg-[#FF5900] text-white font-bold shadow-sm' : ''}
                            ${!todayFlag && dayInfo.isCurrentMonth ? 'text-[#1B1A1C] font-medium' : ''}
                            ${!todayFlag && !dayInfo.isCurrentMonth ? 'text-[#CACDD7]' : ''}
                          `}
                        >
                          {dayInfo.day}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); openCreateModal(dateKey) }}
                          className="hidden sm:flex w-5 h-5 items-center justify-center rounded-full hover:bg-orange-100 transition opacity-0 group-hover:opacity-100"
                          title="Add item"
                        >
                          <svg className="w-3 h-3 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {dayItems.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate font-medium text-white cursor-pointer hover:opacity-90 transition shadow-sm"
                            style={{ backgroundColor: item.color }}
                            onClick={(e) => { e.stopPropagation(); openViewItem(item) }}
                          >
                            <svg className="w-3 h-3 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TYPE_CONFIG[item.type].icon} />
                            </svg>
                            <span className="truncate">{item.title}</span>
                          </div>
                        ))}
                        {dayItems.slice(0, 2).map((item) => (
                          <div
                            key={`m-${item.id}`}
                            className="sm:hidden flex items-center justify-center w-5 h-5 rounded-full mx-auto shadow-sm"
                            style={{ backgroundColor: item.color }}
                            title={`${TYPE_CONFIG[item.type].label}: ${item.title}`}
                          />
                        ))}
                        {dayItems.length > 3 && (
                          <div className="hidden sm:block text-xs text-[#6B7280] font-medium px-1">
                            +{dayItems.length - 3} more
                          </div>
                        )}
                        {dayItems.length > 2 && (
                          <div className="sm:hidden text-xs text-[#6B7280] text-center font-medium">
                            +{dayItems.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Item Detail Popup */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setViewItem(null)} />
          <div className="relative rounded-2xl border w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', maxWidth: '600px' }}>
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: viewItem.color }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TYPE_CONFIG[viewItem.type].icon} />
                    </svg>
                    {TYPE_CONFIG[viewItem.type].label}
                  </span>
                </div>
                <h3 className="text-xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{viewItem.title}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                  {new Date(viewItem.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => { openEditModal(viewItem); setViewItem(null) }}
                  className="p-2 rounded-lg transition"
                  style={{ color: 'var(--accent)' }}
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => { handleDelete(viewItem.id); setViewItem(null) }}
                  className="p-2 rounded-lg transition"
                  style={{ color: 'var(--accent)' }}
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewItem(null)}
                  className="p-2 rounded-lg transition"
                  style={{ color: 'var(--accent)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Time & Location */}
              {(viewItem.start_time || viewItem.location) && (
                <div className="flex flex-wrap gap-4">
                  {viewItem.start_time && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                        {formatTime(viewItem.start_time)}{viewItem.end_time ? ` - ${formatTime(viewItem.end_time)}` : ''}
                      </span>
                    </div>
                  )}
                  {viewItem.location && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{viewItem.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {viewItem.description && (
                <div>
                  <h4 className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Description</h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{viewItem.description}</p>
                </div>
              )}

              {/* Assignees */}
              {viewItem.assignees && viewItem.assignees.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Assigned To</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {viewItem.assignees.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                      >
                        <svg className="w-3 h-3" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes - Editable */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Notes</h4>
                  {editingNotes !== viewItem.notes && (
                    <button
                      onClick={saveNotes}
                      disabled={savingNotes}
                      className="text-xs px-2 py-0.5 rounded transition disabled:opacity-50"
                      style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-light)', fontWeight: 500 }}
                    >
                      {savingNotes ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
                  placeholder="Add notes..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#E5E7EB]">
            <div className="sticky top-0 bg-white px-6 py-4 flex items-center justify-between rounded-t-2xl border-b border-[#E5E7EB]">
              <h2 className="text-lg font-bold text-[#1B1A1C]">
                {editingItem ? 'Edit Item' : 'Create New Item'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-orange-50 rounded-full transition">
                <svg className="w-5 h-5 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TYPE_CONFIG) as ItemType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={`
                        flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition
                        ${form.type === type
                          ? 'border-current text-white shadow-sm'
                          : 'border-[#D1D5DB] text-[#374151] hover:border-[#D1D5DB]'
                        }
                      `}
                      style={form.type === type ? { backgroundColor: TYPE_CONFIG[type].color, borderColor: TYPE_CONFIG[type].color } : {}}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TYPE_CONFIG[type].icon} />
                      </svg>
                      {TYPE_CONFIG[type].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm" placeholder="Enter title..." autoFocus />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm" />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">Start Time</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">End Time</label>
                  <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm" />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm" placeholder="e.g., Conference Room A, Zoom" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm resize-none" placeholder="Add details..." />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm resize-none" placeholder="Add notes..." />
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Assign People</label>
                <div className="flex gap-2">
                  <input type="email" value={assigneeInput} onChange={(e) => setAssigneeInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAssignee() } }} className="flex-1 px-3 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#ff5900] focus:border-transparent outline-none transition text-sm" placeholder="Enter email address..." />
                  <button type="button" onClick={addAssignee} className="px-3 py-2.5 bg-[#1B1A1C] hover:bg-[#1B1A1C] text-white rounded-lg transition text-sm font-semibold">Add</button>
                </div>
                {form.assignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {form.assignees.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-[#374151] rounded-full text-xs font-medium">
                        <svg className="w-3 h-3 text-[#FF5900]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {email}
                        <button type="button" onClick={() => removeAssignee(email)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-300 transition">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-white border-t border-[#E5E7EB] px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
              <button onClick={handleSubmit} disabled={!form.title.trim() || submitting} className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" style={{ backgroundColor: '#FF5900' }}>
                {submitting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
