import { Link } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const announcements = [
  { id: 1, title: 'Q3 Campaign Planning Kickoff', date: 'Jun 25, 2026', tag: 'Meeting' },
  { id: 2, title: 'New Brand Guidelines v2.0 Released', date: 'Jun 20, 2026', tag: 'Update' },
  { id: 3, title: 'Marketing Offsite - July 10-12', date: 'Jun 18, 2026', tag: 'Event' },
  { id: 4, title: 'Annual Review Submissions Due July 1', date: 'Jun 15, 2026', tag: 'Deadline' },
]

const quickLinks = [
  { label: 'Submit Campaign Request', icon: '&#128221;', href: '/contact' },
  { label: 'Brand Assets & Guidelines', icon: '&#128193;', href: '#' },
  { label: 'Campaign Calendar', icon: '&#128197;', href: '#' },
  { label: 'Performance Dashboard', icon: '&#128200;', href: '#' },
  { label: 'Content Templates', icon: '&#128196;', href: '#' },
  { label: 'Team Wiki', icon: '&#128218;', href: '#' },
]

export default function Home() {
  const [leadStats, setLeadStats] = useState({
    totalLeads: 0,
    emailsSent: 0,
    replied: 0,
    noReply: 0,
    meetingsLeft: 0,
  })

  const fetchLeadStats = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return

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

      const totalLeads = allRows.length
      let emailsSent = 0
      let replied = 0
      let noReply = 0
      let meetingsLeft = 0

      allRows.forEach((row) => {
        const data = row.data as Record<string, string>
        const file = nonDuplicateFiles.find(f => f.id === row.file_id)
        if (!file) return

        const columns = file.columns as string[]
        const emailStatusCol = columns.find(col => col.toLowerCase().includes('email status'))
        const leadStatusCol = columns.find(col => col.toLowerCase().includes('lead status'))

        if (emailStatusCol && data[emailStatusCol]?.trim()) {
          emailsSent++
        }

        if (leadStatusCol && data[leadStatusCol]) {
          const status = data[leadStatusCol].toLowerCase()
          if (status.includes('replied')) replied++
          if (status.includes('no reply')) noReply++
          if (status.includes('meeting booked')) meetingsLeft++
        }
      })

      setLeadStats({ totalLeads, emailsSent, replied, noReply, meetingsLeft })
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
      supabase.removeChannel(filesChannel)
      supabase.removeChannel(rowsChannel)
    }
  }, [fetchLeadStats])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
      <section className="pt-20 pb-12 px-4 sm:px-6 text-center sm:pt-32 sm:pb-20" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4 sm:mb-6 tracking-tight" style={{ color: '#1B1A1C' }}>
            Welcome to the <span style={{ color: '#3E4048' }}>Marketing Hub</span>
          </h1>
          <p className="text-base sm:text-xl mb-6 sm:mb-10 leading-relaxed" style={{ color: '#3E4048' }}>
            Your central portal for department resources, campaign requests, brand assets, and team updates.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/contact" className="px-8 py-3.5 text-white font-semibold rounded-xl transition hover:-translate-y-0.5" style={{ backgroundColor: '#1B1A1C', boxShadow: '0 10px 15px -3px rgba(27,26,28,0.2)' }}>
              Submit a Request
            </Link>
            <Link to="/services" className="px-8 py-3.5 font-semibold rounded-xl border-2 transition hover:-translate-y-0.5" style={{ backgroundColor: '#FFFFFF', color: '#1B1A1C', borderColor: '#CACDD7' }}>
              Our Services
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12 sm:pb-20 -mt-6 sm:-mt-10">
        <div className="max-w-7xl mx-auto">
          <Link to="/leads" className="block rounded-2xl border p-4 sm:p-8 mb-4 sm:mb-6 hover:shadow-md transition-all cursor-pointer" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-left" style={{ color: '#1B1A1C' }}>Lead Pipeline</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              <div className="p-3 sm:p-5 rounded-xl border" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                <div className="text-xs sm:text-sm mb-1" style={{ color: '#3E4048' }}>Total Leads</div>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#1B1A1C' }}>{leadStats.totalLeads}</div>
                <div className="text-xs mt-1" style={{ color: '#CACDD7' }}>From all sources</div>
              </div>
              <div className="p-3 sm:p-5 rounded-xl border" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                <div className="text-xs sm:text-sm mb-1" style={{ color: '#3E4048' }}>Emails Sent</div>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#1B1A1C' }}>{leadStats.emailsSent}</div>
                <div className="text-xs mt-1" style={{ color: '#CACDD7' }}>{leadStats.totalLeads > 0 ? Math.round((leadStats.emailsSent / leadStats.totalLeads) * 100) : 0}% of total</div>
              </div>
              <div className="p-3 sm:p-5 rounded-xl border" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                <div className="text-xs sm:text-sm mb-1" style={{ color: '#3E4048' }}>Replied</div>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#FF5900' }}>{leadStats.replied}</div>
                <div className="text-xs mt-1" style={{ color: '#CACDD7' }}>{leadStats.emailsSent > 0 ? Math.round((leadStats.replied / leadStats.emailsSent) * 100) : 0}% response rate</div>
              </div>
              <div className="p-3 sm:p-5 rounded-xl border" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                <div className="text-xs sm:text-sm mb-1" style={{ color: '#3E4048' }}>No Reply</div>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#1B1A1C' }}>{leadStats.noReply}</div>
                <div className="text-xs mt-1" style={{ color: '#CACDD7' }}>Follow-up needed</div>
              </div>
              <div className="p-3 sm:p-5 rounded-xl border col-span-2 sm:col-span-1" style={{ backgroundColor: 'rgba(202,205,215,0.15)', borderColor: '#CACDD7' }}>
                <div className="text-xs sm:text-sm mb-1" style={{ color: '#3E4048' }}>Meetings</div>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#FF5900' }}>{leadStats.meetingsLeft}</div>
                <div className="text-xs mt-1" style={{ color: '#CACDD7' }}>Scheduled</div>
              </div>
            </div>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="rounded-2xl border p-4 sm:p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
              <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-5 text-left" style={{ color: '#1B1A1C' }}>&#128227; Announcements</h2>
              <ul className="space-y-2 sm:space-y-3">
                {announcements.map((item) => (
                  <li key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 rounded-lg gap-2 sm:gap-3" style={{ backgroundColor: 'rgba(202,205,215,0.15)' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: 'rgba(255,89,0,0.1)', color: '#FF5900' }}>
                        {item.tag}
                      </span>
                      <span className="text-sm font-medium" style={{ color: '#3E4048' }}>{item.title}</span>
                    </div>
                    <span className="text-xs whitespace-nowrap sm:text-right" style={{ color: '#CACDD7' }}>{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border p-4 sm:p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
              <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-5 text-left" style={{ color: '#1B1A1C' }}>&#128279; Quick Links</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {quickLinks.map((link, i) => (
                  <a key={i} href={link.href} className="flex items-center gap-2.5 p-3 rounded-lg text-sm font-medium transition" style={{ backgroundColor: 'rgba(202,205,215,0.15)', color: '#3E4048' }}>
                    <span className="text-lg" dangerouslySetInnerHTML={{ __html: link.icon }}></span>
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-bold text-center mb-2 sm:mb-3" style={{ color: '#1B1A1C' }}>Department Highlights</h2>
          <p className="text-center text-base sm:text-lg mb-8 sm:mb-12" style={{ color: '#3E4048' }}>Key metrics and focus areas for this quarter</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#127919;', title: 'Active Campaigns', desc: '12 campaigns currently running across digital, print, and event channels.' },
              { icon: '&#127912;', title: 'Brand Refresh', desc: 'New brand guidelines v2.0 are live. Review the updated assets and templates.' },
              { icon: '&#128200;', title: 'Q2 Results', desc: 'Lead generation up 23% and engagement rate improved by 18% quarter-over-quarter.' },
              { icon: '&#129309;', title: 'Cross-Team Collab', desc: 'Working with Sales, Product, and Customer Success on the Q3 go-to-market plan.' },
            ].map((item, i) => (
              <div key={i} className="p-6 sm:p-8 rounded-2xl border transition-all hover:-translate-y-1" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: item.icon }}></div>
                <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: '#1B1A1C' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#3E4048' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
