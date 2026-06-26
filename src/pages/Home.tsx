import { Link } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const announcements = [
  { id: 1, title: 'Q3 Campaign Planning Kickoff', date: 'Jun 25, 2026', tag: 'Meeting', content: 'Join us for the Q3 campaign planning session where we will discuss upcoming initiatives and strategies.' },
  { id: 2, title: 'New Brand Guidelines v2.0 Released', date: 'Jun 20, 2026', tag: 'Update', content: 'The updated brand guidelines are now available. Please review and update your materials accordingly.' },
  { id: 3, title: 'Marketing Offsite - July 10-12', date: 'Jun 18, 2026', tag: 'Event', content: 'Annual marketing offsite at the mountain resort. All team members are required to attend.' },
  { id: 4, title: 'Annual Review Submissions Due July 1', date: 'Jun 15, 2026', tag: 'Deadline', content: 'Please submit your annual performance reviews by July 1st to HR.' },
]

const quickLinks = [
  { label: 'Calendar', icon: '&#128197;', to: '/calendar' },
  { label: 'Our Team', icon: '&#128101;', to: '/about#team' },
  { label: 'Submit Request', icon: '&#128221;', to: '/about#contact' },
  { label: 'Message Templates', icon: '&#128196;', to: '/templates' },
]

export default function Home() {
  const [leadStats, setLeadStats] = useState({
    totalLeads: 0,
    emailsSent: 0,
    replied: 0,
    noReply: 0,
    meetingsLeft: 0,
  })
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null)
  const [showPipeline, setShowPipeline] = useState(false)
  const [announcementsList, setAnnouncementsList] = useState(() => {
    const saved = localStorage.getItem('exodia-announcements')
    return saved ? JSON.parse(saved) : announcements
  })
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<number[]>(() => {
    const saved = localStorage.getItem('exodia-read-announcements')
    return saved ? JSON.parse(saved) : []
  })
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', date: '', tag: 'Update', content: '' })
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('exodia-tasks')
    return saved ? JSON.parse(saved) : [
      { id: 1, text: 'Review Q3 campaign proposals', done: false },
      { id: 2, text: 'Update brand guidelines document', done: false },
      { id: 3, text: 'Schedule team meeting for July', done: false },
      { id: 4, text: 'Prepare presentation for stakeholders', done: false },
    ]
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTaskText, setEditingTaskText] = useState('')

  // Persist tasks and announcements to localStorage
  useEffect(() => {
    localStorage.setItem('exodia-tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('exodia-announcements', JSON.stringify(announcementsList))
  }, [announcementsList])

  useEffect(() => {
    localStorage.setItem('exodia-read-announcements', JSON.stringify(readAnnouncementIds))
  }, [readAnnouncementIds])

  const fetchLeadStats = useCallback(async () => {
    const computeStats = (files: { id: string; name: string; columns: string[] }[], allRows: { file_id: string; data: Record<string, string> }[]) => {
      const nonDuplicateFiles = files.filter(f => f.name !== 'Duplicate Leads')
      const nonDuplicateFileIds = nonDuplicateFiles.map(f => f.id)
      if (nonDuplicateFileIds.length === 0) return { totalLeads: 0, emailsSent: 0, replied: 0, noReply: 0, meetingsLeft: 0 }

      const fileRows = allRows.filter(r => nonDuplicateFileIds.includes(r.file_id))
      let totalLeads = 0, emailsSent = 0, replied = 0, noReply = 0, meetingsLeft = 0

      fileRows.forEach((row) => {
        const data = row.data as Record<string, string>
        const file = nonDuplicateFiles.find(f => f.id === row.file_id)
        if (!file) return
        const columns = file.columns as string[]
        const companyCol = columns.find(col => col.toLowerCase().includes('company'))
        const emailStatusCol = columns.find(col => col.toLowerCase().includes('email status'))
        const leadStatusCol = columns.find(col => col.toLowerCase().includes('lead status'))

        if (companyCol && data[companyCol]?.trim()) totalLeads++
        if (emailStatusCol && data[emailStatusCol]) {
          const val = data[emailStatusCol].trim().toLowerCase()
          if (val === 'email sent' || val === 'sent') emailsSent++
        }
        if (leadStatusCol && data[leadStatusCol]) {
          const status = data[leadStatusCol].toLowerCase()
          if (status.includes('replied')) replied++
          if (status.includes('no reply')) noReply++
          if (status.includes('meeting booked')) meetingsLeft++
        }
      })

      return { totalLeads, emailsSent, replied, noReply, meetingsLeft }
    }

    if (!isSupabaseConfigured || !supabase) {
      const savedFiles = localStorage.getItem('exodia-lead-files')
      if (!savedFiles) return
      const files = JSON.parse(savedFiles)
      let allRows: { file_id: string; data: Record<string, string> }[] = []
      for (const f of files) {
        const savedRows = localStorage.getItem(`exodia-lead-rows-${f.id}`)
        if (savedRows) {
          try { allRows.push(...JSON.parse(savedRows).map((r: any) => ({ file_id: r.file_id, data: r.data }))) } catch {}
        }
      }
      setLeadStats(computeStats(files, allRows))
      return
    }

    try {
      const { data: files, error: filesError } = await supabase
        .from('lead_files')
        .select('id, name, columns')

      if (filesError) throw filesError
      if (!files || files.length === 0) return

      const nonDuplicateFiles = files.filter(f => f.name !== 'Duplicate Leads')
      const nonDuplicateFileIds = nonDuplicateFiles.map(f => f.id)

      if (nonDuplicateFileIds.length === 0) {
        setLeadStats({ totalLeads: 0, emailsSent: 0, replied: 0, noReply: 0, meetingsLeft: 0 })
        return
      }

      const { data: allRows, error: rowsError } = await supabase
        .from('lead_rows')
        .select('file_id, data')
        .in('file_id', nonDuplicateFileIds)

      if (rowsError) throw rowsError
      if (!allRows) return

      setLeadStats(computeStats(nonDuplicateFiles, allRows))
    } catch (err) {
      console.error('Error fetching lead stats:', err)
    }
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
      try { supabase.removeChannel(filesChannel) } catch {}
      try { supabase.removeChannel(rowsChannel) } catch {}
    }
  }, [fetchLeadStats])

  // Poll localStorage every 3s for lead stat changes (syncs with LeadGeneration)
  useEffect(() => {
    if (isSupabaseConfigured && supabase) return
    const interval = setInterval(fetchLeadStats, 3000)
    return () => clearInterval(interval)
  }, [fetchLeadStats])

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const addTask = () => {
    if (!newTaskText.trim()) return
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1
    setTasks([{ id: newId, text: newTaskText.trim(), done: false }, ...tasks])
    setNewTaskText('')
  }

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id))
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

  const addAnnouncement = () => {
    if (!newAnnouncement.title.trim()) return
    const newId = announcementsList.length > 0 ? Math.max(...announcementsList.map(a => a.id)) + 1 : 1
    setAnnouncementsList([{ ...newAnnouncement, id: newId }, ...announcementsList])
    setNewAnnouncement({ title: '', date: '', tag: 'Update', content: '' })
    setShowAddAnnouncement(false)
  }

  const deleteAnnouncement = (id: number) => {
    setAnnouncementsList(announcementsList.filter(a => a.id !== id))
  }

  const startEditingAnnouncement = (announcement: any) => {
    setEditingAnnouncement({ ...announcement })
  }

  const saveAnnouncementEdit = () => {
    if (!editingAnnouncement) return
    setAnnouncementsList(announcementsList.map(a => a.id === editingAnnouncement.id ? editingAnnouncement : a))
    setEditingAnnouncement(null)
  }

  return (
    <div className="min-h-screen theme-transition" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Global Search Bar */}
      <div className="sticky top-0 z-30 px-4 sm:px-6 py-3 border-b theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search templates, assets, campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none transition"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
            />
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="pt-12 pb-12 px-4 sm:px-6 text-center sm:pt-20 sm:pb-20 theme-transition" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl mb-4 sm:mb-6 tracking-tight" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            Welcome to the <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Marketing Hub</span>
          </h1>
          <p className="text-base sm:text-xl mb-6 sm:mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Your central portal for department resources, campaign requests, brand assets, and team updates.
          </p>
          <div className="flex flex-col gap-4 justify-center items-center">
            <Link to="/contact" className="px-8 py-3.5 rounded-xl transition hover:-translate-y-0.5 w-full sm:w-auto exodia-btn-primary" style={{ boxShadow: 'var(--shadow-md)' }}>
              Submit a Request
            </Link>
            <Link to="/services" className="px-8 py-3.5 rounded-xl transition hover:-translate-y-0.5 w-full sm:w-auto exodia-btn-accent">
              Marketing Capabilities
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12 sm:pb-20 -mt-6 sm:-mt-10">
        <div className="max-w-7xl mx-auto">
          {/* Announcements - Full Width */}
          <div className="rounded-2xl border p-4 sm:p-8 mb-4 sm:mb-6 theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h2 className="text-lg sm:text-xl text-left" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>&#128227; Announcements</h2>
              <button
                onClick={() => setShowAddAnnouncement(true)}
                className="p-2 rounded-lg transition flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                title="Add announcement"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <ul className="space-y-2 sm:space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {announcementsList.map((item) => (
                <li key={item.id} className="group flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 rounded-lg gap-2 sm:gap-3 theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2.5 flex-1">
                    <span className="px-2.5 py-0.5 rounded-md text-xs whitespace-nowrap" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>
                      {item.tag}
                    </span>
                    <span
                      className="text-sm cursor-pointer"
                      style={{
                        color: readAnnouncementIds.includes(item.id) ? 'var(--text-muted)' : 'var(--text-secondary)',
                        fontWeight: readAnnouncementIds.includes(item.id) ? 300 : 700,
                      }}
                      onClick={() => setSelectedAnnouncement(item)}
                    >
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{item.date}</span>
                    <button
                      onClick={() => setSelectedAnnouncement(item)}
                      className="px-3 py-1 text-xs rounded transition exodia-btn-accent"
                    >
                      View
                    </button>
                    <button
                      onClick={() => startEditingAnnouncement(item)}
                      className="p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100"
                      style={{ color: 'var(--text-muted)' }}
                      title="Edit announcement"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(item.id)}
                      className="p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 hover:bg-red-50"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete announcement"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Lead Pipeline - Clickable */}
          <div
            onClick={() => setShowPipeline(true)}
            className="block rounded-2xl border p-4 sm:p-8 mb-4 sm:mb-6 hover:shadow-md transition-all cursor-pointer theme-transition"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
          >
            <h2 className="text-lg sm:text-xl mb-4 sm:mb-6 text-left" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lead Pipeline</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {[
                { label: 'Total Leads', value: leadStats.totalLeads, sub: 'From all sources', color: 'var(--text-primary)' },
                { label: 'Emails Sent', value: leadStats.emailsSent, sub: `${leadStats.totalLeads > 0 ? Math.round((leadStats.emailsSent / leadStats.totalLeads) * 100) : 0}% of total`, color: 'var(--text-primary)' },
                { label: 'Replied', value: leadStats.replied, sub: `${leadStats.emailsSent > 0 ? Math.round((leadStats.replied / leadStats.emailsSent) * 100) : 0}% response rate`, color: 'var(--accent)' },
                { label: 'No Reply', value: leadStats.noReply, sub: 'Follow-up needed', color: 'var(--text-primary)' },
                { label: 'Meetings', value: leadStats.meetingsLeft, sub: 'Scheduled', color: 'var(--accent)' },
              ].map((stat, i) => (
                <div key={i} className="p-3 sm:p-5 rounded-xl border theme-transition" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}>
                  <div className="text-xs sm:text-sm mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{stat.label}</div>
                  <div className="text-2xl sm:text-3xl" style={{ color: stat.color, fontWeight: 700 }}>{stat.value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* My Tasks Widget */}
            <div className="rounded-2xl border p-4 sm:p-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg sm:text-xl text-left" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>&#9989; My Tasks</h2>
              </div>
              {/* Add Task Input - moved below title */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Add a new task..."
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
                  title="Add task"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <ul className="space-y-2 sm:space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <li key={task.id} className="group flex items-center gap-3 p-3 rounded-lg theme-transition" style={{ backgroundColor: 'var(--bg-secondary)' }}>
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
                        style={{
                          color: task.done ? 'var(--accent)' : 'var(--text-secondary)',
                          fontWeight: 300,
                          textDecoration: task.done ? 'line-through' : 'none'
                        }}
                        onDoubleClick={() => startEditingTask(task)}
                        title="Double-click to edit"
                      >
                        {task.text}
                      </span>
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1 rounded-lg transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete task"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div className="rounded-2xl border p-4 sm:p-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <h2 className="text-lg sm:text-xl mb-4 sm:mb-5 text-left" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>&#128279; Quick Links</h2>
              <div className="space-y-2.5">
                {quickLinks.map((link, i) => (
                  <Link key={i} to={link.to} className="flex items-center gap-2.5 p-3 rounded-lg text-sm transition theme-transition" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 300 }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    <span className="text-lg" dangerouslySetInnerHTML={{ __html: link.icon }}></span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Department Highlights */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 theme-transition" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-4xl text-center mb-2 sm:mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Department Highlights</h2>
          <p className="text-center text-base sm:text-lg mb-8 sm:mb-12" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Key metrics and focus areas for this quarter</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#127919;', title: 'Active Campaigns', desc: '12 campaigns currently running across digital, print, and event channels.' },
              { icon: '&#127912;', title: 'Brand Refresh', desc: 'New brand guidelines v2.0 are live. Review the updated assets and templates.' },
              { icon: '&#128200;', title: 'Q2 Results', desc: 'Lead generation up 23% and engagement rate improved by 18% quarter-over-quarter.' },
              { icon: '&#129309;', title: 'Cross-Team Collab', desc: 'Working with Sales, Product, and Customer Success on the Q3 go-to-market plan.' },
            ].map((item, i) => (
              <div key={i} className="p-6 sm:p-8 rounded-2xl border transition-all hover:-translate-y-1 theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: item.icon }}></div>
                <h3 className="text-base sm:text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{item.desc}</p>
              </div>
            ))}
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
                  {selectedAnnouncement.tag}
                </span>
                <h3 className="text-xl mt-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedAnnouncement.title}</h3>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 rounded-lg transition"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{selectedAnnouncement.content}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{selectedAnnouncement.date}</span>
              <button
                onClick={() => {
                  if (readAnnouncementIds.includes(selectedAnnouncement.id)) {
                    setReadAnnouncementIds(readAnnouncementIds.filter(id => id !== selectedAnnouncement.id))
                  } else {
                    setReadAnnouncementIds([...readAnnouncementIds, selectedAnnouncement.id])
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
                type="text"
                placeholder="Date (e.g., Jun 25, 2026)"
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
                <option value="Meeting">Meeting</option>
                <option value="Update">Update</option>
                <option value="Event">Event</option>
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
                type="text"
                placeholder="Date (e.g., Jun 25, 2026)"
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
                <option value="Meeting">Meeting</option>
                <option value="Update">Update</option>
                <option value="Event">Event</option>
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
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {[
                { label: 'Total Leads', value: leadStats.totalLeads, sub: 'From all sources', color: 'var(--text-primary)' },
                { label: 'Emails Sent', value: leadStats.emailsSent, sub: `${leadStats.totalLeads > 0 ? Math.round((leadStats.emailsSent / leadStats.totalLeads) * 100) : 0}% of total`, color: 'var(--text-primary)' },
                { label: 'Replied', value: leadStats.replied, sub: `${leadStats.emailsSent > 0 ? Math.round((leadStats.replied / leadStats.emailsSent) * 100) : 0}% response rate`, color: 'var(--accent)' },
                { label: 'No Reply', value: leadStats.noReply, sub: 'Follow-up needed', color: 'var(--text-primary)' },
                { label: 'Meetings', value: leadStats.meetingsLeft, sub: 'Scheduled', color: 'var(--accent)' },
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
