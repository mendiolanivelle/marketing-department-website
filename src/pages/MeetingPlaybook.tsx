import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logActivity } from '../lib/activityLogger'
import {
  LEGACY_ACTIVE_MEETINGS_KEY,
  LEGACY_SCRIPTS_KEY,
  LEGACY_TEMPLATES_KEY,
  createActiveMeeting as createCanonicalActiveMeeting,
  createMeetingScript,
  createMeetingTemplate,
  deleteActiveMeeting as deleteCanonicalActiveMeeting,
  deleteMeetingScript,
  deleteMeetingTemplate,
  fetchCanonicalMeetingPlaybook,
  importMissingLegacyMeetingPlaybook,
  planLegacyMeetingPlaybookImport,
  readLegacyMeetingPlaybook,
  serializeMeetingPlaybookBackup,
  updateActiveMeeting,
  updateMeetingScript,
  updateMeetingTemplate,
  type ActiveMeeting,
  type LegacyMeetingPlaybookData,
  type MeetingPlaybookClient,
  type MeetingPlaybookRecords,
  type MeetingTemplate,
  type ScriptCard,
} from '../lib/meetingPlaybookData'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

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
      { id: 'f1', text: 'Open & Welcome', time: '2 min', description: 'Brief intro, set the agenda, confirm meeting length' },
      { id: 'f2', text: 'Client Introductions', time: '3 min', description: 'Each attendee shares their role and what they hope to get out of the meeting' },
      { id: 'f3', text: 'Context Recap', time: '2 min', description: 'Recap how we got here, previous conversations, submitted forms' },
      { id: 'f4', text: 'Discovery Questions', time: '15 min', description: 'Pain points, goals, timeline, budget, decision criteria' },
      { id: 'f5', text: 'Buffer / Follow-up Questions', time: '3 min', description: 'Catch missed topics, dig deeper on key answers' },
      { id: 'f6', text: 'Capabilities Overview', time: '10 min', description: '2-3 case studies aligned to their needs' },
      { id: 'f7', text: 'Q&A', time: '3 min', description: 'Open floor for client questions' },
      { id: 'f8', text: 'Next Steps & Timeline', time: '4 min', description: 'Proposal date, follow-up meeting, internal review' },
      { id: 'f9', text: 'Close', time: '3 min', description: 'Summarize key takeaways, confirm next steps, thank attendees' },
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
      { id: 'p1', text: 'Open & Agenda', time: '3 min', description: 'Welcome, set expectations for the presentation' },
      { id: 'p2', text: 'Needs Recap', time: '5 min', description: 'Summarize the client\'s stated needs and goals from discovery' },
      { id: 'p3', text: 'Proposal Walkthrough', time: '22 min', description: 'Solution, scope, timeline, deliverables, and pricing' },
      { id: 'p4', text: 'Q&A', time: '10 min', description: 'Address questions, clarify scope, discuss concerns' },
      { id: 'p5', text: 'Pricing Deep Dive', time: '10 min', description: 'Break down pricing structure, payment terms, and ROI' },
      { id: 'p6', text: 'Next Steps', time: '5 min', description: 'Review decision timeline, internal review process, follow-up date' },
      { id: 'p7', text: 'Close', time: '5 min', description: 'Summarize, confirm understanding, thank them' },
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
      { id: 'k1', text: 'Welcome & Introductions', time: '5 min', description: 'Introduce team, their roles, and what they bring' },
      { id: 'k2', text: 'Project Scope & Goals', time: '10 min', description: 'Review agreed-upon scope, objectives, and success criteria' },
      { id: 'k3', text: 'Timeline & Milestones', time: '10 min', description: 'Walk through the project timeline, key milestones, deliverables' },
      { id: 'k4', text: 'Roles & Responsibilities', time: '5 min', description: 'Who does what, escalation paths, points of contact' },
      { id: 'k5', text: 'Communication Plan', time: '5 min', description: 'Meeting cadence, communication channels, reporting format' },
      { id: 'k6', text: 'Tools & Access', time: '10 min', description: 'Grant access to project management tools, shared drives, platforms' },
      { id: 'k7', text: 'Q&A / Discussion', time: '7 min', description: 'Open discussion for questions, concerns, clarifications' },
      { id: 'k8', text: 'Action Items & Next Steps', time: '5 min', description: 'Assign immediate action items, set first deliverable date' },
      { id: 'k9', text: 'Close', time: '3 min', description: 'Summarize, confirm understanding, share meeting notes' },
    ],
  },
]

const defaultScripts: ScriptCard[] = [
  { id: 's1', name: 'Handling "It\'s Too Expensive" Objection', category: 'Sales', text: 'I completely understand budget is a concern. However, our proven formula has helped similar companies achieve [X result] within [Y timeframe]. Let me break down the actual ROI you can expect.' },
  { id: 's2', name: 'Handling "We Need to Think About It"', category: 'Sales', text: 'I appreciate that — it\'s a big decision. To help you discuss internally, what specific concerns do you need to address? I can join your internal call if that helps.' },
  { id: 's3', name: 'Project Kickoff Opening', category: 'Onboarding', text: 'Welcome everyone. Today we\'re aligning on how we\'ll work together over the next [duration]. By the end of this call, you\'ll know exactly who does what, when things are due, and how we communicate.' },
  { id: 's4', name: 'Handling Tech Failure Gracefully', category: 'General', text: 'Looks like we\'re having a tech hiccup. No worries — I\'ll send you the deck via email right now. Bear with me for one minute while I switch to my backup.' },
]

const emptyRecords = (): MeetingPlaybookRecords => ({ templates: [], activeMeetings: [], scripts: [] })

const emptyLegacy = (): LegacyMeetingPlaybookData => ({
  records: emptyRecords(),
  counts: { templates: 0, activeMeetings: 0, scripts: 0 },
  issues: {
    [LEGACY_TEMPLATES_KEY]: [],
    [LEGACY_ACTIVE_MEETINGS_KEY]: [],
    [LEGACY_SCRIPTS_KEY]: [],
  },
})

const readLocalArray = <T,>(key: string, fallback: T[]): T[] => {
  if (typeof window === 'undefined') return fallback
  const saved = window.localStorage.getItem(key)
  if (saved) { try { return JSON.parse(saved) as T[] } catch { /* preserve prior fallback behavior */ } }
  return fallback
}

const defaultRecords: MeetingPlaybookRecords = {
  templates: defaultTemplates,
  activeMeetings: [],
  scripts: defaultScripts,
}

type PersistenceState = 'idle' | 'saving' | 'saved' | 'failed'

export default function MeetingPlaybook() {
  const [activeTab, setActiveTab] = useState<TabKey>('master')
  const [templates, setTemplates] = useState<MeetingTemplate[]>(() =>
    isSupabaseConfigured ? [] : readLocalArray(LEGACY_TEMPLATES_KEY, defaultTemplates))
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [activeMeetings, setActiveMeetings] = useState<ActiveMeeting[]>(() =>
    isSupabaseConfigured ? [] : readLocalArray(LEGACY_ACTIVE_MEETINGS_KEY, []))
  const [selectedMeeting, setSelectedMeeting] = useState<string>('')
  const [scripts, setScripts] = useState<ScriptCard[]>(() =>
    isSupabaseConfigured ? [] : readLocalArray(LEGACY_SCRIPTS_KEY, defaultScripts))
  const [editingField, setEditingField] = useState<{ target: string; id: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [canonicalLoaded, setCanonicalLoaded] = useState(!isSupabaseConfigured)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>(isSupabaseConfigured ? 'loading' : 'ready')
  const [persistenceState, setPersistenceState] = useState<PersistenceState>('idle')
  const [legacy] = useState<LegacyMeetingPlaybookData>(() => {
    if (!isSupabaseConfigured || typeof window === 'undefined') return emptyLegacy()
    return readLegacyMeetingPlaybook(window.localStorage)
  })
  const [legacyKeysPresent] = useState(() => {
    if (!isSupabaseConfigured || typeof window === 'undefined') return false
    try {
      return [LEGACY_TEMPLATES_KEY, LEGACY_ACTIVE_MEETINGS_KEY, LEGACY_SCRIPTS_KEY]
        .some(key => window.localStorage.getItem(key) !== null)
    } catch {
      return true
    }
  })
  const retryRef = useRef<(() => void) | null>(null)
  const busyRef = useRef(false)
  const canonicalClient = supabase as unknown as MeetingPlaybookClient | null

  const applyCanonicalRecords = useCallback((records: MeetingPlaybookRecords) => {
    setTemplates(records.templates)
    setActiveMeetings(records.activeMeetings)
    setScripts(records.scripts)
    setSelectedTemplate(current => current && records.templates.some(record => record.id === current) ? current : null)
    setSelectedMeeting(current => current && records.activeMeetings.some(record => record.id === current)
      ? current
      : records.activeMeetings[0]?.id || '')
  }, [])

  const loadCanonical = useCallback(async (): Promise<boolean> => {
    if (!canonicalClient) return false
    setLoadState('loading')
    try {
      const records = await fetchCanonicalMeetingPlaybook(canonicalClient)
      applyCanonicalRecords(records)
      setCanonicalLoaded(true)
      setLoadState('ready')
      return true
    } catch {
      setLoadState('failed')
      return false
    }
  }, [applyCanonicalRecords, canonicalClient])

  useEffect(() => {
    if (!isSupabaseConfigured) window.localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(templates))
  }, [templates])
  useEffect(() => {
    if (!isSupabaseConfigured) window.localStorage.setItem(LEGACY_ACTIVE_MEETINGS_KEY, JSON.stringify(activeMeetings))
  }, [activeMeetings])
  useEffect(() => {
    if (!isSupabaseConfigured) window.localStorage.setItem(LEGACY_SCRIPTS_KEY, JSON.stringify(scripts))
  }, [scripts])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    retryRef.current = () => { void loadCanonical() }
    void loadCanonical()
  }, [loadCanonical])

  useEffect(() => {
    if (!selectedMeeting && activeMeetings.length > 0) {
      setSelectedMeeting(activeMeetings[0].id)
    }
  }, [activeMeetings, selectedMeeting])

  const canonicalRecords = useMemo<MeetingPlaybookRecords>(() => ({ templates, activeMeetings, scripts }), [activeMeetings, scripts, templates])
  const canonicalRecordsRef = useRef(canonicalRecords)
  canonicalRecordsRef.current = canonicalRecords
  const importPlan = useMemo(() => planLegacyMeetingPlaybookImport(legacy.records, canonicalRecords), [canonicalRecords, legacy.records])
  const legacyValidCount = legacy.counts.templates + legacy.counts.activeMeetings + legacy.counts.scripts
  const canonicalCount = templates.length + activeMeetings.length + scripts.length
  const missingCount = importPlan.missing.templates.length + importPlan.missing.activeMeetings.length + importPlan.missing.scripts.length

  if (isSupabaseConfigured && !canonicalLoaded) {
    return (
      <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
        <div className="rounded-2xl border p-6 text-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }} role="status" aria-live="polite">
          {loadState === 'loading' ? 'Loading canonical Meeting Playbook…' : 'Canonical Meeting Playbook failed to load. Existing browser records remain preserved.'}
          {loadState === 'failed' && (
            <button className="ml-3 font-medium" style={{ color: 'var(--accent)' }} onClick={() => retryRef.current?.()}>Retry</button>
          )}
        </div>
      </div>
    )
  }

  const activeTemplate = templates.find(t => t.id === selectedTemplate)
  const activeMeeting = activeMeetings.find(m => m.id === selectedMeeting)
  const activeLinks = activeMeeting?.links || []
  const activeChecklist = activeMeeting?.checklist || []

  const runCanonicalMutation = async <T,>(
    operation: () => Promise<T>,
    applyConfirmed: (confirmed: T) => void,
    successActivity: string,
    failedActivity: string,
  ) => {
    if (!canonicalClient || busyRef.current) return
    const retry = () => { void runCanonicalMutation(operation, applyConfirmed, successActivity, failedActivity) }
    retryRef.current = retry
    busyRef.current = true
    setPersistenceState('saving')
    try {
      const confirmed = await operation()
      applyConfirmed(confirmed)
      setPersistenceState('saved')
      void logActivity('Meeting Playbook', successActivity)
    } catch {
      setPersistenceState('failed')
      void logActivity('Meeting Playbook', failedActivity)
      await loadCanonical()
    } finally {
      busyRef.current = false
    }
  }

  const saveTemplate = async (record: MeetingTemplate, activity = 'Updated meeting template') => {
    if (!isSupabaseConfigured) {
      setTemplates(current => current.map(item => item.id === record.id ? record : item))
      return
    }
    await runCanonicalMutation(
      () => updateMeetingTemplate(canonicalClient!, record),
      confirmed => setTemplates(current => current.map(item => item.id === confirmed.id ? confirmed : item)),
      activity,
      'Meeting template update failed',
    )
  }

  const saveActiveMeeting = async (record: ActiveMeeting, activity = 'Updated active meeting') => {
    if (!isSupabaseConfigured) {
      setActiveMeetings(current => current.map(item => item.id === record.id ? record : item))
      return
    }
    await runCanonicalMutation(
      () => updateActiveMeeting(canonicalClient!, record),
      confirmed => setActiveMeetings(current => current.map(item => item.id === confirmed.id ? confirmed : item)),
      activity,
      'Active meeting update failed',
    )
  }

  const saveScript = async (record: ScriptCard, activity = 'Updated meeting script') => {
    if (!isSupabaseConfigured) {
      setScripts(current => current.map(item => item.id === record.id ? record : item))
      return
    }
    await runCanonicalMutation(
      () => updateMeetingScript(canonicalClient!, record),
      confirmed => setScripts(current => current.map(item => item.id === confirmed.id ? confirmed : item)),
      activity,
      'Meeting script update failed',
    )
  }

  const saveEdit = async () => {
    if (!editingField) return
    const { target, id } = editingField
    setEditingField(null)
    setEditValue('')
    const templateTargets = ['goal', 'description', 'name', 'step-text', 'step-time', 'step-desc', 'kpi', 'tip']
    const directTemplate = templateTargets.includes(target)
      ? (['goal', 'description', 'name'].includes(target) ? templates.find(record => record.id === id) : activeTemplate)
      : undefined
    if (directTemplate) {
      let next = directTemplate
      if (target === 'goal') next = { ...next, goal: editValue }
      if (target === 'description') next = { ...next, description: editValue }
      if (target === 'name') next = { ...next, name: editValue }
      if (target === 'step-text') next = { ...next, flowSteps: next.flowSteps.map(step => step.id === id ? { ...step, text: editValue } : step) }
      if (target === 'step-time') next = { ...next, flowSteps: next.flowSteps.map(step => step.id === id ? { ...step, time: editValue } : step) }
      if (target === 'step-desc') next = { ...next, flowSteps: next.flowSteps.map(step => step.id === id ? { ...step, description: editValue } : step) }
      if (target === 'kpi') next = { ...next, kpis: next.kpis.map((value, index) => index === Number(id) ? editValue : value) }
      if (target === 'tip') next = { ...next, proTips: next.proTips.map((value, index) => index === Number(id) ? editValue : value) }
      if (next !== directTemplate) await saveTemplate(next)
      return
    }
    const meetingTargets = ['meeting-name', 'link-url', 'link-label', 'checklist-text']
    const directMeeting = meetingTargets.includes(target)
      ? (target === 'meeting-name' ? activeMeetings.find(record => record.id === id) : activeMeeting)
      : undefined
    if (directMeeting) {
      let next = directMeeting
      if (target === 'meeting-name') next = { ...next, name: editValue }
      if (target === 'link-url') next = { ...next, links: next.links.map(link => link.id === id ? { ...link, url: editValue } : link) }
      if (target === 'link-label') next = { ...next, links: next.links.map(link => link.id === id ? { ...link, label: editValue } : link) }
      if (target === 'checklist-text') next = { ...next, checklist: next.checklist.map(item => item.id === id ? { ...item, text: editValue } : item) }
      if (next !== directMeeting) await saveActiveMeeting(next)
      return
    }
    const script = scripts.find(record => record.id === id)
    if (script) {
      let next = script
      if (target === 'script-name') next = { ...next, name: editValue }
      if (target === 'script-text') next = { ...next, text: editValue }
      if (target === 'script-category') next = { ...next, category: editValue }
      if (next !== script) await saveScript(next)
    }
  }

  const startEdit = (target: string, id: string, value: string) => {
    setEditingField({ target, id })
    setEditValue(value)
  }

  const addKpi = () => {
    if (activeTemplate) void saveTemplate({ ...activeTemplate, kpis: [...activeTemplate.kpis, 'New KPI'] })
  }

  const deleteKpi = (index: number) => {
    if (activeTemplate) void saveTemplate({ ...activeTemplate, kpis: activeTemplate.kpis.filter((_, i) => i !== index) })
  }

  const addTip = () => {
    if (activeTemplate) void saveTemplate({ ...activeTemplate, proTips: [...activeTemplate.proTips, 'New tip'] })
  }

  const deleteTip = (index: number) => {
    if (activeTemplate) void saveTemplate({ ...activeTemplate, proTips: activeTemplate.proTips.filter((_, i) => i !== index) })
  }

  const addStep = () => {
    if (!activeTemplate) return
    const id = 'step-' + Date.now()
    void saveTemplate({ ...activeTemplate, flowSteps: [...activeTemplate.flowSteps, { id, text: 'New step', time: '5 min', description: '' }] })
  }

  const deleteStep = (stepId: string) => {
    if (activeTemplate) void saveTemplate({ ...activeTemplate, flowSteps: activeTemplate.flowSteps.filter(step => step.id !== stepId) })
  }

  const addTemplate = () => {
    const id = 'template-' + Date.now()
    const record = { id, name: 'New Meeting Template', description: '', goal: '', kpis: [], proTips: [], flowSteps: [] }
    if (!isSupabaseConfigured) {
      setTemplates(current => [...current, record])
      setSelectedTemplate(id)
      return
    }
    void runCanonicalMutation(
      () => createMeetingTemplate(canonicalClient!, record),
      confirmed => { setTemplates(current => [...current, confirmed]); setSelectedTemplate(confirmed.id) },
      'Created meeting template',
      'Meeting template creation failed',
    )
  }

  const deleteTemplate = (id: string) => {
    if (!isSupabaseConfigured) {
      setTemplates(current => current.filter(record => record.id !== id))
      if (selectedTemplate === id) setSelectedTemplate(null)
      return
    }
    void runCanonicalMutation(
      () => deleteMeetingTemplate(canonicalClient!, id),
      confirmedId => { setTemplates(current => current.filter(record => record.id !== confirmedId)); setSelectedTemplate(current => current === confirmedId ? null : current) },
      'Deleted meeting template',
      'Meeting template deletion failed',
    )
  }

  const addLink = () => {
    if (!activeMeeting) return
    const id = 'link-' + Date.now()
    void saveActiveMeeting({ ...activeMeeting, links: [...activeMeeting.links, { id, label: '🔗 New Link', url: '' }] })
  }

  const deleteLink = (id: string) => {
    if (activeMeeting) void saveActiveMeeting({ ...activeMeeting, links: activeMeeting.links.filter(link => link.id !== id) })
  }

  const addChecklistItem = () => {
    if (!activeMeeting) return
    const id = 'check-' + Date.now()
    void saveActiveMeeting({ ...activeMeeting, checklist: [...activeMeeting.checklist, { id, text: 'New checklist item', checked: false }] })
  }

  const deleteChecklistItem = (id: string) => {
    if (activeMeeting) void saveActiveMeeting({ ...activeMeeting, checklist: activeMeeting.checklist.filter(item => item.id !== id) })
  }

  const toggleChecklistItem = (id: string) => {
    if (activeMeeting) void saveActiveMeeting({ ...activeMeeting, checklist: activeMeeting.checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item) })
  }

  const addScript = () => {
    const id = 'script-' + Date.now()
    const record = { id, name: 'New Script', category: 'General', text: 'Write your script here...' }
    if (!isSupabaseConfigured) { setScripts(current => [...current, record]); return }
    void runCanonicalMutation(
      () => createMeetingScript(canonicalClient!, record),
      confirmed => setScripts(current => [...current, confirmed]),
      'Created meeting script',
      'Meeting script creation failed',
    )
  }

  const deleteScript = (id: string) => {
    if (!isSupabaseConfigured) { setScripts(current => current.filter(record => record.id !== id)); return }
    void runCanonicalMutation(
      () => deleteMeetingScript(canonicalClient!, id),
      confirmedId => setScripts(current => current.filter(record => record.id !== confirmedId)),
      'Deleted meeting script',
      'Meeting script deletion failed',
    )
  }

  const createActiveMeeting = () => {
    const id = 'active-' + Date.now()
    const name = 'Meeting ' + (activeMeetings.length + 1)
    const record = { id, name, links: [{ id: 'l-' + Date.now(), label: '🔗 Meeting Link', url: '' }], checklist: [] }
    if (!isSupabaseConfigured) {
      setActiveMeetings(current => [...current, record])
      setSelectedMeeting(id)
      return
    }
    void runCanonicalMutation(
      () => createCanonicalActiveMeeting(canonicalClient!, record),
      confirmed => { setActiveMeetings(current => [...current, confirmed]); setSelectedMeeting(confirmed.id) },
      'Created active meeting',
      'Active meeting creation failed',
    )
  }

  const deleteActiveMeeting = (id: string) => {
    const applyDelete = (confirmedId: string) => {
      const remaining = activeMeetings.filter(record => record.id !== confirmedId)
      setActiveMeetings(remaining)
      if (selectedMeeting === confirmedId) setSelectedMeeting(remaining[0]?.id || '')
    }
    if (!isSupabaseConfigured) { applyDelete(id); return }
    void runCanonicalMutation(
      () => deleteCanonicalActiveMeeting(canonicalClient!, id),
      applyDelete,
      'Deleted active meeting',
      'Active meeting deletion failed',
    )
  }

  const downloadLegacyBackup = () => {
    const backup = serializeMeetingPlaybookBackup(legacy.records, new Date().toISOString())
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `meeting-playbook-browser-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importLegacy = async () => {
    if (!canonicalClient || busyRef.current) return
    retryRef.current = () => { void importLegacy() }
    busyRef.current = true
    setPersistenceState('saving')
    try {
      const result = await importMissingLegacyMeetingPlaybook(canonicalClient, legacy.records, canonicalRecordsRef.current)
      const refreshed = await loadCanonical()
      if (!result.complete || !refreshed) throw new Error('Import was not fully confirmed')
      setPersistenceState('saved')
      void logActivity('Meeting Playbook', 'Imported missing browser records')
    } catch {
      setPersistenceState('failed')
      void logActivity('Meeting Playbook', 'Browser record import failed')
      await loadCanonical()
    } finally {
      busyRef.current = false
    }
  }

  const initializeDefaults = async () => {
    if (!canonicalClient || busyRef.current) return
    retryRef.current = () => { void initializeDefaults() }
    busyRef.current = true
    setPersistenceState('saving')
    try {
      const result = await importMissingLegacyMeetingPlaybook(canonicalClient, defaultRecords, canonicalRecordsRef.current)
      const refreshed = await loadCanonical()
      if (!result.complete || !refreshed) throw new Error('Initialization was not fully confirmed')
      setPersistenceState('saved')
      void logActivity('Meeting Playbook', 'Initialized default playbook')
    } catch {
      setPersistenceState('failed')
      void logActivity('Meeting Playbook', 'Default playbook initialization failed')
      await loadCanonical()
    } finally {
      busyRef.current = false
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

      {isSupabaseConfigured && (
        <div className="mb-6 space-y-3">
          {(loadState === 'loading' || persistenceState !== 'idle') && (
            <div
              className="rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: persistenceState === 'failed' ? '#B91C1C' : 'var(--text-secondary)' }}
              role="status"
              aria-live="polite"
            >
              <span>
                {persistenceState === 'saving' && 'Saving canonical Meeting Playbook…'}
                {persistenceState === 'saved' && 'Saved to canonical Meeting Playbook.'}
                {persistenceState === 'failed' && 'Canonical save failed. The last confirmed state is shown.'}
                {persistenceState === 'idle' && loadState === 'loading' && 'Refreshing canonical Meeting Playbook…'}
              </span>
              {persistenceState === 'failed' && (
                <button className="font-medium" style={{ color: 'var(--accent)' }} onClick={() => retryRef.current?.()}>Retry</button>
              )}
            </div>
          )}

          {legacyKeysPresent && (
            <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} aria-labelledby="legacy-playbook-title">
              <h2 id="legacy-playbook-title" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Review preserved browser records</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Browser records remain untouched. Review the backup, parse results, and collision preview before importing only missing IDs.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>Templates: {legacy.counts.templates} valid · {importPlan.missing.templates.length} missing · {importPlan.collisions.templates} collisions</span>
                <span>Active meetings: {legacy.counts.activeMeetings} valid · {importPlan.missing.activeMeetings.length} missing · {importPlan.collisions.activeMeetings} collisions</span>
                <span>Scripts: {legacy.counts.scripts} valid · {importPlan.missing.scripts.length} missing · {importPlan.collisions.scripts} collisions</span>
              </div>
              {Object.entries(legacy.issues).some(([, issues]) => issues.length > 0) && (
                <ul className="mt-3 space-y-1 text-xs" style={{ color: '#B91C1C' }}>
                  {Object.entries(legacy.issues).flatMap(([key, issues]) => issues.map(issue => (
                    <li key={`${key}:${issue}`}>{key}: {issue}</li>
                  )))}
                </ul>
              )}
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{missingCount} valid missing record{missingCount === 1 ? '' : 's'} available to import.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }} onClick={downloadLegacyBackup}>Download JSON backup</button>
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                  disabled={missingCount === 0 || persistenceState === 'saving'}
                  onClick={() => { void importLegacy() }}
                >
                  Import missing records
                </button>
              </div>
            </section>
          )}

          {canonicalCount === 0 && legacyValidCount === 0 && (
            <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No canonical playbook records yet</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Bundled templates and scripts are available, but will not become shared data until you explicitly initialize them.</p>
              <button
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}
                disabled={persistenceState === 'saving'}
                onClick={() => { void initializeDefaults() }}
              >
                Initialize default playbook
              </button>
            </section>
          )}
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('active')} onClick={() => setActiveTab('active')}>Active Meeting</button>
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('master')} onClick={() => { setActiveTab('master'); setSelectedTemplate(null) }}>Master Playbook</button>
        <button className="px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap" style={tabStyle('vault')} onClick={() => setActiveTab('vault')}>Script & Cheat Sheet Vault</button>
      </div>

      {/* TAB 1: ACTIVE MEETING WORKSPACE */}
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
                    {editingField?.target === 'meeting-name' && editingField?.id === m.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }}
                        className="w-24 px-1 py-0.5 rounded border outline-none text-xs"
                        style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span onClick={e => { if (selectedMeeting === m.id) { e.stopPropagation(); startEdit('meeting-name', m.id, m.name) } }} style={{ cursor: selectedMeeting === m.id ? 'pointer' : 'default' }}>{m.name}</span>
                    )}
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
                <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Preparation & Assets</h3>
                <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Links & checklist for the current meeting</p>

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
                          <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="flex-1 px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
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

      {/* TAB 2: MASTER PLAYBOOK */}
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
                  <div>
                    {editingField?.target === 'name' && editingField?.id === activeTemplate.id ? (
                      <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="px-2 py-0.5 rounded border outline-none text-xs font-semibold" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                    ) : (
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => startEdit('name', activeTemplate.id, activeTemplate.name)}>{activeTemplate.name}</h3>
                    )}
                    {editingField?.target === 'description' && editingField?.id === activeTemplate.id ? (
                      <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y mt-0.5" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 60 }} rows={2} />
                    ) : (
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('description', activeTemplate.id, activeTemplate.description)}>{activeTemplate.description || 'Click to add description...'}</p>
                    )}
                  </div>
                </div>
                <button className="p-1 rounded transition hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => { deleteTemplate(activeTemplate.id) }} title="Delete template">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              {/* Objective & KPIs */}
              <div className="mb-4">
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Objective & KPIs</h4>
                <div className="mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Goal: </span>
                  {editingField?.target === 'goal' && editingField?.id === activeTemplate.id ? (
                    <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 60 }} rows={2} />
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
                          <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
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
                <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Pro-Tips</h4>
                <ul className="space-y-1">
                  {activeTemplate.proTips.map((tip, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
                      <span style={{ color: 'var(--accent)' }}>💡</span>
                      {editingField?.target === 'tip' && editingField?.id === String(i) ? (
                        <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
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
                    <div key={step.id} className="p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          {editingField?.target === 'step-text' && editingField?.id === step.id ? (
                            <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-xs resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} />
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => startEdit('step-text', step.id, step.text)}>{step.text}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
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
                      <div className="mt-1 ml-7">
                        {editingField?.target === 'step-desc' && editingField?.id === step.id ? (
                          <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { saveEdit() }; if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="w-full px-2 py-1 rounded border outline-none text-[11px] resize-y" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 50 }} rows={1} placeholder="Add description..." />
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 300 }} onClick={() => startEdit('step-desc', step.id, step.description)}>{step.description || 'Click to add description...'}</span>
                        )}
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
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</h3>
                  <p className="text-[10px] mt-0.5 mb-3" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{t.description || 'No description'}</p>
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
                <div className="flex items-center justify-between mb-1">
                  {editingField?.target === 'script-name' && editingField?.id === script.id ? (
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingField(null); setEditValue('') } }} className="flex-1 px-2 py-0.5 rounded border outline-none text-xs font-semibold" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  ) : (
                    <h3 className="text-xs font-semibold flex-1" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => startEdit('script-name', script.id, script.name)}>{script.name}</h3>
                  )}
                  <button className="p-0.5 transition hover:opacity-70 flex-shrink-0" style={{ color: 'var(--text-muted)' }} onClick={() => deleteScript(script.id)} title="Delete script">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Script for {script.category.toLowerCase()}</p>
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
