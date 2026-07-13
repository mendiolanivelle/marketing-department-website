import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface ProjectTicket {
  id: string
  tracking_id: string
  project_name: string
  client_name: string
  email_to: string
  email_subject: string
  email_body: string
  additional_attachments: string[]
  ticket_link: string
  status: string
  created_at: string
}

export default function ProjectList() {
  const [tickets, setTickets] = useState<ProjectTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<ProjectTicket | null>(null)

  const fetchTickets = async () => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('project_review_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) setTickets(data)
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTickets() }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Project List</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Marketing View &middot; Review tickets sent to Operations</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tickets sent yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => setSelectedTicket(selectedTicket?.id === ticket.id ? null : ticket)}
              className="rounded-xl border p-4 sm:p-5 transition-all hover:shadow-sm cursor-pointer"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: selectedTicket?.id === ticket.id ? 'var(--accent)' : 'var(--border-primary)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>{ticket.tracking_id}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: ticket.status === 'Sent' ? '#E8F5E9' : '#FFF3E0', color: ticket.status === 'Sent' ? '#2E7D32' : '#E65100' }}>{ticket.status}</span>
                  </div>
                  <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ticket.project_name || 'Untitled'}</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                    {ticket.client_name ? `${ticket.client_name} · ` : ''}{ticket.email_to} · {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0 transition-transform mt-1" style={{ color: 'var(--text-muted)', transform: selectedTicket?.id === ticket.id ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {selectedTicket?.id === ticket.id && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-secondary)' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Subject</p>
                      <p style={{ color: 'var(--text-primary)' }}>{ticket.email_subject}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Sent To</p>
                      <p style={{ color: 'var(--text-primary)' }}>{ticket.email_to}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Body</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{ticket.email_body}</p>
                  </div>
                  {ticket.additional_attachments?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {ticket.additional_attachments.map((link, i) => (
                          <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--accent)' }}>{link}</a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}