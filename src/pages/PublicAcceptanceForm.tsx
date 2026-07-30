import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import Turnstile from '../components/Turnstile'

interface DeliverableRow {
  name: string
  description: string
  criteria: string
  reference: string
  quantity: string
  serviceType: string
}

const emptyDeliverable = (): DeliverableRow => ({
  name: '',
  description: '',
  criteria: '',
  reference: '',
  quantity: '',
  serviceType: '',
})

const emptyForm = () => ({
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
  deliverableRows: [emptyDeliverable()],
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
  signatoryName: '',
  signatureDataUrl: '',
})

function SignaturePad({ dataUrl, onDataUrlChange }: { dataUrl: string; onDataUrlChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const moved = useRef(false)

  useEffect(() => {
    if (dataUrl) return
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [dataUrl])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawing.current = true
    moved.current = false
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    moved.current = true
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1B1A1C'
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [])

  const stopDrawing = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false
    if (!moved.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    onDataUrlChange(canvas.toDataURL())
  }, [onDataUrlChange])

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawing.current = false
    moved.current = false
    onDataUrlChange('')
  }, [onDataUrlChange])

  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Signature</label>
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#D1D5DB' }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full touch-none"
          style={{ backgroundColor: '#FFFDF5', cursor: 'crosshair' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {dataUrl && <span className="text-[10px]" style={{ color: '#059669' }}>✓ Signature captured</span>}
        <div className="flex gap-2 ml-auto">
          {dataUrl && (
            <button type="button" onClick={clearSignature} className="text-[10px] font-medium px-2 py-1 rounded transition hover:opacity-70" style={{ color: '#DC2626' }}>
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PublicAcceptanceForm() {
  const [submitted, setSubmitted] = useState(false)
  const [generatedId, setGeneratedId] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const submissionKeyRef = useRef(crypto.randomUUID())
  const [invalidGroups, setInvalidGroups] = useState({ targetPlatform: false, reviewer: false })
  const targetPlatformGroupRef = useRef<HTMLFieldSetElement>(null)
  const reviewerGroupRef = useRef<HTMLFieldSetElement>(null)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (submitted) successHeadingRef.current?.focus()
  }, [submitted])

  const [form, setForm] = useState(emptyForm)
  const resetTurnstile = () => {
    setTurnstileToken('')
    setTurnstileResetKey((current) => current + 1)
  }

  const handleCheckboxGroup = (field: string, value: string, checked: boolean) => {
    setForm((prev: any) => {
      const current = prev[field] || []
      return {
        ...prev,
        [field]: checked ? [...current, value] : current.filter((v: string) => v !== value),
      }
    })
    if (checked && (field === 'targetPlatform' || field === 'reviewer')) {
      setInvalidGroups((prev) => ({ ...prev, [field]: false }))
    }
  }

  const handleRadioGroup = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const addDeliverableRow = () => {
    setForm((prev: any) => ({
      ...prev,
      deliverableRows: prev.deliverableRows.length < 20
        ? [...prev.deliverableRows, emptyDeliverable()]
        : prev.deliverableRows,
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
    if (submitting) return

    setSubmitError('')
    const nextInvalidGroups = {
      targetPlatform: form.targetPlatform.length === 0,
      reviewer: form.reviewer.length === 0,
    }
    setInvalidGroups(nextInvalidGroups)
    const allDeliverablesComplete = form.deliverableRows.length > 0 && form.deliverableRows.every(
      (row) => row.name.trim() && row.criteria.trim()
    )
    if (
      !form.clientName.trim() ||
      !form.projectName.trim() ||
      !form.contact.trim() ||
      !form.email.trim() ||
      !form.projectType ||
      form.targetPlatform.length === 0 ||
      !form.timezone.trim() ||
      !form.startDate ||
      !form.deadline ||
      form.deadline < form.startDate ||
      !allDeliverablesComplete ||
      form.reviewer.length === 0 ||
      !form.signatoryName.trim() ||
      (form.projectType === 'Others (Specify)' && !form.projectTypeOther.trim()) ||
      (form.targetPlatform.includes('Others (Specify)') && !form.targetPlatformOther.trim()) ||
      (form.reviewer.includes('Others (Specify)') && !form.reviewerOther.trim()) ||
      (form.commsTool.includes('Others (Specify)') && !form.commsToolOther.trim()) ||
      (form.projectType === 'Project Base' && form.meetingTime === 'Others (Specify)' && !form.meetingTimeOther.trim()) ||
      (form.projectType === 'Staff Augmentation' && form.syncTime === 'Others (Specify)' && !form.syncTimeOther.trim()) ||
      (form.gameEngine.includes('Others (Specify)') && !form.gameEngineOther.trim())
    ) {
      setSubmitError(
        form.startDate && form.deadline && form.deadline < form.startDate
          ? 'The expected deadline cannot be earlier than the start date.'
          : 'Complete all required project, deliverable, reviewer, and sign-off fields before submitting.',
      )
      const firstInvalidGroup = nextInvalidGroups.targetPlatform
        ? targetPlatformGroupRef
        : nextInvalidGroups.reviewer
          ? reviewerGroupRef
          : null
      if (firstInvalidGroup) window.requestAnimationFrame(() => firstInvalidGroup.current?.focus())
      return
    }
    if (!turnstileToken) {
      setSubmitError('Complete the submission verification before sending this form.')
      return
    }
    setSubmitting(true)

    if (!isSupabaseConfigured || !supabase) {
      setSubmitError('We could not securely submit the form. Your entries remain on this page.')
      resetTurnstile()
      setSubmitting(false)
      return
    }

    const payload = {
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
      weekly_meeting: form.projectType === 'Project Base' ? form.weeklyMeeting : [],
      meeting_time: form.projectType === 'Project Base'
        ? form.meetingTime === 'Others (Specify)' ? `Others: ${form.meetingTimeOther}` : form.meetingTime
        : '',
      daily_sync: form.projectType === 'Staff Augmentation' ? form.dailySync : [],
      sync_time: form.projectType === 'Staff Augmentation'
        ? form.syncTime === 'Others (Specify)' ? `Others: ${form.syncTimeOther}` : form.syncTime
        : '',
      training: form.projectType === 'Staff Augmentation' ? form.training : [],
      game_engine: form.gameEngine.includes('Others (Specify)')
        ? [...form.gameEngine.filter((v: string) => v !== 'Others (Specify)'), `Others: ${form.gameEngineOther}`]
        : form.gameEngine,
      tech_requirements: form.techRequirements,
      tools_software: form.toolsSoftware,
      performance_constraints: form.performanceConstraints,
      signatory_name: form.signatoryName,
      signature_png: form.signatureDataUrl,
      submissionKey: submissionKeyRef.current,
      turnstileToken,
    }

    try {
      const { data, error } = await supabase.functions.invoke<{ trackingId: string }>(
        'public-acceptance-form',
        { body: payload },
      )
      if (error || !data?.trackingId) throw error || new Error('Submission was not confirmed')

      setSubmitted(true)
      setGeneratedId(data.trackingId)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitError('We could not securely submit the form. Your entries remain on this page. Please try again.')
      resetTurnstile()
    } finally {
      setSubmitting(false)
    }
  }

  const radioOptions = (field: string, options: string[], required = false) =>
    options.map((opt) => (
      <label key={opt} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={field}
          value={opt}
          required={required}
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
          <h1 ref={successHeadingRef} tabIndex={-1} className="text-2xl mb-3" style={{ color: '#1B1A1C', fontWeight: 700 }}>Form Submitted Successfully</h1>
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
              setSubmitError('')
              setInvalidGroups({ targetPlatform: false, reviewer: false })
              setForm(emptyForm())
              submissionKeyRef.current = crypto.randomUUID()
              resetTurnstile()
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
      <div className="max-w-3xl mx-auto px-4 mt-6 mb-6">
        <div className="p-5 rounded-xl" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFE4C4' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#9A3412', fontWeight: 300 }}>
            This document defines the Client's expectations for production deliverables and acceptance standards. Information provided here will be translated by the Operations and QA teams into detailed technical specifications, quality checks, and validation procedures. Clients are not required to provide technical details.
          </p>
        </div>
      </div>

<form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pb-16">
        <div className="space-y-6">
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION A: PROJECT INFORMATION</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="acceptance-client" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Client / Studio Name *</label>
                <input id="acceptance-client" type="text" required maxLength={200} value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Enter your studio name" />
              </div>
              <div>
                <label htmlFor="acceptance-project" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Project Name *</label>
                <input id="acceptance-project" type="text" required maxLength={300} value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Enter project name" />
              </div>
              <div>
                <label htmlFor="acceptance-contact" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Point of Contact *</label>
                <input id="acceptance-contact" type="text" required maxLength={200} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Your name" />
              </div>
              <div>
                <label htmlFor="acceptance-email" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Email Address *</label>
                <input id="acceptance-email" type="email" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="you@example.com" />
              </div>
            </div>
            <fieldset className="min-w-0">
              <legend className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Project Type</legend>
              <div className="flex flex-wrap gap-2">
                {radioOptions('projectType', ['Project Base', 'Staff Augmentation'], true)}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" required name="projectType" value="Others (Specify)" checked={form.projectType === 'Others (Specify)'} onChange={() => handleRadioGroup('projectType', 'Others (Specify)')} className="w-4 h-4" style={{ accentColor: '#FF5900' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                </label>
                {form.projectType === 'Others (Specify)' && <input aria-label="Other project type" required type="text" maxLength={100} value={form.projectTypeOther} onChange={(e) => setForm({ ...form, projectTypeOther: e.target.value })} className="w-32 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />}
              </div>
            </fieldset>
            <fieldset
              ref={targetPlatformGroupRef}
              className="min-w-0"
              tabIndex={invalidGroups.targetPlatform ? -1 : undefined}
              aria-invalid={invalidGroups.targetPlatform || undefined}
              aria-describedby={invalidGroups.targetPlatform ? 'acceptance-submit-error' : undefined}
            >
              <legend className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Target Platform</legend>
              <div className="flex flex-wrap gap-2">
                {checkboxOptions('targetPlatform', ['PC', 'Mobile', 'Web', 'Console', 'Not sure yet'])}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" value="Others (Specify)" checked={form.targetPlatform.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('targetPlatform', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                </label>
                {form.targetPlatform.includes('Others (Specify)') && <input aria-label="Other target platform" required type="text" maxLength={100} value={form.targetPlatformOther} onChange={(e) => setForm({ ...form, targetPlatformOther: e.target.value })} className="w-32 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
                <label htmlFor="acceptance-timezone" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Timezone *</label>
                <input id="acceptance-timezone" required type="text" maxLength={200} list="timezones" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Type or select your timezone..." className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
                <datalist id="timezones">
                  <option value="UTC-12 — Baker Island / Howland Island">UTC-12</option>
                  <option value="UTC-11 — American Samoa / Niue">UTC-11</option>
                  <option value="UTC-10 — Hawaii / Papeete">UTC-10</option>
                  <option value="UTC-9:30 — Marquesas Islands">UTC-9:30</option>
                  <option value="UTC-9 — Alaska / Anchorage">UTC-9</option>
                  <option value="UTC-8 — Los Angeles / Vancouver / Tijuana">UTC-8</option>
                  <option value="UTC-7 — Denver / Phoenix / Calgary">UTC-7</option>
                  <option value="UTC-6 — Chicago / Mexico City / Winnipeg">UTC-6</option>
                  <option value="UTC-5 — New York / Toronto / Miami / Bogotá">UTC-5</option>
                  <option value="UTC-4 — Santiago / Caracas / Halifax / Manaus">UTC-4</option>
                  <option value="UTC-3:30 — St. John's / Newfoundland">UTC-3:30</option>
                  <option value="UTC-3 — Brasília / Buenos Aires / Montevideo">UTC-3</option>
                  <option value="UTC-2 — Fernando de Noronha / South Georgia">UTC-2</option>
                  <option value="UTC-1 — Azores / Cape Verde">UTC-1</option>
                  <option value="UTC+0 — London / Lisbon / Dublin / Accra">UTC+0</option>
                  <option value="UTC+1 — Paris / Berlin / Rome / Madrid / Lagos">UTC+1</option>
                  <option value="UTC+2 — Athens / Helsinki / Cairo / Jerusalem / Kyiv">UTC+2</option>
                  <option value="UTC+3 — Moscow / Istanbul / Nairobi / Baghdad">UTC+3</option>
                  <option value="UTC+3:30 — Tehran">UTC+3:30</option>
                  <option value="UTC+4 — Dubai / Baku / Muscat / Tbilisi">UTC+4</option>
                  <option value="UTC+4:30 — Kabul">UTC+4:30</option>
                  <option value="UTC+5 — Karachi / Tashkent / Yekaterinburg">UTC+5</option>
                  <option value="UTC+5:30 — India / Sri Lanka">UTC+5:30</option>
                  <option value="UTC+5:45 — Kathmandu / Nepal">UTC+5:45</option>
                  <option value="UTC+6 — Dhaka / Almaty / Omsk">UTC+6</option>
                  <option value="UTC+6:30 — Yangon / Myanmar">UTC+6:30</option>
                  <option value="UTC+7 — Bangkok / Jakarta / Hanoi / Krasnoyarsk">UTC+7</option>
                  <option value="UTC+8 — Singapore / Beijing / Perth / Manila / Kuala Lumpur">UTC+8</option>
                  <option value="UTC+8:45 — Eucla (Australia)">UTC+8:45</option>
                  <option value="UTC+9 — Tokyo / Seoul / Osaka / Yakutsk">UTC+9</option>
                  <option value="UTC+9:30 — Adelaide / Darwin">UTC+9:30</option>
                  <option value="UTC+10 — Sydney / Melbourne / Brisbane / Guam / Vladivostok">UTC+10</option>
                  <option value="UTC+10:30 — Lord Howe Island">UTC+10:30</option>
                  <option value="UTC+11 — Solomon Islands / Nouméa / Sakhalin">UTC+11</option>
                  <option value="UTC+12 — Auckland / Fiji / Kamchatka">UTC+12</option>
                  <option value="UTC+12:45 — Chatham Islands">UTC+12:45</option>
                  <option value="UTC+13 — Samoa / Tonga / Phoenix Islands">UTC+13</option>
                  <option value="UTC+14 — Line Islands / Kiritimati">UTC+14</option>
                </datalist>
              </div>
              <div>
                <label htmlFor="acceptance-start-date" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Start Date *</label>
                <input id="acceptance-start-date" required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
              </div>
              <div>
                <label htmlFor="acceptance-deadline" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Deadline *</label>
                <input id="acceptance-deadline" required type="date" min={form.startDate || undefined} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
              </div>
              <div>
                <label htmlFor="acceptance-budget" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Budget Range</label>
                <input id="acceptance-budget" type="text" maxLength={200} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g. $5,000 - $10,000" />
              </div>
            </div>
            <div>
              <label htmlFor="acceptance-document-link" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Link to Project Document</label>
              <input id="acceptance-document-link" type="url" maxLength={2048} value={form.docLink} onChange={(e) => setForm({ ...form, docLink: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="https://…" />
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
            <div className="p-4 rounded-xl flex items-start gap-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm" style={{ color: '#92400E', fontWeight: 300 }}>
                List each deliverable below. For every item, tell us what it is, what it should include, and how we'll know it's correct. Add as many rows as you need.
              </p>
            </div>

            {form.deliverableRows.map((row, i) => (
              <div key={i} className="rounded-xl border transition hover:shadow-md" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
                  <span className="text-xs font-semibold" style={{ color: '#374151' }}>Deliverable #{i + 1}</span>
                  <button type="button" onClick={() => removeDeliverableRow(i)} className="p-1 rounded hover:bg-red-50 transition" style={{ color: '#EF4444' }} title="Remove this deliverable">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`deliverable-name-${i}`} className="block text-xs mb-1" style={{ color: '#6B7280', fontWeight: 500 }}>Deliverable Name *</label>
                      <input id={`deliverable-name-${i}`} required type="text" maxLength={300} value={row.name} onChange={(e) => updateDeliverableRow(i, 'name', e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g. Game Trailer, Social Media Kit" />
                    </div>
                    <div>
                      <label htmlFor={`deliverable-quantity-${i}`} className="block text-xs mb-1" style={{ color: '#6B7280', fontWeight: 500 }}>Quantity</label>
                      <input id={`deliverable-quantity-${i}`} type="text" maxLength={100} value={row.quantity} onChange={(e) => updateDeliverableRow(i, 'quantity', e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g. 1, 5, 10" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`deliverable-description-${i}`} className="block text-xs mb-1" style={{ color: '#6B7280', fontWeight: 500 }}>Description</label>
                    <textarea id={`deliverable-description-${i}`} maxLength={2000} value={row.description} onChange={(e) => updateDeliverableRow(i, 'description', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Describe what this deliverable should include..." />
                  </div>
                  <div>
                    <label htmlFor={`deliverable-criteria-${i}`} className="block text-xs mb-1" style={{ color: '#6B7280', fontWeight: 500 }}>Acceptance Criteria *</label>
                    <textarea id={`deliverable-criteria-${i}`} required maxLength={3000} value={row.criteria} onChange={(e) => updateDeliverableRow(i, 'criteria', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="How will we know this is done? e.g. 1080p resolution, 30fps, approved by client" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`deliverable-reference-${i}`} className="block text-xs mb-1" style={{ color: '#6B7280', fontWeight: 500 }}>Reference Link</label>
                      <input id={`deliverable-reference-${i}`} type="url" maxLength={2048} value={row.reference} onChange={(e) => updateDeliverableRow(i, 'reference', e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="https://…" />
                    </div>
                    <div>
                      <label htmlFor={`deliverable-service-${i}`} className="block text-xs mb-1" style={{ color: '#6B7280', fontWeight: 500 }}>Service Type</label>
                      <input id={`deliverable-service-${i}`} type="text" maxLength={200} value={row.serviceType} onChange={(e) => updateDeliverableRow(i, 'serviceType', e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="e.g. 3D Modeling, Animation, Editing" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={addDeliverableRow} disabled={form.deliverableRows.length >= 20} className="w-full px-4 py-3 text-sm rounded-xl transition flex items-center justify-center gap-1.5 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" style={{ color: '#FF5900', backgroundColor: '#FFF0E6', border: '2px dashed #FFD6B3', fontWeight: 500 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {form.deliverableRows.length >= 20 ? 'Maximum 20 Deliverables' : 'Add Another Deliverable'}
            </button>
          </div>
        </div>

        {/* Section 3: Review & Approval */}
        <div className="rounded-2xl overflow-hidden theme-transition" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(27,26,28,0.06)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF5900, #FF8C33, #FFB366)' }}></div>
          <div className="px-6 py-3.5" style={{ backgroundColor: '#1B1A1C' }}>
            <h2 className="text-sm" style={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.02em' }}>SECTION C: REVIEW &amp; APPROVAL PROCESS</h2>
          </div>
          <div className="px-6 py-5 space-y-5">
            <fieldset
              ref={reviewerGroupRef}
              className="min-w-0"
              tabIndex={invalidGroups.reviewer ? -1 : undefined}
              aria-invalid={invalidGroups.reviewer || undefined}
              aria-describedby={invalidGroups.reviewer ? 'acceptance-submit-error' : undefined}
            >
              <legend className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Who will review and approve this?</legend>
              <p className="text-xs mb-2" style={{ color: '#9CA3AF', fontWeight: 300 }}>Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {checkboxOptions('reviewer', ['Client', "Client's Team", 'Stakeholders', "Client's QA"])}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" value="Others (Specify)" checked={form.reviewer.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('reviewer', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                </label>
                {form.reviewer.includes('Others (Specify)') && <input aria-label="Other reviewer" required type="text" maxLength={100} value={form.reviewerOther} onChange={(e) => setForm({ ...form, reviewerOther: e.target.value })} className="w-32 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />}
              </div>
            </fieldset>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Review Rounds Included</label>
                <p className="text-xs mb-2" style={{ color: '#9CA3AF', fontWeight: 300 }}>How many rounds of revisions are included?</p>
                <div className="flex flex-wrap gap-2">{radioOptions('reviewRounds', ['1', '2', '3', 'Not Sure'])}</div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Review Time</label>
                <p className="text-xs mb-2" style={{ color: '#9CA3AF', fontWeight: 300 }}>How long do you expect each review to take?</p>
                <div className="flex flex-wrap gap-2">{radioOptions('reviewTime', ['1 day', '2 days', '3 days', 'Not Sure'])}</div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Basis for Approval</label>
                <p className="text-xs mb-2" style={{ color: '#9CA3AF', fontWeight: 300 }}>What will the deliverables be measured against?</p>
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
              <div className="flex flex-wrap gap-2">
                {checkboxOptions('commsTool', ['Discord', 'Slack'])}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" value="Others (Specify)" checked={form.commsTool.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('commsTool', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                </label>
                {form.commsTool.includes('Others (Specify)') && <input aria-label="Other communication tool" required type="text" maxLength={100} value={form.commsToolOther} onChange={(e) => setForm({ ...form, commsToolOther: e.target.value })} className="w-32 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />}
              </div>
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
                  <div className="flex flex-wrap gap-2">
                {radioOptions('meetingTime', ['10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'])}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="meetingTime" value="Others (Specify)" checked={form.meetingTime === 'Others (Specify)'} onChange={() => handleRadioGroup('meetingTime', 'Others (Specify)')} className="w-4 h-4" style={{ accentColor: '#FF5900' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                </label>
                {form.meetingTime === 'Others (Specify)' && <input aria-label="Other preferred meeting time" required type="text" maxLength={100} value={form.meetingTimeOther} onChange={(e) => setForm({ ...form, meetingTimeOther: e.target.value })} className="w-32 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />}
              </div>
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
                  <div className="flex flex-wrap gap-2">
                {radioOptions('syncTime', ['10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'])}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="syncTime" value="Others (Specify)" checked={form.syncTime === 'Others (Specify)'} onChange={() => handleRadioGroup('syncTime', 'Others (Specify)')} className="w-4 h-4" style={{ accentColor: '#FF5900' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                </label>
                {form.syncTime === 'Others (Specify)' && <input aria-label="Other preferred sync time" required type="text" maxLength={100} value={form.syncTimeOther} onChange={(e) => setForm({ ...form, syncTimeOther: e.target.value })} className="w-32 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />}
              </div>
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
              <div className="flex flex-wrap gap-2">
                {checkboxOptions('gameEngine', ['Unity', 'Unreal', 'Not sure yet'])}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" value="Others (Specify)" checked={form.gameEngine.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('gameEngine', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                </label>
                {form.gameEngine.includes('Others (Specify)') && <input aria-label="Other game engine" required type="text" maxLength={100} value={form.gameEngineOther} onChange={(e) => setForm({ ...form, gameEngineOther: e.target.value })} className="w-32 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />}
              </div>
            </div>
            <div>
              <label htmlFor="acceptance-technical-requirements" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Technical Requirements</label>
              <textarea id="acceptance-technical-requirements" maxLength={5000} value={form.techRequirements} onChange={(e) => setForm({ ...form, techRequirements: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="File format, naming convention, output format, etc." />
            </div>
            <div>
              <label htmlFor="acceptance-tools-software" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Tools &amp; Software Required</label>
              <textarea id="acceptance-tools-software" maxLength={3000} value={form.toolsSoftware} onChange={(e) => setForm({ ...form, toolsSoftware: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="List any required tools or software" />
            </div>
            <div>
              <label htmlFor="acceptance-performance-constraints" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Performance &amp; Platform Constraints</label>
              <textarea id="acceptance-performance-constraints" maxLength={3000} value={form.performanceConstraints} onChange={(e) => setForm({ ...form, performanceConstraints: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Any performance targets or platform limitations" />
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
                <label htmlFor="acceptance-signature-name" className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Client Name *</label>
                <input id="acceptance-signature-name" type="text" maxLength={200} value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm transition focus:ring-2" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Type your full name" required />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Date</label>
                <div className="w-full px-3.5 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#D1D5DB', color: '#6B7280', backgroundColor: '#F9FAFB' }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>
            <SignaturePad
              dataUrl={form.signatureDataUrl}
              onDataUrlChange={(v) => setForm({ ...form, signatureDataUrl: v })}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="text-center pt-2">
          <div className="mb-4 flex justify-center">
            <Turnstile
              action="acceptance_form"
              onToken={setTurnstileToken}
              resetKey={turnstileResetKey}
            />
          </div>
          {submitError && (
            <p id="acceptance-submit-error" role="alert" className="mb-4 text-sm" style={{ color: '#B91C1C' }}>
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !turnstileToken}
            className="px-10 py-3 rounded-xl text-white text-sm font-medium transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center gap-2"
            style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 16px rgba(255,89,0,0.3)' }}
          >
            {submitting ? 'Submitting…' : 'Submit Form'}
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
