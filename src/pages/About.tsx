import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { logActivity } from '../lib/activityLogger'

interface TeamMember {
  id: number
  name: string
  role: string
  email: string
  photoUrl?: string
}

const defaultMembers: TeamMember[] = [
  { id: 1, name: 'Maxene Pableo', role: 'Marketing Dept Head', email: 'maxene@exodiagamedev.com' },
  { id: 2, name: 'Sarah Chen', role: 'VP of Marketing', email: 'sarah@exodiagamedev.com' },
  { id: 3, name: 'Marcus Johnson', role: 'Creative Director', email: 'marcus@exodiagamedev.com' },
  { id: 4, name: 'Emily Rodriguez', role: 'Digital Marketing Manager', email: 'emily@exodiagamedev.com' },
]

function getInitials(name: string) {
  return name.split(' ').map(w => w.charAt(0)).join('').toUpperCase()
}

export default function About() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('exodia-team-directory')
    return saved ? JSON.parse(saved) : defaultMembers
  })
  const [editingEmail, setEditingEmail] = useState<{ id: number; email: string } | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', role: '', email: '' })
  const [newMemberPhoto, setNewMemberPhoto] = useState<string | null>(null)
  const memberFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem('exodia-team-directory', JSON.stringify(teamMembers))
  }, [teamMembers])

  const addMember = () => {
    if (!newMember.name.trim()) return
    const id = teamMembers.length > 0 ? Math.max(...teamMembers.map(m => m.id)) + 1 : 1
    setTeamMembers([...teamMembers, { ...newMember, id, photoUrl: newMemberPhoto || undefined }])
    setNewMember({ name: '', role: '', email: '' })
    setNewMemberPhoto(null)
    setShowAddMember(false)
    logActivity('Team', `Added member "${newMember.name.trim()}"`)
  }

  const deleteMember = (id: number) => {
    const member = teamMembers.find(m => m.id === id)
    setTeamMembers(teamMembers.filter(m => m.id !== id))
    if (member) logActivity('Team', `Removed "${member.name}"`)
  }

  const saveEmail = () => {
    if (!editingEmail) return
    setTeamMembers(teamMembers.map(m => m.id === editingEmail.id ? { ...m, email: editingEmail.email } : m))
    setEditingEmail(null)
  }

  const handlePhotoUpload = (id: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0]
      if (file) {
        const r = new FileReader()
        r.onloadend = () => {
          setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, photoUrl: r.result as string } : m))
        }
        r.readAsDataURL(file)
      }
    }
    input.click()
  }

  const removePhoto = (id: number) => {
    setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, photoUrl: undefined } : m))
  }

  return (
    <div>
      {/* Company Info Header */}
      <section
        className="relative py-16 sm:py-20 px-4 sm:px-6 text-center overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="w-20 h-20 mx-auto mb-6">
            <svg width="100%" viewBox="0 0 680 680" role="img" xmlns="http://www.w3.org/2000/svg">
              <title>Exodia logo</title>
              <g transform="translate(340,340)" fill="#FF5900">
                <polygon points="-175,-220 -5,-120 -5,-220 -175,-320" />
                <polygon points="5,-120 175,-220 175,-320 5,-220" />
                <polygon points="-165,-110 0,-20 165,-110 0,-200" />
                <polygon points="-175,-90 -175,90 0,180 0,0" />
                <polygon points="175,-90 175,90 0,180 0,0" />
                <polygon points="-175,110 -5,210 -5,110 -175,10" />
                <polygon points="5,110 175,10 175,110 5,210" />
              </g>
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl mb-6 tracking-tight" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            Team & Directory
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto mb-6">
            <div className="p-5 rounded-xl border theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent)' }}>Our Vision</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                Making Cebu the 2nd choice when an international client want to outsource game development in the Philippines
              </p>
            </div>
            <div className="p-5 rounded-xl border theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent)' }}>Our Mission</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                To be the 1st Game Dev Company in Cebu who provides manpower outsourcing for AAA companies in the year 2028
              </p>
            </div>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF', fontWeight: 500 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Exodia Brand Guidelines
          </a>
        </div>
      </section>

      {/* Exodia Values */}
      <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl text-center mb-10" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            Exodia Values
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Client Happiness',
                desc: 'To deliver our commitments systematically and skillfully, achieving quality output that are delivered on time.',
                icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
              },
              {
                title: 'Employee Happiness',
                desc: 'To continuously develop AAA quality skills and foster interpersonal development skills.',
                icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
              },
              {
                title: 'Company Happiness',
                desc: 'To create a lifelong livelihood for the employees of Exodia and always seek ways to help companies who want to craft games.',
                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              },
            ].map((value, i) => (
              <div
                key={i}
                className="p-6 sm:p-8 rounded-2xl border-2 text-center transition-all hover:-translate-y-1 hover:shadow-lg theme-transition"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
              >
                <svg className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d={value.icon} />
                </svg>
                <h3 className="text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketing Team Grid */}
      <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              Marketing Team
            </h2>
            <button
              onClick={() => setShowAddMember(true)}
              className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Member
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="group rounded-2xl border-2 p-6 text-center transition-all duration-200 hover:shadow-lg theme-transition"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: 'var(--border-primary)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5900' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
              >
                {/* Photo */}
                <div className="relative w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden cursor-pointer group/avatar"
                  style={{ backgroundColor: 'var(--btn-primary-bg)' }}
                  onClick={() => handlePhotoUpload(member.id)}
                >
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xl" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>
                      {getInitials(member.name)}
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>

                {/* Name */}
                <h3 className="text-base mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                  {member.name}
                </h3>

                {/* Role */}
                <p className="text-sm mb-3" style={{ color: '#9CA3AF', fontWeight: 400 }}>
                  {member.role}
                </p>

                {/* Contact - Editable Email */}
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {editingEmail?.id === member.id ? (
                    <input
                      type="email"
                      value={editingEmail.email}
                      onChange={(e) => setEditingEmail({ ...editingEmail, email: e.target.value })}
                      onBlur={saveEmail}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEmail(); if (e.key === 'Escape') setEditingEmail(null) }}
                      className="text-xs px-2 py-0.5 border rounded outline-none w-full max-w-[160px] text-center"
                      style={{ borderColor: 'var(--accent)', color: 'var(--text-primary)' }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-xs cursor-pointer hover:underline truncate max-w-[160px]"
                      style={{ color: 'var(--text-muted)', fontWeight: 300 }}
                      onClick={() => setEditingEmail({ id: member.id, email: member.email })}
                      title="Click to edit email"
                    >
                      {member.email}
                    </span>
                  )}
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-center gap-2">
                  <Link
                    to={member.email ? `/templates?to=${encodeURIComponent(member.email)}` : '/templates'}
                    className="px-4 py-1.5 text-xs rounded-lg border transition hover:-translate-y-0.5"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 500 }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = '#FFFFFF' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--accent)' }}
                  >
                    Message
                  </Link>
                  <button
                    onClick={() => deleteMember(member.id)}
                    className="p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100"
                    style={{ color: 'var(--text-muted)' }}
                    title="Remove member"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddMember(false)}>
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Add Team Member</h3>
            <div className="flex justify-center mb-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer" style={{ backgroundColor: 'var(--btn-primary-bg)' }}
                onClick={() => memberFileRef.current?.click()}>
                {newMemberPhoto ? <img src={newMemberPhoto} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-2xl" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>+</span>}
              </div>
              <input ref={memberFileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setNewMemberPhoto(r.result as string); r.readAsDataURL(f) } }} className="hidden" />
            </div>
            <input type="text" placeholder="Full Name" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <input type="text" placeholder="Role (e.g. Creative Director)" value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
            <input type="email" placeholder="Email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4" style={{ borderColor: 'var(--border-primary)' }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddMember(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addMember} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* CTA + Working Hours */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-start">
          <div>
            <h2 id="contact" className="text-2xl sm:text-4xl mb-4" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>Reach Out to Us</h2>
            <p className="text-sm sm:text-base mb-5 leading-relaxed" style={{ color: 'var(--btn-primary-text)', opacity: 0.8, fontWeight: 300 }}>
              Need marketing support? Have a question about brand guidelines? Reach us through the channels below.
            </p>
            <div className="space-y-3 mb-6">
              {[
                { icon: '📧', title: 'Email', info: 'marketing@exodiagamedev.com' },
                { icon: '💬', title: 'Slack', info: '#marketing-requests' },
                { icon: '📍', title: 'Office', info: 'Floor 4, Room 412' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ backgroundColor: 'var(--accent)' }}>{item.icon}</div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--btn-primary-text)', fontWeight: 500 }}>{item.title}</p>
                    <p className="text-xs" style={{ color: 'var(--btn-primary-text)', opacity: 0.7, fontWeight: 300 }}>{item.info}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const form = e.target as HTMLFormElement; const data = Object.fromEntries(new FormData(form)); localStorage.setItem('exodia-contact-submission', JSON.stringify({ ...data, date: new Date().toISOString() })); alert('Request submitted!'); form.reset(); logActivity('Team', `Contact form submitted by "${data.name}"`) }} className="space-y-2.5">
              <input name="name" required placeholder="Your Name" className="w-full px-3.5 py-2 rounded-lg outline-none text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              <input name="email" required placeholder="Your Email" className="w-full px-3.5 py-2 rounded-lg outline-none text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              <textarea name="message" required rows={2} placeholder="Briefly describe your request..." className="w-full px-3.5 py-2 rounded-lg outline-none text-sm resize-none" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              <button type="submit" className="px-5 py-2 text-sm rounded-lg transition border-2" style={{ color: 'var(--btn-primary-text)', borderColor: 'var(--btn-primary-text)', fontWeight: 500 }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--btn-primary-text)'; e.currentTarget.style.borderColor = 'var(--btn-primary-text)' }}
              >Send Message</button>
            </form>
          </div>
          <div className="rounded-2xl p-6 sm:p-10" style={{ backgroundColor: 'var(--accent)' }}>
            <h3 className="text-xl sm:text-2xl text-white mb-5 sm:mb-6" style={{ fontWeight: 700 }}>Working Hours</h3>
            <div className="space-y-3">
              {['Monday','Tuesday','Wednesday','Thursday','Friday'].map((day) => (
                <div key={day} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                  <span className="text-white text-sm sm:text-base" style={{ fontWeight: 500 }}>{day}</span>
                  <span className="text-white/80 text-sm sm:text-base" style={{ fontWeight: 300 }}>9:00 AM – 6:00 PM</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 pt-3 mt-3 border-t border-white/20">
                <span className="text-white text-sm sm:text-base" style={{ fontWeight: 500 }}>Saturday – Sunday</span>
                <span className="text-white/60 text-sm" style={{ fontWeight: 300 }}>Closed</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}