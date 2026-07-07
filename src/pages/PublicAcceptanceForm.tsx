import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface DeliverableRow {
  name: string
  description: string
  criteria: string
  reference: string
  quantity: string
  serviceType: string
}

export default function PublicAcceptanceForm() {
  const [submitted, setSubmitted] = useState(false)
  const [generatedId, setGeneratedId] = useState('')
  const [copied, setCopied] = useState(false)

  const formatDateForInput = (dateStr: string): string => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }

  const DOC_TYPE = 'AC' // Change to 'REQ' or 'RPT' as needed

  const generateId = async (): Promise<string> => {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yymm = yy + mm
    const prefix = DOC_TYPE + '-' + yymm + '-'

    let nextSeq = 1
    let dbQueried = false

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('acceptance_forms')
          .select('tracking_id')
          .like('tracking_id', prefix + '%')
          .order('tracking_id', { ascending: true })
        dbQueried = true
        if (data && data.length > 0) {
          const existing = data
            .map((row: any) => { const parts = (row.tracking_id || '').split('-'); return parts.length === 3 ? parseInt(parts[2], 10) : 0 })
            .filter((n: number) => n > 0)
            .sort((a: number, b: number) => a - b)
          nextSeq = 1
          for (const seq of existing) {
            if (seq === nextSeq) nextSeq++
            else break
          }
        }
        if (nextSeq === 1) {
          localStorage.removeItem('exodia-acceptance-last-id')
        }
      } catch {}
    }

    if (nextSeq === 1 && !dbQueried) {
      const lastRaw = localStorage.getItem('exodia-acceptance-last-id')
      if (lastRaw) {
        const parts = lastRaw.split('-')
        if (parts.length === 3 && parts[1] === yymm) {
          nextSeq = parseInt(parts[2], 10) + 1
        }
      }
    }

    const seq = String(nextSeq).padStart(3, '0')
    const newId = prefix + seq
    localStorage.setItem('exodia-acceptance-last-id', newId)
    return newId
  }

  const [form, setForm] = useState({
    clientName: '',
    projectName: '',
    contact: '',
    email: '',
    projectType: '',
    projectTypeOther: '',
    targetPlatform: [] as string[],
    targetPlatformOther: '',
    timezone: '',
    startDate: '',
    deadline: '',
    budget: '',
    docLink: '',
    deliverableRows: [] as DeliverableRow[],
    reviewer: [] as string[],
    reviewerOther: '',
    reviewRounds: '',
    reviewTime: '',
    approvalBasis: [] as string[],
    commsTool: [] as string[],
    commsToolOther: '',
    weeklyMeeting: [] as string[],
    meetingTime: '',
    meetingTimeOther: '',
    dailySync: [] as string[],
    syncTime: '',
    syncTimeOther: '',
    training: [] as string[],
    gameEngine: [] as string[],
    gameEngineOther: '',
    techRequirements: '',
    toolsSoftware: '',
    performanceConstraints: '',
    signature: '',
    signatureDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  })

  const handleCheckboxGroup = (field: string, value: string, checked: boolean) => {
    setForm((prev: any) => {
      const current = prev[field] || []
      return {
        ...prev,
        [field]: checked ? [...current, value] : current.filter((v: string) => v !== value),
      }
    })
  }

  const handleRadioGroup = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const addDeliverableRow = () => {
    setForm((prev: any) => ({
      ...prev,
      deliverableRows: [
        ...prev.deliverableRows,
        { name: '', description: '', criteria: '', reference: '', quantity: '', serviceType: '' },
      ],
    }))
  }

  const updateDeliverableRow = (index: number, field: string, value: string) => {
    setForm((prev: any) => {
      const rows = [...prev.deliverableRows]
      rows[index] = { ...rows[index], [field]: value }
      return { ...prev, deliverableRows: rows }
    })
  }

  const removeDeliverableRow = (index: number) => {
    setForm((prev: any) => ({
      ...prev,
      deliverableRows: prev.deliverableRows.filter((_: any, i: number) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trackingId = await generateId()
    const submission = { ...form, submittedAt: new Date().toISOString(), trackingId }
    localStorage.setItem('exodia-acceptance-form', JSON.stringify(submission))

    if (isSupabaseConfigured && supabase) {
      const buildPayload = (withTracking: boolean) => ({
        client_name: form.clientName,
        project_name: form.projectName,
        contact: form.contact,
        email: form.email,
        project_type: form.projectType === 'Others (Specify)' ? `Others: ${form.projectTypeOther}` : form.projectType,
        target_platform: form.targetPlatform.includes('Others (Specify)')
          ? [...form.targetPlatform.filter((v: string) => v !== 'Others (Specify)'), `Others: ${form.targetPlatformOther}`]
          : form.targetPlatform,
        timezone: form.timezone,
        start_date: form.startDate,
        deadline: form.deadline,
        budget: form.budget,
        doc_link: form.docLink,
        deliverables: form.deliverableRows,
        reviewer: form.reviewer.includes('Others (Specify)')
          ? [...form.reviewer.filter((v: string) => v !== 'Others (Specify)'), `Others: ${form.reviewerOther}`]
          : form.reviewer,
        review_rounds: form.reviewRounds,
        review_time: form.reviewTime,
        approval_basis: form.approvalBasis,
        comms_tool: form.commsTool.includes('Others (Specify)')
          ? [...form.commsTool.filter((v: string) => v !== 'Others (Specify)'), `Others: ${form.commsToolOther}`]
          : form.commsTool,
        weekly_meeting: form.weeklyMeeting,
        meeting_time: form.meetingTime === 'Others (Specify)' ? `Others: ${form.meetingTimeOther}` : form.meetingTime,
        daily_sync: form.dailySync,
        sync_time: form.syncTime === 'Others (Specify)' ? `Others: ${form.syncTimeOther}` : form.syncTime,
        training: form.training,
        game_engine: form.gameEngine.includes('Others (Specify)')
          ? [...form.gameEngine.filter((v: string) => v !== 'Others (Specify)'), `Others: ${form.gameEngineOther}`]
          : form.gameEngine,
        tech_requirements: form.techRequirements,
        tools_software: form.toolsSoftware,
        performance_constraints: form.performanceConstraints,
        signature: form.signature,
        signature_date: form.signatureDate,
        ...(withTracking ? { tracking_id: trackingId } : {}),
        created_at: new Date().toISOString(),
      })
      try {
        const { error } = await supabase.from('acceptance_forms').insert([buildPayload(true)])
        if (error) {
          console.error('Supabase insert error (with tracking_id):', error)
          const { error: retryError } = await supabase.from('acceptance_forms').insert([buildPayload(false)])
          if (retryError) console.error('Supabase insert error (fallback):', retryError)
        }
      } catch (err) {
        console.error('Failed to submit to Supabase:', err)
      }
    }

    setSubmitted(true)
    setGeneratedId(trackingId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const radioOptions = (field: string, options: string[]) =>
    options.map((opt) => (
      <label key={opt} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={field}
          value={opt}
          checked={(form as any)[field] === opt}
          onChange={() => handleRadioGroup(field, opt)}
          className="w-4 h-4"
          style={{ accentColor: '#FF5900' }}
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{opt}</span>
      </label>
    ))

  const checkboxOptions = (field: string, options: string[]) =>
    options.map((opt) => (
      <label key={opt} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          value={opt}
          checked={((form as any)[field] || []).includes(opt)}
          onChange={(e) => handleCheckboxGroup(field, opt, e.target.checked)}
          className="w-4 h-4 rounded"
          style={{ accentColor: '#FF5900' }}
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{opt}</span>
      </label>
    ))

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FAFAFA' }}>
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#FFF0E6' }}>
            <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl mb-3" style={{ color: '#1B1A1C', fontWeight: 700 }}>Form Submitted Successfully</h1>
          <p className="text-sm mb-2" style={{ color: '#6B7280', fontWeight: 300 }}>
            Your Acceptance Criteria has been logged!
          </p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-lg font-bold tracking-wide" style={{ color: '#FF5900' }}>{generatedId}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedId).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
              }}
              className="p-1.5 rounded-lg transition hover:bg-gray-100"
              style={{ color: '#6B7280' }}
              title="Copy to clipboard"
            >
              {copied ? (
                <svg className="w-5 h-5" style={{ color: '#10B981' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          </div>
          {copied && <p className="text-xs -mt-4 mb-4" style={{ color: '#10B981', fontWeight: 500 }}>Copied to clipboard!</p>}
          <p className="text-sm mb-6" style={{ color: '#6B7280', fontWeight: 300 }}>
            Your tracking ID is <strong style={{ color: '#1B1A1C' }}>{generatedId}</strong>.<br />
            Our team will review it and get back to you shortly.
          </p>
          <p className="text-xs" style={{ color: '#9CA3AF', fontWeight: 300 }}>
            Exodia Game Development &middot; Marketing Department
          </p>
          <button
            onClick={() => {
              setSubmitted(false)
              setGeneratedId('')
              setCopied(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="mt-6 px-6 py-2.5 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5"
            style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}
          >
            Submit Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#FAFAFA', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1B1A1C 0%, #2D2B2E 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="py-12 sm:py-16 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,89,0,0.2), rgba(255,140,51,0.1))' }}>
              <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h1 className="text-2xl sm:text-3xl mb-3" style={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}>Production Specs &amp; Acceptance Criteria Form</h1>
            <p className="text-sm sm:text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>
              Define your project deliverables, specifications, and acceptance standards.
            </p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-3xl mx-auto px-4" style={{ marginTop: '-1.5rem' }}>
        <div className="p-5 rounded-xl" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFE4C4' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#9A3412', fontWeight: 300 }}>
            This document defines the Client's expectations for production deliverables and acceptance standards. Information provided here will be translated by the Operations and QA teams into detailed technical specifications, quality checks, and validation procedures. Clients are not required to provide technical details.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pb-16" style={{ marginTop: '-1.5rem' }}>
        <div className="space-y-6">
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION A: PROJECT INFORMATION</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Client / Studio Name</label>
                <input type="text" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Enter your studio name" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Project Name</label>
                <input type="text" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Enter project name" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Point of Contact</label>
                <input type="text" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Email Address</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="your@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Project Type</label>
              <div className="flex flex-wrap gap-2">{radioOptions('projectType', ['Project Base', 'Staff Augmentation'])}</div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Target Platform</label>
              <div className="flex flex-wrap gap-2">{checkboxOptions('targetPlatform', ['PC', 'Mobile', 'Web', 'Console', 'Not sure yet'])}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Timezone</label>
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}>
                  <option value="" disabled>Select your timezone</option>
                  <option value="EST (UTC-5)">EST (UTC-5) — Eastern US</option>
                  <option value="CST (UTC-6)">CST (UTC-6) — Central US</option>
                  <option value="MST (UTC-7)">MST (UTC-7) — Mountain US</option>
                  <option value="PST (UTC-8)">PST (UTC-8) — Pacific US</option>
                  <option value="AKST (UTC-9)">AKST (UTC-9) — Alaska</option>
                  <option value="HST (UTC-10)">HST (UTC-10) — Hawaii</option>
                  <option value="AST (UTC-4)">AST (UTC-4) — Atlantic Canada</option>
                  <option value="NST (UTC-3:30)">NST (UTC-3:30) — Newfoundland</option>
                  <option value="BRT (UTC-3)">BRT (UTC-3) — Brasília</option>
                  <option value="GMT (UTC+0)">GMT (UTC+0) — London / Lisbon</option>
                  <option value="CET (UTC+1)">CET (UTC+1) — Paris / Berlin / Rome</option>
                  <option value="EET (UTC+2)">EET (UTC+2) — Athens / Helsinki</option>
                  <option value="MSK (UTC+3)">MSK (UTC+3) — Moscow</option>
                  <option value="GST (UTC+4)">GST (UTC+4) — Dubai</option>
                  <option value="IST (UTC+5:30)">IST (UTC+5:30) — India</option>
                  <option value="SGT (UTC+8)">SGT (UTC+8) — Singapore / Manila</option>
                  <option value="CST (UTC+8)">CST (UTC+8) — China / Taipei</option>
                  <option value="JST (UTC+9)">JST (UTC+9) — Tokyo / Seoul</option>
                  <option value="AEST (UTC+10)">AEST (UTC+10) — Sydney / Melbourne</option>
                  <option value="NZST (UTC+12)">NZST (UTC+12) — Auckland</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Start Date</label>
                <input type="date" value={form.startDate ? formatDateForInput(form.startDate) : ''} onChange={(e) => setForm({ ...form, startDate: e.target.value ? new Date(e.target.value + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Deadline</label>
                <input type="date" value={form.deadline ? formatDateForInput(form.deadline) : ''} onChange={(e) => setForm({ ...form, deadline: e.target.value ? new Date(e.target.value + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Budget Range</label>
                <input type="text" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g. $5,000 - $10,000" />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Link to Project Document</label>
              <input type="text" value={form.docLink} onChange={(e) => setForm({ ...form, docLink: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Google Drive, Notion, etc." />
            </div>
          </div>
        </div>

        {/* Section 2: Deliverables */}
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION B: DELIVERABLES &amp; SPECIFICATIONS</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm" style={{ color: '#6B7280', fontWeight: 300 }}>
              List each deliverable, describe what it should include, and define how we will check if it's correct. Each row represents one item from your project scope.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    <th className="p-3 border text-left text-xs font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Deliverable</th>
                    <th className="p-3 border text-left text-xs font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Description</th>
                    <th className="p-3 border text-left text-xs font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Acceptance Criteria</th>
                    <th className="p-3 border text-left text-xs font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Reference Link</th>
                    <th className="p-3 border text-left text-xs font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Quantity</th>
                    <th className="p-3 border text-left text-xs font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Service Type</th>
                    <th className="p-3 border w-10" style={{ borderColor: '#E5E7EB' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.deliverableRows.map((row, i) => (
                    <tr key={i} className="hover:bg-orange-50 transition">
                      {(['name', 'description', 'criteria', 'reference', 'quantity', 'serviceType'] as const).map((field) => (
                        <td key={field} className="p-1.5 border" style={{ borderColor: '#E5E7EB' }}>
                          <input type="text" value={row[field]} onChange={(e) => updateDeliverableRow(i, field, e.target.value)} className="w-full px-2 py-1.5 border rounded outline-none text-xs transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder={`Enter ${field}`} />
                        </td>
                      ))}
                      <td className="p-1.5 border" style={{ borderColor: '#E5E7EB' }}>
                        <button type="button" onClick={() => removeDeliverableRow(i)} className="p-1 rounded hover:bg-red-50 transition" style={{ color: '#EF4444' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addDeliverableRow} className="mt-1 px-4 py-2 text-sm rounded-lg transition flex items-center gap-1.5 hover:-translate-y-0.5" style={{ color: '#FF5900', backgroundColor: '#FFF0E6', fontWeight: 500 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Deliverable Row
            </button>
          </div>
        </div>

        {/* Section 3: Review & Approval */}
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION C: REVIEW &amp; APPROVAL PROCESS</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Who will review and approve this?</label>
              <div className="flex flex-wrap gap-2">{checkboxOptions('reviewer', ['Client', "Client's Team", 'Stakeholders', "Client's QA"])}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Review Rounds Included</label>
                <div className="flex flex-wrap gap-2">{radioOptions('reviewRounds', ['1', '2', '3', 'Not Sure'])}</div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Review Time</label>
                <div className="flex flex-wrap gap-2">{radioOptions('reviewTime', ['1 day', '2 days', '3 days', 'Not Sure'])}</div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Basis for Approval</label>
                <div className="flex flex-wrap gap-2">{checkboxOptions('approvalBasis', ['Acceptance criteria from Section 2'])}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Project Governance */}
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION D: COMMUNICATION &amp; GOVERNANCE</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Communication Tool</label>
              <div className="flex flex-wrap gap-2">{checkboxOptions('commsTool', ['Discord', 'Slack'])}</div>
            </div>
            {form.projectType === 'Project Base' && (
            <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
              <p className="text-sm mb-3 font-medium" style={{ color: '#374151' }}>If Project Base</p>
              <div className="space-y-3 pl-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Weekly Meeting Days</label>
                  <div className="flex flex-wrap gap-2">{checkboxOptions('weeklyMeeting', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}</div>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Preferred Meeting Time <span className="text-xs font-normal" style={{ color: '#9CA3AF' }}>(No graveyard shift)</span></label>
                  <div className="flex flex-wrap gap-2">{radioOptions('meetingTime', ['10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'])}</div>
                </div>
              </div>
            </div>
            )}
            {form.projectType === 'Staff Augmentation' && (
            <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
              <p className="text-sm mb-3 font-medium" style={{ color: '#374151' }}>If Staff Augmentation</p>
              <div className="space-y-3 pl-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Daily Sync Days</label>
                  <div className="flex flex-wrap gap-2">{checkboxOptions('dailySync', ['Everyday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}</div>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Preferred Sync Time <span className="text-xs font-normal" style={{ color: '#9CA3AF' }}>(No graveyard shift)</span></label>
                  <div className="flex flex-wrap gap-2">{radioOptions('syncTime', ['10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'])}</div>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Training &amp; Onboarding</label>
                  <div className="flex flex-wrap gap-2">{checkboxOptions('training', ['Client', 'Exodia', 'Third Party'])}</div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Section 5: Technical Details */}
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION E: TECHNICAL SPECIFICATIONS</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Game Engine</label>
              <div className="flex flex-wrap gap-2">{checkboxOptions('gameEngine', ['Unity', 'Unreal', 'Not sure yet'])}</div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Technical Requirements</label>
              <textarea value={form.techRequirements} onChange={(e) => setForm({ ...form, techRequirements: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="File format, naming convention, output format, etc." />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Tools &amp; Software Required</label>
              <textarea value={form.toolsSoftware} onChange={(e) => setForm({ ...form, toolsSoftware: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="List any required tools or software" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Performance &amp; Platform Constraints</label>
              <textarea value={form.performanceConstraints} onChange={(e) => setForm({ ...form, performanceConstraints: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Any performance targets or platform limitations" />
            </div>
          </div>
        </div>

        {/* Section 6: Client Confirmation */}
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION F: CLIENT SIGN-OFF</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFE4C4' }}>
              <p className="text-sm leading-relaxed" style={{ color: '#9A3412', fontWeight: 300 }}>
                By signing this form, the client confirms that the deliverables, specifications, and acceptance expectations stated above are accurate and approved. This document will be used as the basis for project scoping, quotation, production execution, and QA validation. Any changes after approval may require a formal revision and may impact cost, timeline, or delivery scope.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Client Name &amp; Signature</label>
                <input type="text" value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Type your full name" required />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Date</label>
                <div className="w-full px-3.5 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#D1D5DB', color: '#6B7280', backgroundColor: '#F9FAFB' }}>{form.signatureDate}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="text-center pt-2">
          <button
            type="submit"
            className="px-10 py-3 rounded-xl text-white text-sm font-medium transition-all hover:-translate-y-0.5 inline-flex items-center gap-2"
            style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 16px rgba(255,89,0,0.3)' }}
          >
            Submit Form
          </button>
        </div>
        </div>
      </form>

      {/* Footer */}
      <div className="py-6 px-4 text-center border-t" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF', fontWeight: 300 }}>
          Exodia Game Development &middot; Marketing Department &middot; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
