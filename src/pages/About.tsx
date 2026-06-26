import { useState, useEffect, useRef } from 'react'

interface TeamMember {
  id: number
  name: string
  role: string
  bio: string
  initials: string
  photoUrl?: string
}

interface OpenRole {
  id: number
  title: string
  type: string
}

function getInitials(name: string) {
  return name.split(' ').map(w => w.charAt(0)).join('').toUpperCase()
}

export default function About() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('exodia-team')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Sarah Chen', role: 'VP of Marketing', bio: 'Leads department strategy and oversees all marketing operations. 15 years of B2B marketing experience.', initials: 'SC' },
      { id: 2, name: 'Marcus Johnson', role: 'Creative Director', bio: 'Manages the brand and creative team. Ensures visual consistency across all company materials.', initials: 'MJ' },
      { id: 3, name: 'Emily Rodriguez', role: 'Digital Marketing Manager', bio: 'Owns paid media, SEO, and marketing automation. Drives our demand generation engine.', initials: 'ER' },
      { id: 4, name: 'David Kim', role: 'Content Lead', bio: 'Oversees blog, whitepapers, case studies, and sales enablement content across all channels.', initials: 'DK' },
    ]
  })

  const [openRoles, setOpenRoles] = useState<OpenRole[]>(() => {
    const saved = localStorage.getItem('exodia-roles')
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'Marketing Coordinator', type: 'Full-time - Hybrid' },
      { id: 2, title: 'Senior Content Strategist', type: 'Full-time - Remote' },
    ]
  })

  useEffect(() => { localStorage.setItem('exodia-team', JSON.stringify(teamMembers)) }, [teamMembers])
  useEffect(() => { localStorage.setItem('exodia-roles', JSON.stringify(openRoles)) }, [openRoles])

  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddRole, setShowAddRole] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', role: '', bio: '' })
  const [newMemberPhoto, setNewMemberPhoto] = useState<string | null>(null)
  const [newRole, setNewRole] = useState({ title: '', type: 'Full-time - Hybrid' })
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editingRole, setEditingRole] = useState<OpenRole | null>(null)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<number | null>(null)
  const [cropData, setCropData] = useState<string | null>(null)
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [cropZoom, setCropZoom] = useState(1)
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 })
  const [cropDrag, setCropDrag] = useState<{ startX: number; startY: number; posX: number; posY: number } | null>(null)
  const memberFileRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  const addMember = () => {
    if (!newMember.name.trim()) return
    const id = teamMembers.length > 0 ? Math.max(...teamMembers.map(m => m.id)) + 1 : 1
    setTeamMembers([...teamMembers, { ...newMember, id, initials: getInitials(newMember.name), photoUrl: newMemberPhoto || undefined }])
    setNewMember({ name: '', role: '', bio: '' })
    setNewMemberPhoto(null)
    setShowAddMember(false)
  }

  const deleteMember = (id: number) => { setTeamMembers(teamMembers.filter(m => m.id !== id)) }

  const saveMemberEdit = () => {
    if (!editingMember) return
    setTeamMembers(teamMembers.map(m => m.id === editingMember.id ? { ...editingMember, initials: getInitials(editingMember.name) } : m))
    setEditingMember(null)
  }

  const handlePhotoUpload = (member: TeamMember) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0]
      if (file) {
        const r = new FileReader()
        r.onloadend = () => {
          setCropImage(r.result as string)
          setCropZoom(1)
          setCropPos({ x: 0, y: 0 })
          setUploadTarget(member.id)
        }
        r.readAsDataURL(file)
      }
    }
    input.click()
  }

  const applyCrop = () => {
    if (!cropImage || uploadTarget === null) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, 200, 200)
      const fitScale = Math.min(200 / img.width, 200 / img.height)
      const w = img.width * fitScale * cropZoom
      const h = img.height * fitScale * cropZoom
      const x = (200 - w) / 2 + cropPos.x
      const y = (200 - h) / 2 + cropPos.y
      ctx.drawImage(img, x, y, w, h)
      setTeamMembers(prev => prev.map(m => m.id === uploadTarget ? { ...m, photoUrl: canvas.toDataURL() } : m))
      setCropImage(null)
      setUploadTarget(null)
    }
    img.src = cropImage
  }

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { const r = new FileReader(); r.onloadend = () => setNewMemberPhoto(r.result as string); r.readAsDataURL(file) }
  }

  const handleEditPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { const r = new FileReader(); r.onloadend = () => { if (editingMember) setEditingMember({ ...editingMember, photoUrl: r.result as string }) }; r.readAsDataURL(file) }
  }

  const removeMemberPhoto = (member: TeamMember) => {
    setTeamMembers(teamMembers.map(m => m.id === member.id ? { ...m, photoUrl: undefined } : m))
  }

  const addRole = () => {
    if (!newRole.title.trim()) return
    const id = openRoles.length > 0 ? Math.max(...openRoles.map(r => r.id)) + 1 : 1
    setOpenRoles([...openRoles, { ...newRole, id }])
    setNewRole({ title: '', type: 'Full-time - Hybrid' })
    setShowAddRole(false)
  }

  const deleteRole = (id: number) => { setOpenRoles(openRoles.filter(r => r.id !== id)) }

  const saveRoleEdit = () => {
    if (!editingRole) return
    setOpenRoles(openRoles.map(r => r.id === editingRole.id ? editingRole : r))
    setEditingRole(null)
  }

  return (
    <div>
      {/* Hero Section with Photo Background */}
      <section
        className="relative h-[400px] flex items-center justify-center px-4 sm:px-6 text-center overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(rgba(27,26,28,0.6), rgba(27,26,28,0.5)), url("https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl tracking-tight whitespace-nowrap" style={{ color: '#FFFFFF', fontWeight: 700 }}>
            Welcome to Marketing Department
          </h1>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto" style={{ fontWeight: 300 }}>
            Learn about the Marketing department's mission, structure, and how we support the organization
          </p>
        </div>
      </section>

      {/* Who We Are + Photo */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div>
            <h2 className="text-2xl sm:text-4xl mb-5 sm:mb-6" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Who We Are</h2>
            <p className="mb-4 text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              The Marketing Department is the internal team responsible for building and protecting the company brand, driving demand generation, and supporting all go-to-market initiatives across the organization.
            </p>
            <p className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              We partner with Sales, Product, Customer Success, and Leadership to develop strategies that align with company objectives and deliver measurable results.
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg w-full" style={{ minHeight: '300px', maxHeight: '500px' }}>
            <img
              src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80"
              alt="Marketing Team"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Department Structure */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-4xl text-center mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Department Structure</h2>
          <p className="text-center text-base sm:text-lg mb-10 sm:mb-14 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Our department is organized into specialized teams that work together to deliver comprehensive marketing solutions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#127912;', title: 'Brand & Creative', desc: 'Visual identity, design systems, brand guidelines, and creative asset production.' },
              { icon: '&#128200;', title: 'Digital & Growth', desc: 'SEO, paid media, email marketing, marketing automation, and performance optimization.' },
              { icon: '&#128221;', title: 'Content & Comms', desc: 'Blog, social media, internal communications, PR, and content strategy.' },
              { icon: '&#128202;', title: 'Analytics & Ops', desc: 'Marketing analytics, reporting, budget management, and tool administration.' },
            ].map((team, i) => (
              <div key={i} className="p-6 sm:p-8 rounded-2xl border transition-all hover:shadow-lg" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: team.icon }}></div>
                <h3 className="text-base sm:text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{team.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{team.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-4xl text-center mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Our Values</h2>
          <p className="text-center text-base sm:text-lg mb-10 sm:mb-14 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            The principles that guide how we work and make decisions every day
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#128161;', title: 'Innovation', desc: 'We experiment with new channels, tools, and approaches to stay ahead of market trends.' },
              { icon: '&#129309;', title: 'Collaboration', desc: 'We work cross-functionally and believe the best results come from diverse perspectives.' },
              { icon: '&#127919;', title: 'Impact', desc: 'Every initiative we undertake is tied to measurable business outcomes and company goals.' },
              { icon: '&#128172;', title: 'Transparency', desc: 'We share our plans, results, and learnings openly with the entire organization.' },
            ].map((value, i) => (
              <div key={i} className="p-6 sm:p-8 rounded-2xl border transition-all hover:shadow-lg text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: value.icon }}></div>
                <h3 className="text-base sm:text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Team & Open Roles */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          {/* Team Members */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-4xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Our Team</h2>
              <p className="text-base sm:text-lg mt-2" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Meet the people behind the work</p>
            </div>
            <button onClick={() => setShowAddMember(true)} className="px-4 py-2 text-sm text-white rounded-lg transition flex items-center gap-1.5" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Member
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
            {teamMembers.map((member) => (
              <div key={member.id} onClick={() => setSelectedMember(member)} className="group p-6 sm:p-8 rounded-2xl border text-center transition-all hover:shadow-lg relative cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setEditingMember(member)} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="Edit">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => deleteMember(member.id)} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="Delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 overflow-hidden relative cursor-pointer group/avatar"
                  style={{ backgroundColor: 'var(--btn-primary-bg)' }}
                >
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg sm:text-xl" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>{member.initials}</span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handlePhotoUpload(member) }} className="p-1 rounded-full hover:bg-white/20 transition" title={member.photoUrl ? 'Change photo' : 'Add photo'}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    {member.photoUrl && (
                      <button onClick={(e) => { e.stopPropagation(); removeMemberPhoto(member) }} className="p-1 rounded-full hover:bg-white/20 transition" title="Remove photo">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-base sm:text-lg mb-1" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{member.name}</h3>
                <span className="block text-xs sm:text-sm mb-2 sm:mb-3" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{member.role}</span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{member.bio}</p>
              </div>
            ))}
          </div>

          {/* Open Roles */}
          <div className="text-center">
            <h3 className="text-2xl sm:text-3xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Open Roles</h3>
            <p className="text-sm sm:text-base mb-6" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              We're currently hiring — reach out to HR for more details.
            </p>
            <div className="inline-flex flex-col gap-3 max-w-xl w-full">
              {openRoles.map((role) => (
                <div key={role.id} className="group flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl border transition-all" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                  <div className="text-left">
                    <h4 className="text-sm sm:text-base" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{role.title}</h4>
                    <span className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{role.type}</span>
                  </div>
                  <div className="flex gap-1 mt-2 sm:mt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingRole(role)} className="p-1.5 rounded-lg transition" style={{ color: 'var(--text-muted)' }} title="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteRole(role.id)} className="p-1.5 rounded-lg transition" style={{ color: 'var(--text-muted)' }} title="Delete">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
</div>
          </div>
              ))}
            </div>
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
              <input ref={memberFileRef} type="file" accept="image/*" onChange={handleAddPhoto} className="hidden" />
            </div>
            <input type="text" placeholder="Full Name" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <input type="text" placeholder="Role (e.g. Creative Director)" value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
            <textarea placeholder="Bio" value={newMember.bio} onChange={e => setNewMember({ ...newMember, bio: e.target.value })} rows={3} className="w-full px-3 py-2.5 border rounded-lg outline-none resize-none mb-4" style={{ borderColor: 'var(--border-primary)' }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddMember(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addMember} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Team Member Detail Popup */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedMember(null)}>
          <div className="relative rounded-2xl border p-6 sm:p-8 max-w-lg w-full text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMember(null)} className="absolute top-4 right-4 p-1 rounded-lg transition" style={{ color: 'var(--text-secondary)' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 overflow-hidden" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
              {selectedMember.photoUrl
                ? <img src={selectedMember.photoUrl} alt={selectedMember.name} className="w-full h-full object-cover" />
                : <span className="text-3xl" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>{selectedMember.initials}</span>}
            </div>
            <h2 className="text-2xl mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedMember.name}</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--accent)', fontWeight: 500 }}>{selectedMember.role}</p>
            <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{selectedMember.bio}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setEditingMember(selectedMember); setSelectedMember(null) }}
                className="px-5 py-2 text-sm text-white rounded-lg transition"
                style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
              >
                Edit
              </button>
              <button
                onClick={() => { deleteMember(selectedMember.id); setSelectedMember(null) }}
                className="px-5 py-2 text-sm rounded-lg transition"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingMember(null)}>
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Team Member</h3>
            <div className="flex justify-center mb-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer" style={{ backgroundColor: 'var(--btn-primary-bg)' }}
                onClick={() => editFileRef.current?.click()}>
                {editingMember.photoUrl
                  ? <img src={editingMember.photoUrl} className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-2xl" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>{editingMember.initials}</span>}
              </div>
              <input ref={editFileRef} type="file" accept="image/*" onChange={handleEditPhoto} className="hidden" />
            </div>
            <input type="text" placeholder="Full Name" value={editingMember.name} onChange={e => setEditingMember({ ...editingMember, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <input type="text" placeholder="Role" value={editingMember.role} onChange={e => setEditingMember({ ...editingMember, role: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} />
            <textarea placeholder="Bio" value={editingMember.bio} onChange={e => setEditingMember({ ...editingMember, bio: e.target.value })} rows={3} className="w-full px-3 py-2.5 border rounded-lg outline-none resize-none mb-4" style={{ borderColor: 'var(--border-primary)' }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingMember(null)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveMemberEdit} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Role Modal */}
      {showAddRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddRole(false)}>
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Add Open Role</h3>
            <input type="text" placeholder="Role Title" value={newRole.title} onChange={e => setNewRole({ ...newRole, title: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <select value={newRole.type} onChange={e => setNewRole({ ...newRole, type: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4" style={{ borderColor: 'var(--border-primary)' }}>
              <option>Full-time - Hybrid</option>
              <option>Full-time - Remote</option>
              <option>Full-time - Onsite</option>
              <option>Part-time</option>
              <option>Contract</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddRole(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={addRole} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingRole(null)}>
          <div className="relative rounded-2xl border p-6 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Open Role</h3>
            <input type="text" placeholder="Role Title" value={editingRole.title} onChange={e => setEditingRole({ ...editingRole, title: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-3" style={{ borderColor: 'var(--border-primary)' }} autoFocus />
            <select value={editingRole.type} onChange={e => setEditingRole({ ...editingRole, type: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg outline-none mb-4" style={{ borderColor: 'var(--border-primary)' }}>
              <option>Full-time - Hybrid</option>
              <option>Full-time - Remote</option>
              <option>Full-time - Onsite</option>
              <option>Part-time</option>
              <option>Contract</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingRole(null)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveRoleEdit} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }} onClick={() => { setCropImage(null); setUploadTarget(null) }}>
          <div className="relative rounded-2xl border p-6 max-w-lg w-full" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Adjust Photo</h3>
            <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-4 bg-black cursor-move"
              style={{ maxHeight: '300px' }}
              onMouseDown={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setCropDrag({ startX: e.clientX - r.left, startY: e.clientY - r.top, posX: cropPos.x, posY: cropPos.y }) }}
              onMouseMove={(e) => { if (!cropDrag) return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setCropPos({ x: cropDrag.posX + ((e.clientX - r.left) - cropDrag.startX) / (3 * cropZoom), y: cropDrag.posY + ((e.clientY - r.top) - cropDrag.startY) / (3 * cropZoom) }) }}
              onMouseUp={() => setCropDrag(null)}
              onMouseLeave={() => setCropDrag(null)}
            >
              <img src={cropImage} className="w-full h-full pointer-events-none select-none" style={{ objectFit: 'contain', transform: `scale(${cropZoom}) translate(${cropPos.x}px, ${cropPos.y}px)` }} />
              <div className="absolute inset-0 border-2 border-white/60 rounded-xl pointer-events-none" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Zoom:</span>
              <input type="range" min="0.5" max="3" step="0.05" value={cropZoom} onChange={e => setCropZoom(parseFloat(e.target.value))} className="flex-1" />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{Math.round(cropZoom * 100)}%</span>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setCropImage(null); setUploadTarget(null) }} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={applyCrop} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}>Save Photo</button>
            </div>
          </div>
        </div>
      )}

      {/* Department Services */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-4xl text-center mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Department Services</h2>
          <p className="text-center text-base sm:text-lg mb-10 sm:mb-14 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>What the Marketing team can do for you and your team</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: '&#127919;', title: 'Brand Guidelines & Assets', desc: 'Access approved brand templates, logos, color palettes, typography, and usage guidelines.', features: ['Logo Files', 'Template Library', 'Style Guides', 'Presentation Templates'] },
              { icon: '&#128187;', title: 'Campaign Support', desc: 'Our team helps plan, create, and execute marketing campaigns for your initiatives.', features: ['Campaign Planning', 'Asset Creation', 'Channel Strategy', 'Launch Support'] },
              { icon: '&#128241;', title: 'Social Media', desc: 'We manage all company social channels. Submit content requests for announcements.', features: ['Content Requests', 'LinkedIn Posts', 'Employee Advocacy', 'Crisis Comms'] },
              { icon: '&#9997;', title: 'Content & Copywriting', desc: 'Blog posts, whitepapers, case studies, and sales collateral for every stage of the funnel.', features: ['Blog Posts', 'Case Studies', 'Sales Collateral', 'Whitepapers'] },
              { icon: '&#128200;', title: 'Analytics & Reporting', desc: 'Access marketing dashboards, request custom reports, and track KPIs.', features: ['Performance Dashboards', 'Custom Reports', 'KPI Tracking', 'Data Walkthroughs'] },
              { icon: '&#127758;', title: 'Event & Webinar Support', desc: 'Promotion, logistics, and post-event follow-up for internal events and conferences.', features: ['Event Promotion', 'Webinar Setup', 'Conference Planning', 'Post-Event Reports'] },
            ].map((service, i) => (
              <div key={i} className="p-6 sm:p-9 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: service.icon }}></div>
                <h3 className="text-lg sm:text-xl mb-2 sm:mb-3" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{service.title}</h3>
                <p className="text-sm leading-relaxed mb-4 sm:mb-5" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{service.desc}</p>
                <ul className="flex flex-wrap gap-2">
                  {service.features.map((feature, i) => (
                    <li key={i} className="px-3 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{feature}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Request Our Help */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-4xl text-center mb-2 sm:mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>How to Request Our Help</h2>
          <p className="text-center text-base sm:text-lg mb-10 sm:mb-14 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Our standard workflow for handling internal requests</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { num: '01', title: 'Submit a Request', desc: 'Fill out the contact form with details about your project, timeline, and goals.' },
              { num: '02', title: 'Intake Meeting', desc: "We'll schedule a brief call to align on scope, deliverables, and expectations." },
              { num: '03', title: 'Execution', desc: "Our team gets to work. You'll receive regular updates and review checkpoints." },
              { num: '04', title: 'Delivery & Review', desc: 'We deliver final assets and gather feedback to improve future collaborations.' },
            ].map((step, i) => (
              <div key={i} className="text-center p-6 sm:p-8">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{step.num}</div>
                <h3 className="text-base sm:text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Working Hours - Reach Out beside Working Hours */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-start">
          <div>
            <h2 className="text-2xl sm:text-4xl mb-4" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>Reach Out to Us</h2>
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
            <form onSubmit={(e) => { e.preventDefault(); const form = e.target as HTMLFormElement; const data = Object.fromEntries(new FormData(form)); localStorage.setItem('exodia-contact-submission', JSON.stringify({ ...data, date: new Date().toISOString() })); alert('Request submitted!'); form.reset() }} className="space-y-2.5">
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