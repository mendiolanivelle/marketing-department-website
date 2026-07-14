import { useState } from 'react'

interface FlowStep {
  id: string
  text: string
  time: string
}

interface MeetingTemplate {
  id: string
  name: string
  description: string
  goal: string
  kpis: string[]
  proTips: string[]
  flowSteps: FlowStep[]
}

interface MeetingLink {
  id: string
  label: string
  url: string
}

interface ChecklistItem {
  id: string
  text: string
  checked: boolean
}

interface ScriptCard {
  id: string
  name: string
  category: string
  text: string
}

interface ActiveMeeting {
  id: string
  name: string
  links: MeetingLink[]
  checklist: ChecklistItem[]
}

type TabKey = 'master' | 'active' | 'vault'

const defaultTemplates: MeetingTemplate[] = [
  {
    id: 'discovery',
    name: 'Discovery Call',
    description: 'First meeting with a potential client to understand their needs and qualify the lead.',
    goal: 'Understand client pain points, qualify the lead, and set clear next steps.',
    kpis: ['Client agrees to a proposal meeting', 'At least 3 pain points identified', 'Budget range confirmed'],
    proTips: ['Research the client\'s company and industry 15 minutes before the call', 'Let the client talk 70% of the time', 'Always ask "What does success look like for you?"'],
    flowSteps: [
      { id: 'f1', text: 'Open & Welcome — brief intro, set agenda, confirm meeting length', time: '2 min' },
      { id: 'f2', text: 'Client Introductions — each attendee shares their role and what they hope to get out of the meeting', time: '3 min' },
      { id: 'f3', text: 'Context Recap — recap how we got here, previous conversations, submitted forms', time: '2 min' },
      { id: 'f4', text: 'Discovery Questions — pain points, goals, timeline, budget, decision criteria', time: '15 min' },
      { id: 'f5', text: 'Buffer / Follow-up Questions — catch missed topics, dig deeper on key answers', time: '3 min' },
      { id: 'f6', text: 'Capabilities Overview — 2-3 case studies aligned to their needs', time: '10 min' },
      { id: 'f7', text: 'Q&A — open floor for client questions', time: '3 min' },
      { id: 'f8', text: 'Next Steps & Timeline — proposal date, follow-up meeting, internal review', time: '4 min' },
      { id: 'f9', text: 'Close — summarize key takeaways, confirm next steps, thank attendees', time: '3 min' },
    ],
  },
  {
    id: 'proposal',
    name: 'Proposal Presentation',
    description: 'Present the proposed solution, timeline, and pricing to the client.',
    goal: 'Get verbal approval or clear next steps toward closing.',
    kpis: ['Client confirms budget alignment', 'Decision timeline established', 'Objections addressed'],
    proTips: ['Start with a recap of their needs before showing the solution', 'Let the pricing slide breathe — pause after showing it', 'Have a printed proposal PDF ready to share'],
    flowSteps: [
      { id: 'p1', text: 'Open & Agenda — welcome, set expectations', time: '3 min' },
      { id: 'p2', text: 'Needs Recap — summarize client\'s stated needs and goals from discovery', time: '5 min' },
      { id: 'p3', text: 'Proposal Walkthrough — solution, scope, timeline, deliverables, pricing', time: '22 min' },
      { id: 'p4', text: 'Q&A — address questions, clarify scope, discuss concerns', time: '10 min' },
      { id: 'p5', text: 'Pricing Deep Dive — break down pricing structure, payment terms, ROI', time: '10 min' },
      { id: 'p6', text: 'Next Steps — review decision timeline, internal review process', time: '5 min' },
      { id: 'p7', text: 'Close — summarize, confirm understanding, thank them', time: '5 min' },
    ],
  },
  {
    id: 'kickoff',
    name: 'Project Kickoff',
    description: 'Align on project goals, timeline, team roles, and communication plan.',
    goal: 'Everyone leaves aligned on scope, timeline, and who does what.',
    kpis: ['All team members introduced', 'Communication channels confirmed', 'First deliverable date set'],
    proTips: ['Set the tone — this is a collaboration, not a handoff', 'Get the client to confirm each milestone date verbally', 'Share the meeting notes and action items within 2 hours'],
    flowSteps: [
      { id: 'k1', text: 'Welcome & Introductions — introduce team, their roles, and what they bring', time: '5 min' },
      { id: 'k2', text: 'Project Scope & Goals — review agreed-upon scope, objectives, success criteria', time: '10 min' },
      { id: 'k3', text: 'Timeline & Milestones — walk through the project timeline, key milestones', time: '10 min' },
      { id: 'k4', text: 'Roles & Responsibilities — who does what, escalation paths, POCs', time: '5 min' },
      { id: 'k5', text: 'Communication Plan — meeting cadence, channels, reporting format', time: '5 min' },
      { id: 'k6', text: 'Tools & Access — grant access to project management tools, shared drives', time: '10 min' },
      { id: 'k7', text: 'Q&A / Discussion — open discussion for questions, concerns', time: '7 min' },
      { id: 'k8', text: 'Action Items & Next Steps — assign immediate action items, first deliverable date', time: '5 min' },
      { id: 'k9', text: 'Close — summarize, confirm understanding, share meeting notes', time: '3 min' },
    ],
  },
]

const defaultActiveMeetings: ActiveMeeting[] = [
  {
    id: 'active-1',
    name: 'Meeting with Client A',
    links: [
      { id: 'l1', label: '🔗 Meeting Link', url: '' },
      { id: 'l2', label: '📊 Presentation Deck', url: '' },
      { id: 'l3', label: '🎥 Previous Recordings', url: '' },
    ],
    checklist: [
      { id: 'c1', text: 'Test audio/video and screen-share.', checked: false },
      { id: 'c2', text: 'Review client\'s website and past notes.', checked: false },
      { id: 'c3', text: 'Ensure the recording software is on.', checked: false },
    ],
  },
]

const defaultScripts: ScriptCard[] = [
  { id: 's1', name: 'Handling "It\'s Too Expensive" Objection', category: 'Sales', text: 'I completely understand budget is a concern. However, our proven formula has helped similar companies achieve [X result] within [Y timeframe]. Let me break down the actual ROI you can expect.' },
  { id: 's2', name: 'Handling "We Need to Think About It"', category: 'Sales', text: 'I appreciate that — it\'s a big decision. To help you discuss internally, what specific concerns do you need to address? I can join your internal call if that helps.' },
  { id: 's3', name: 'Project Kickoff Opening', category: 'Onboarding', text: 'Welcome everyone. Today we\'re aligning on how we\'ll work together over the next [duration]. By the end of this call, you\'ll know exactly who does what, when things are due, and how we communicate.' },
  { id: 's4', name: 'Handling Tech Failure Gracefully', category: 'General', text: 'Looks like we\'re having a tech hiccup. No worries — I\'ll send you the deck via email right now. Bear with me for one minute while I switch to my backup.' },
]

export default function MeetingPlaybook() {
  const [activeTab, setActiveTab] = useState<TabKey>('master')
  const [templates, setTemplates] = useState<MeetingTemplate[]>(defaultTemplates)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [activeMeetings, setActiveMeetings] = useState<ActiveMeeting[]>(defaultActiveMeetings)
  const [selectedMeeting, setSelectedMeeting] = useState<string>(defaultActiveMeetings[0]?.id || '')
  const [scripts, setScripts] = useState<ScriptCard[]>(defaultScripts)
  const [editingField, setEditingField] = useState<{ target: string; id: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const activeTemplate = templates.find(t => t.id === selectedTemplate)
  const activeMeeting = activeMeetings.find(m => m.id === selectedMeeting)
  const activeLinks = activeMeeting?.links || []
  const activeChecklist = activeMeeting?.checklist || []

  const saveEdit = () => {
    if (!editingField) return
    const { target, id } = editingField
    if (target === 'goal') {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, goal: editValue } : t))
    }
    if (target === 'step-text') {
      setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, flowSteps: t.flowSteps.map(s => s.id === id ? { ...s, text: editValue } : s) } : t))
    }
    if (target === 'step-time') {
      setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, flowSteps: t.flowSteps.map(s => s.id === id ? { ...s, time: editValue } : s) } : t))
    }
    if (target === 'kpi') {
      setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, kpis: t.kpis.map((k, i) => i === Number(id) ? editValue : k) } : t))
    }
    if (target === 'tip') {
      setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, proTips: t.proTips.map((p, i) => i === Number(id) ? editValue : p) } : t))
    }
    if (target === 'link-url') {
      setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, links: m.links.map(l => l.id === id ? { ...l, url: editValue } : l) } : m))
    }
    if (target === 'link-label') {
      setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, links: m.links.map(l => l.id === id ? { ...l, label: editValue } : l) } : m))
    }
    if (target === 'script-name') {
      setScripts(prev => prev.map(s => s.id === id ? { ...s, name: editValue } : s))
    }
    if (target === 'script-text') {
      setScripts(prev => prev.map(s => s.id === id ? { ...s, text: editValue } : s))
    }
    if (target === 'script-category') {
      setScripts(prev => prev.map(s => s.id === id ? { ...s, category: editValue } : s))
    }
    if (target === 'checklist-text') {
      setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, checklist: m.checklist.map(c => c.id === id ? { ...c, text: editValue } : c) } : m))
    }
    if (target === 'description') {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, description: editValue } : t))
    }
    setEditingField(null)
    setEditValue('')
  }

  const startEdit = (target: string, id: string, value: string) => {
    setEditingField({ target, id })
    setEditValue(value)
  }

  const addKpi = () => {
    if (!selectedTemplate) return
    setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, kpis: [...t.kpis, 'New KPI'] } : t))
  }

  const deleteKpi = (index: number) => {
    if (!selectedTemplate) return
    setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, kpis: t.kpis.filter((_, i) => i !== index) } : t))
  }

  const addTip = () => {
    if (!selectedTemplate) return
    setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, proTips: [...t.proTips, 'New tip'] } : t))
  }

  const deleteTip = (index: number) => {
    if (!selectedTemplate) return
    setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, proTips: t.proTips.filter((_, i) => i !== index) } : t))
  }

  const addStep = () => {
    if (!selectedTemplate) return
    const id = 'step-' + Date.now()
    setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, flowSteps: [...t.flowSteps, { id, text: 'New step', time: '5 min' }] } : t))
  }

  const deleteStep = (stepId: string) => {
    if (!selectedTemplate) return
    setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, flowSteps: t.flowSteps.filter(s => s.id !== stepId) } : t))
  }

  const addTemplate = () => {
    const id = 'template-' + Date.now()
    setTemplates(prev => [...prev, { id, name: 'New Meeting Template', description: '', goal: '', kpis: [], proTips: [], flowSteps: [] }])
    setSelectedTemplate(id)
  }

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (selectedTemplate === id) setSelectedTemplate(null)
  }

  const addLink = () => {
    if (!selectedMeeting) return
    const id = 'link-' + Date.now()
    setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, links: [...m.links, { id, label: '🔗 New Link', url: '' }] } : m))
  }

  const deleteLink = (id: string) => {
    if (!selectedMeeting) return
    setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, links: m.links.filter(l => l.id !== id) } : m))
  }

  const addChecklistItem = () => {
    if (!selectedMeeting) return
    const id = 'check-' + Date.now()
    setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, checklist: [...m.checklist, { id, text: 'New checklist item', checked: false }] } : m))
  }

  const deleteChecklistItem = (id: string) => {
    if (!selectedMeeting) return
    setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, checklist: m.checklist.filter(c => c.id !== id) } : m))
  }

  const toggleChecklistItem = (id: string) => {
    if (!selectedMeeting) return
    setActiveMeetings(prev => prev.map(m => m.id === selectedMeeting ? { ...m, checklist: m.checklist.map(c => c.id === id ? { ...c, checked: !c.checked } : c) } : m))
  }

  const addScript = () => {
    const id = 'script-' + Date.now()
    setScripts(prev => [...prev, { id, name: 'New Script', category: 'General', text: 'Write your script here...' }])
  }

  const deleteScript = (id: string) => {
    setScripts(prev => prev.filter(s => s.id !== id))
  }

  const createActiveMeeting = () => {
    const id = 'active-' + Date.now()
    const name = 'Meeting ' + (activeMeetings.length + 1)
    setActiveMeetings(prev => [...prev, { id, name, links: [{ id: 'l-' + Date.now(), label: '🔗 Meeting Link', url: '' }], checklist: [] }])
    setSelectedMeeting(id)
  }

  const deleteActiveMeeting = (id: string) => {
    setActiveMeetings(prev => prev.filter(m => m.id !== id))
    if (selectedMeeting === id) {
      const remaining = activeMeetings.filter(m => m.id !== id)
      setSelectedMeeting(remaining[0]?.id || '')
    }
  }

  const tabStyle = (tab: TabKey) => ({
    backgroundColor: activeTab === tab ? 'var(--accent)' : 'var(--bg-card)',
    color: activeTab === tab ? '#FFFFFF' : 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="rounded-2xl overflow-hidden mb-6 theme-transition" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(27,26,28,0.08)' }}>
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--accent), #FF8C33, #FFB366)' }}></div>
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Meeting Playbook</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Client meeting guides and best practices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('master')} onClick={() => { setActiveTab('master'); setSelectedTemplate(null) }}>Master Playbook</button>
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('active')} onClick={() => setActiveTab('active')}>Active Meeting</button>
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('vault')} onClick={() => setActiveTab('vault')}>Script & Cheat Sheet Vault</button>
      </div>

      {/* TAB 1: MASTER PLAYBOOK */}
      {activeTab === 'master' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Meeting Types & Formulas</h2>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }} onClick={addTemplate}>+ Create New Meeting Template</button>
          </div>

          {selectedTemplate && activeTemplate ? (
            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button className="text-xs font-medium transition" style={{ color: 'var(--accent)' }} onClick={() => setSelectedTemplate(null)}>← Back to list</button>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/</span>
                  {editingField?.target === 'description' && editingField?.id === activeTemplate.id ? (
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs font-semibold" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  ) : (
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => { startEdit('description', activeTemplate.id, activeTemplate.description) }}>{activeTemplate.name}</h3>
                  )}
                </div>
                <button className="p-1 rounded transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => { deleteTemplate(activeTemplate.id) }} title="Delete template">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{activeTemplate.description}</p>

              {/* Objective & KPIs */}
              <div className="mb-4">
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Objective & KPIs</h4>
                <div className="mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Goal: </span>
                  {editingField?.target === 'goal' && editingField?.id === activeTemplate.id ? (
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('goal', activeTemplate.id, activeTemplate.goal)}>{activeTemplate.goal} <span className="text-[10px]" style={{ color: 'var(--accent)' }}>✏️</span></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>KPIs:</span>
                  <ul className="mt-1 space-y-1">
                    {activeTemplate.kpis.map((kpi, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                        <span style={{ color: 'var(--accent)' }}>•</span>
                        {editingField?.target === 'kpi' && editingField?.id === String(i) ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs flex-1" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span style={{ cursor: 'pointer' }} onClick={() => startEdit('kpi', String(i), kpi)}>{kpi}</span>
                        )}
                        <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteKpi(i)} title="Delete KPI">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button className="text-xs mt-1 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addKpi}>➕ Add KPI</button>
                </div>
              </div>

              {/* Pro-Tips */}
              <div className="mb-4">
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Pro-Tips for the Operator</h4>
                <ul className="space-y-1">
                  {activeTemplate.proTips.map((tip, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                      <span style={{ color: 'var(--accent)' }}>💡</span>
                      {editingField?.target === 'tip' && editingField?.id === String(i) ? (
                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs flex-1" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                      ) : (
                        <span style={{ cursor: 'pointer' }} onClick={() => startEdit('tip', String(i), tip)}>{tip}</span>
                      )}
                      <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteTip(i)} title="Delete tip">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="text-xs mt-1 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addTip}>➕ Add Tip</button>
              </div>

              {/* Meeting Flow Guide */}
              <div>
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>The Meeting Flow Guide</h4>
                <div className="space-y-2">
                  {activeTemplate.flowSteps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}>{i + 1}</span>
                      <div className="flex-1">
                        {editingField?.target === 'step-text' && editingField?.id === step.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-0.5 rounded border outline-none text-xs" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('step-text', step.id, step.text)}>{step.text}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {editingField?.target === 'step-time' && editingField?.id === step.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-16 px-2 py-0.5 rounded border outline-none text-xs text-center" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span className="text-xs font-mono" style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => startEdit('step-time', step.id, step.time)}>{step.time}</span>
                        )}
                        <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteStep(step.id)} title="Delete step">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="text-xs mt-2 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addStep}>➕ Add New Step</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="rounded-xl border p-4 cursor-pointer transition hover:opacity-80" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={() => setSelectedTemplate(t.id)}>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t.name}</h3>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{t.description}</p>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{t.flowSteps.length} steps</span>
                    <span>{t.kpis.length} KPIs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE MEETING WORKSPACE */}
      {activeTab === 'active' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Active Meeting</h2>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }} onClick={createActiveMeeting}>+ Create Active Meeting</button>
          </div>

          {activeMeetings.length > 0 && activeMeeting ? (
            <div>
              {/* Meeting Selector */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {activeMeetings.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMeeting(m.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5"
                    style={{
                      backgroundColor: selectedMeeting === m.id ? 'var(--accent)' : 'var(--bg-card)',
                      color: selectedMeeting === m.id ? '#FFFFFF' : 'var(--text-secondary)',
                      border: '1px solid var(--border-primary)',
                    }}
                  >
                    {m.name}
                    <span className="text-[10px] opacity-60">({m.links.length + m.checklist.length})</span>
                    <button
                      className="p-0.5 rounded-full hover:opacity-70"
                      style={{ color: selectedMeeting === m.id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
                      onClick={e => { e.stopPropagation(); deleteActiveMeeting(m.id) }}
                      title="Delete meeting"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </button>
                ))}
              </div>

              {/* Merged Card: Links & Checklist */}
              <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Preparation & Assets</h3>

                {/* Links */}
                <div className="mb-4">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Important Links & Assets</h4>
                  <div className="space-y-2">
                    {activeLinks.map(link => (
                      <div key={link.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {editingField?.target === 'link-label' && editingField?.id === link.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => startEdit('link-label', link.id, link.label)}>{link.label}</span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>:</span>
                        {editingField?.target === 'link-url' && editingField?.id === link.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} placeholder="Paste URL here..." className="flex-1 px-2 py-0.5 rounded border outline-none text-xs" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span className="text-xs flex-1 truncate" style={{ color: link.url ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('link-url', link.id, link.url)}>{link.url || 'Paste URL here...'}</span>
                        )}
                        <button className="p-0.5 transition hover:opacity-70 flex-shrink-0" style={{ color: 'var(--text-muted)' }} onClick={() => deleteLink(link.id)} title="Delete link">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="text-xs mt-2 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addLink}>➕ Add New Link/Asset</button>
                </div>

                {/* Divider */}
                <div className="border-t my-4" style={{ borderColor: 'var(--border-secondary)' }}></div>

                {/* Checklist */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Pre-Meeting Checklist</h4>
                  <div className="space-y-2">
                    {activeChecklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <input type="checkbox" checked={item.checked} onChange={() => toggleChecklistItem(item.id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                        {editingField?.target === 'checklist-text' && editingField?.id === item.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="flex-1 px-2 py-0.5 rounded border outline-none text-xs" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        ) : (
                          <span className="text-xs flex-1" style={{ color: item.checked ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 300, textDecoration: item.checked ? 'line-through' : 'none' }} onClick={() => startEdit('checklist-text', item.id, item.text)}>{item.text}</span>
                        )}
                        <button className="p-0.5 transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => deleteChecklistItem(item.id)} title="Delete item">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="text-xs mt-2 font-medium transition" style={{ color: 'var(--accent)' }} onClick={addChecklistItem}>➕ Add Custom Checklist Item</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No active meetings yet. Click "+ Create Active Meeting" to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCRIPT & CHEAT SHEET VAULT */}
      {activeTab === 'vault' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Talk Scripts & Cheat Sheets</h2>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }} onClick={addScript}>➕ Create New Script</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scripts.map(script => (
              <div key={script.id} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-2">
                  {editingField?.target === 'script-name' && editingField?.id === script.id ? (
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="flex-1 px-2 py-0.5 rounded border outline-none text-xs font-semibold" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  ) : (
                    <h3 className="text-xs font-semibold flex-1" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => startEdit('script-name', script.id, script.name)}>{script.name}</h3>
                  )}
                  <button className="p-0.5 transition hover:opacity-70 flex-shrink-0" style={{ color: 'var(--text-muted)' }} onClick={() => deleteScript(script.id)} title="Delete script">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="mb-2">
                  {editingField?.target === 'script-category' && editingField?.id === script.id ? (
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-[10px]" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => startEdit('script-category', script.id, script.category)}>{script.category}</span>
                  )}
                </div>
                {editingField?.target === 'script-text' && editingField?.id === script.id ? (
                  <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-3 py-2 rounded border outline-none resize-y text-xs leading-relaxed" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 80 }} rows={3} />
                ) : (
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('script-text', script.id, script.text)}>{script.text}</p>
                )}
                <button className="text-xs font-medium transition" style={{ color: 'var(--accent)' }} onClick={() => navigator.clipboard.writeText(script.text)}>📋 Copy to Clipboard</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}