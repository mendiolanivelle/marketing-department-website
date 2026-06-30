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
    meetingTime: [] as string[],
    meetingTimeOther: '',
    dailySync: [] as string[],
    syncTime: [] as string[],
    syncTimeOther: '',
    training: [] as string[],
    gameEngine: [] as string[],
    gameEngineOther: '',
    techRequirements: '',
    toolsSoftware: '',
    performanceConstraints: '',
    signature: '',
    signatureDate: '',
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #FAFAFA 0%, #FFF5F0 100%)' }}>
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-[20px] flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #FF5900, #FF8C42)', boxShadow: '0 8px 24px rgba(255,89,0,0.25)' }}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl mb-3" style={{ color: '#1B1A1C', fontWeight: 800, letterSpacing: '-0.02em' }}>You're All Set!</h1>
          <p className="text-base mb-2" style={{ color: '#6B7280', fontWeight: 400 }}>
            Your Acceptance Criteria has been received by the Marketing Department team.
          </p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-xl font-bold tracking-wider" style={{ color: '#FF5900' }}>{generatedId}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedId).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
              }}
              className="p-2 rounded-xl transition border-2"
              style={{ color: '#6B7280', borderColor: '#E5E7EB' }}
              title="Copy to clipboard"
            >
              {copied ? (
                <svg className="w-5 h-5" style={{ color: '#10B981' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
          {copied && <p className="text-xs -mt-4 mb-4" style={{ color: '#10B981', fontWeight: 600 }}>Copied to clipboard!</p>}
          <p className="text-sm mb-8 px-6" style={{ color: '#6B7280', fontWeight: 400, lineHeight: 1.7 }}>
            Your tracking ID is <strong style={{ color: '#1B1A1C' }}>{generatedId}</strong>.<br />
            Our team will review your specifications and get back to you within 1-2 business days.
          </p>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                setSubmitted(false)
                setGeneratedId('')
                setCopied(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="px-8 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: '#FF5900', boxShadow: '0 6px 20px rgba(255,89,0,0.3)' }}
            >
              Submit Another Form
            </button>
            <p className="text-xs mt-2" style={{ color: '#9CA3AF', fontWeight: 400 }}>
              Exodia Game Development &middot; Marketing Department
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #FAFAFA 0%, #FFF5F0 100%)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="py-12 px-4 text-center" style={{ background: 'linear-gradient(135deg, #1B1A1C 0%, #2D2B2E 100%)', borderBottom: '3px solid #FF5900' }}>
        <div className="max-w-4xl mx-auto">
          <div className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #FF5900, #FF8C42)', boxShadow: '0 8px 24px rgba(255,89,0,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 1800.000000 1800.000000" preserveAspectRatio="xMidYMid meet">
            <g transform="translate(0.000000,1800.000000) scale(0.100000,-0.100000)" fill="#FF5900" stroke="none">
              <path d="M5620 14369 c-30 -16 -68 -38 -85 -49 -16 -11 -52 -31 -80 -45 -27 -14 -63 -35 -80 -45 -36 -22 -144 -84 -165 -93 -8 -4 -28 -16 -45 -27 -16 -11 -39 -24 -50 -30 -11 -6 -42 -24 -70 -41 -27 -16 -63 -37 -80 -45 -16 -8 -37 -19 -45 -24 -25 -17 -214 -126 -230 -133 -8 -4 -28 -16 -45 -27 -16 -11 -43 -26 -60 -35 -16 -8 -52 -28 -80 -45 -27 -16 -59 -34 -70 -40 -11 -5 -27 -14 -35 -20 -8 -5 -51 -30 -95 -55 -44 -26 -87 -51 -95 -56 -8 -5 -24 -14 -35 -19 -36 -19 -248 -140 -295 -169 -8 -5 -22 -12 -30 -15 -8 -4 -28 -15 -45 -26 -16 -11 -37 -23 -45 -27 -8 -4 -58 -33 -111 -65 -53 -32 -100 -58 -103 -58 -4 0 -25 -12 -49 -27 -57 -37 -73 -47 -132 -77 -27 -15 -57 -31 -65 -36 -8 -5 -51 -30 -95 -55 -44 -26 -87 -51 -95 -56 -8 -5 -25 -13 -37 -18 -11 -6 -24 -15 -28 -20 -3 -6 -12 -11 -20 -11 -8 0 -33 -13 -57 -29 -24 -16 -61 -39 -83 -50 -22 -12 -47 -26 -55 -31 -29 -19 -165 -96 -180 -103 -41 -19 -95 -56 -92 -63 2 -9 61 -47 92 -60 8 -4 22 -13 30 -19 8 -7 47 -30 85 -50 39 -21 82 -46 96 -56 15 -10 37 -23 50 -29 26 -12 42 -21 106 -63 24 -15 45 -27 49 -27 6 0 132 -73 174 -100 8 -6 24 -14 35 -19 11 -5 37 -21 58 -35 21 -14 42 -26 47 -26 5 0 28 -13 52 -29 24 -16 61 -39 83 -50 22 -12 47 -26 55 -31 46 -28 268 -157 280 -163 8 -4 29 -16 45 -27 17 -11 40 -24 52 -29 11 -5 24 -15 28 -20 3 -6 12 -11 20 -11 8 0 31 -12 52 -26 21 -14 47 -30 58 -35 11 -5 34 -18 50 -29 17 -11 37 -23 45 -27 8 -3 33 -18 55 -32 22 -14 60 -36 85 -48 25 -13 59 -32 75 -43 17 -11 39 -24 50 -30 11 -6 34 -19 50 -30 17 -11 37 -23 45 -27 8 -3 33 -18 55 -32 39 -24 102 -59 158 -88 15 -8 27 -19 27 -24 0 -5 9 -9 21 -9 12 0 38 -13 59 -30 21 -16 40 -30 44 -30 5 0 158 -87 214 -122 15 -9 50 -29 77 -43 28 -14 64 -34 80 -45 17 -11 39 -24 50 -30 11 -6 35 -20 54 -31 40 -24 26 -29 206 76 66 39 136 79 155 90 19 10 53 29 75 42 22 12 49 27 60 33 11 6 29 16 40 23 11 7 70 41 130 75 132 76 138 79 193 115 24 15 49 27 57 27 8 0 17 5 20 11 4 5 17 15 28 20 12 5 36 18 52 28 17 11 62 36 100 56 39 21 77 44 86 51 8 8 20 14 26 14 6 0 16 7 23 15 7 8 19 15 27 15 8 0 29 11 46 24 18 14 43 29 57 35 14 6 34 17 45 23 93 59 127 79 175 103 30 14 62 32 70 39 8 7 22 16 30 20 8 3 38 20 65 37 28 16 64 37 80 45 17 8 39 20 50 27 41 26 101 62 120 73 11 6 43 23 70 38 28 15 73 41 100 57 28 17 64 37 80 45 17 8 44 23 60 34 17 11 39 24 50 30 11 6 34 19 50 30 17 11 53 31 80 45 28 14 64 35 80 45 17 11 37 23 45 27 8 4 44 24 79 46 35 21 74 43 85 48 12 5 35 18 51 29 17 11 40 24 52 29 11 5 24 15 28 20 3 6 13 11 21 11 9 0 30 11 47 24 18 14 43 29 57 35 45 20 100 56 100 66 0 10 -53 45 -96 64 -19 8 -136 77 -174 101 -8 6 -22 13 -30 17 -8 4 -82 46 -164 95 -81 48 -152 88 -156 88 -4 0 -13 7 -20 15 -7 8 -21 15 -31 15 -10 0 -22 6 -26 13 -4 7 -19 18 -33 24 -14 7 -47 26 -75 42 -27 17 -61 35 -74 41 -13 6 -38 21 -55 33 -35 25 -41 29 -138 81 -40 21 -80 45 -89 52 -8 8 -19 14 -23 14 -5 0 -28 14 -53 30 -24 17 -48 30 -52 30 -4 0 -27 14 -49 30 -23 17 -46 30 -51 30 -6 0 -29 13 -53 29 -24 16 -61 39 -83 50 -22 12 -47 26 -55 31 -31 19 -166 96 -180 103 -8 4 -28 16 -45 27 -16 11 -39 24 -50 29 -11 5 -37 21 -58 35 -21 14 -44 26 -52 26 -8 0 -17 5 -20 11 -4 5 -17 15 -28 20 -12 5 -35 18 -52 29 -16 11 -39 24 -50 30 -11 6 -33 19 -50 30 -16 11 -37 23 -45 27 -20 9 -235 134 -268 155 -15 10 -37 22 -49 27 -11 5 -24 15 -28 20 -3 6 -13 11 -22 11 -9 0 -24 6 -32 14 -9 7 -47 31 -86 51 -38 21 -71 42 -73 47 -2 4 -9 8 -15 8 -6 0 -18 6 -26 13 -42 35 -64 36 -121 6z"/>
              <path d="M12285 14387 c-10 -7 -37 -23 -60 -37 -42 -26 -51 -31 -130 -74 -27 -15 -63 -36 -80 -47 -16 -10 -37 -22 -45 -26 -8 -4 -44 -25 -80 -46 -36 -22 -90 -53 -120 -70 -30 -16 -86 -48 -123 -71 -71 -42 -171 -100 -197 -112 -8 -5 -47 -27 -86 -51 -39 -24 -76 -43 -82 -43 -5 0 -12 -7 -16 -15 -3 -8 -14 -15 -25 -15 -11 0 -23 -5 -26 -11 -4 -5 -17 -15 -28 -20 -12 -5 -35 -18 -52 -29 -16 -11 -37 -23 -45 -27 -8 -4 -47 -26 -86 -50 -39 -24 -75 -43 -79 -43 -4 0 -24 -13 -45 -30 -21 -16 -47 -30 -59 -30 -12 0 -21 -5 -21 -10 0 -6 -8 -13 -17 -17 -10 -3 -72 -38 -138 -77 -66 -40 -138 -80 -160 -91 -22 -11 -42 -23 -45 -26 -3 -3 -34 -22 -70 -43 -36 -20 -72 -41 -80 -46 -8 -5 -33 -19 -55 -31 -22 -11 -59 -34 -83 -50 -24 -16 -48 -29 -53 -29 -6 0 -25 -11 -42 -24 -18 -14 -43 -29 -57 -35 -14 -6 -43 -22 -65 -36 -22 -14 -56 -34 -75 -45 -19 -11 -51 -30 -70 -42 -19 -11 -53 -31 -75 -42 -35 -20 -68 -39 -140 -83 -11 -7 -42 -24 -70 -39 -72 -38 -78 -44 -63 -61 7 -8 21 -19 33 -24 11 -5 47 -25 80 -44 33 -19 69 -40 80 -45 11 -6 34 -19 50 -30 17 -11 39 -24 51 -29 11 -5 50 -27 85 -48 35 -22 71 -42 79 -46 8 -4 29 -16 45 -27 17 -11 37 -22 45 -26 8 -3 22 -10 30 -15 8 -5 24 -14 35 -19 11 -6 34 -19 50 -30 17 -11 39 -24 51 -29 11 -5 51 -28 88 -50 36 -23 69 -41 72 -41 3 0 26 -13 51 -30 24 -16 46 -30 48 -30 3 0 39 -20 81 -45 41 -25 82 -45 90 -45 8 0 17 -7 20 -15 4 -8 11 -15 16 -15 6 0 44 -20 85 -45 40 -25 77 -45 82 -45 4 0 26 -12 48 -27 53 -38 71 -48 123 -75 25 -12 81 -44 125 -71 102 -62 107 -64 125 -71 8 -4 29 -15 45 -26 17 -11 37 -22 45 -26 17 -6 22 -9 110 -62 36 -22 88 -52 115 -67 28 -15 57 -34 66 -41 8 -8 23 -14 31 -14 9 0 18 -7 22 -15 3 -8 14 -15 24 -15 10 0 23 -5 29 -11 14 -14 50 -35 86 -50 15 -6 27 -15 27 -20 0 -5 5 -9 11 -9 6 0 45 -20 86 -45 40 -25 76 -45 79 -45 2 0 23 -12 47 -27 23 -15 60 -37 82 -49 22 -11 56 -31 75 -42 19 -12 44 -26 56 -31 11 -5 50 -27 86 -49 35 -22 74 -43 86 -46 12 -4 22 -11 22 -16 0 -4 8 -10 18 -14 9 -3 24 -9 32 -14 50 -30 63 -33 73 -23 6 6 16 11 23 11 7 0 43 20 81 45 37 25 72 45 77 45 4 0 28 14 53 30 24 17 46 30 48 30 2 0 36 19 77 43 40 24 80 46 88 50 8 4 29 16 45 27 17 11 40 24 52 29 11 5 24 15 28 20 3 6 12 11 20 11 7 0 37 16 66 36 30 20 68 43 84 51 17 7 44 22 60 33 17 11 37 23 45 27 9 5 57 33 108 63 101 60 157 92 224 129 24 13 62 36 86 52 24 16 48 29 53 29 6 0 25 11 42 24 18 14 43 29 57 35 14 6 32 15 40 21 22 15 212 125 230 133 8 4 29 16 45 26 17 11 50 30 75 42 25 13 47 26 50 30 6 8 103 64 138 79 12 5 22 14 22 20 0 5 9 10 19 10 11 0 22 4 26 9 3 6 18 16 33 24 55 29 118 64 157 88 22 14 47 29 55 32 8 4 38 21 65 38 28 16 65 37 83 45 17 8 32 19 32 24 0 6 8 10 19 10 10 0 24 7 31 15 7 8 19 15 26 15 8 0 14 4 14 9 0 5 12 14 28 20 15 6 34 15 42 21 34 22 171 100 178 100 4 0 18 9 32 20 l25 19 -45 21 c-25 11 -58 30 -75 40 -16 11 -39 24 -50 30 -11 5 -27 14 -35 19 -35 22 -166 98 -180 104 -8 4 -28 16 -45 26 -16 11 -46 28 -65 38 -87 46 -156 87 -171 99 -8 8 -20 14 -26 14 -6 0 -16 7 -23 15 -7 8 -18 15 -26 15 -7 0 -32 12 -56 28 -24 15 -52 33 -63 40 -11 7 -32 17 -47 23 -16 6 -28 15 -28 20 0 5 -5 9 -10 9 -9 0 -71 34 -249 138 -31 18 -66 36 -78 42 -11 5 -24 14 -28 19 -3 6 -15 11 -25 11 -10 0 -23 6 -27 13 -4 7 -19 18 -33 24 -14 7 -47 26 -75 42 -27 17 -59 35 -70 40 -11 5 -36 20 -56 34 -21 14 -46 28 -58 32 -12 3 -21 11 -21 16 0 5 -8 9 -19 9 -10 0 -24 7 -31 15 -7 8 -17 15 -22 15 -5 0 -54 27 -109 60 -55 33 -102 60 -105 60 -4 0 -26 14 -51 30 -24 17 -48 30 -53 30 -5 0 -28 13 -52 29 -24 16 -61 39 -83 51 -22 11 -67 37 -100 56 -33 19 -69 39 -80 44 -11 6 -33 19 -50 30 -16 11 -40 24 -52 29 -11 5 -24 15 -28 20 -3 6 -12 11 -20 11 -8 0 -33 13 -57 29 -24 16 -61 39 -83 51 -22 12 -56 31 -75 42 -19 11 -53 31 -75 42 -22 12 -59 34 -82 49 -24 15 -45 27 -48 27 -3 0 -24 12 -48 27 -35 22 -149 84 -151 82 -1 0 -10 -6 -21 -12z"/>
              <path d="M8715 12324 c-33 -20 -80 -47 -105 -61 -25 -13 -58 -33 -75 -44 -16 -10 -39 -23 -50 -29 -11 -6 -40 -22 -65 -36 -78 -46 -124 -72 -162 -93 -21 -11 -57 -33 -80 -48 -24 -15 -63 -38 -88 -50 -25 -13 -52 -28 -60 -33 -47 -30 -156 -93 -174 -101 -12 -5 -34 -18 -51 -29 -16 -11 -40 -24 -52 -29 -11 -5 -24 -15 -28 -20 -3 -6 -13 -11 -22 -11 -9 0 -24 -7 -33 -15 -15 -13 -72 -48 -125 -75 -11 -6 -33 -19 -50 -30 -16 -10 -50 -29 -75 -42 -25 -13 -47 -26 -50 -29 -3 -4 -27 -19 -55 -33 -27 -15 -56 -32 -65 -40 -8 -7 -31 -20 -50 -30 -19 -9 -51 -26 -70 -38 -19 -11 -57 -32 -83 -47 -56 -31 -81 -45 -122 -71 -16 -10 -50 -29 -75 -42 -25 -13 -47 -26 -50 -30 -3 -4 -17 -12 -30 -18 -14 -5 -38 -19 -55 -30 -16 -11 -39 -24 -50 -30 -11 -6 -33 -19 -50 -30 -16 -11 -39 -24 -50 -30 -11 -5 -28 -14 -37 -20 -10 -5 -26 -15 -35 -20 -10 -6 -27 -15 -38 -20 -11 -6 -33 -19 -50 -30 -16 -11 -39 -24 -50 -30 -11 -5 -47 -26 -80 -45 -33 -19 -69 -39 -80 -45 -11 -6 -33 -19 -50 -30 -16 -10 -54 -31 -82 -47 -29 -15 -53 -31 -53 -35 0 -4 -7 -8 -15 -8 -8 0 -31 -12 -52 -26 -21 -14 -47 -30 -58 -35 -11 -5 -33 -18 -50 -29 -16 -11 -39 -24 -50 -30 -11 -5 -47 -26 -80 -45 -33 -19 -69 -39 -80 -45 -11 -6 -33 -19 -50 -30 -16 -11 -39 -24 -50 -29 -47 -21 -45 44 -45 -1487 0 -797 3 -1449 7 -1448 22 3 53 17 53 24 0 5 12 13 28 19 15 6 34 15 42 21 33 21 205 123 225 131 22 11 40 21 102 62 24 15 45 27 48 27 2 0 35 18 71 41 37 22 78 45 91 50 12 4 23 13 23 19 0 5 9 10 19 10 11 0 23 5 26 11 4 5 17 14 28 20 12 5 29 13 37 19 38 24 257 153 275 161 11 5 32 17 47 27 62 40 209 122 218 122 6 0 10 4 10 10 0 5 11 12 25 16 13 3 29 12 36 20 6 8 20 14 30 14 11 0 19 4 19 9 0 10 8 15 105 66 28 14 64 35 80 45 17 11 39 24 50 30 11 6 34 19 50 30 17 11 37 23 45 27 8 3 38 20 65 38 28 17 66 39 85 48 19 10 49 27 65 37 17 11 39 24 50 30 11 6 34 19 50 30 17 11 39 24 50 30 11 5 47 26 80 45 33 19 67 38 75 41 8 4 22 13 30 19 8 7 42 27 75 46 33 18 78 43 100 56 22 12 47 26 55 30 8 4 33 19 55 33 54 34 73 45 120 71 22 11 59 34 83 50 24 16 49 29 57 29 8 0 18 6 22 13 4 6 26 21 48 32 22 11 83 46 136 77 53 32 101 58 107 58 5 0 12 7 16 15 3 8 14 15 24 15 11 0 25 7 32 15 7 8 19 15 26 15 12 0 14 226 14 1455 0 800 -3 1455 -7 1455 -5 0 -35 -16 -68 -36z"/>
              <path d="M9210 10907 l0 -1453 43 -23 c23 -12 56 -31 72 -41 17 -11 39 -24 51 -29 24 -11 126 -72 134 -80 3 -4 23 -15 45 -26 22 -11 58 -31 80 -45 68 -42 79 -49 100 -58 11 -6 73 -42 138 -81 65 -39 120 -71 124 -71 3 0 25 -13 50 -30 24 -16 48 -30 53 -30 5 0 28 -13 52 -29 55 -36 126 -78 157 -91 13 -6 38 -21 55 -33 35 -25 41 -29 138 -81 40 -21 80 -44 88 -51 8 -6 22 -15 30 -19 8 -3 29 -15 45 -25 17 -11 54 -32 83 -47 28 -15 52 -31 52 -36 0 -4 7 -8 14 -8 8 0 34 -13 58 -29 24 -16 61 -39 83 -50 22 -12 47 -26 55 -31 31 -19 166 -96 180 -103 8 -4 29 -16 45 -27 17 -11 39 -24 50 -30 11 -6 34 -19 50 -30 17 -11 42 -25 58 -31 15 -6 27 -15 27 -20 0 -5 9 -9 19 -9 11 0 23 -5 26 -11 4 -5 17 -15 28 -20 12 -5 36 -18 52 -29 17 -11 39 -25 50 -30 55 -30 224 -127 260 -150 17 -11 39 -24 50 -30 42 -23 67 -38 78 -49 6 -6 17 -11 24 -11 12 0 66 -33 83 -50 3 -3 27 -16 53 -30 70 -36 87 -46 100 -59 6 -6 19 -11 29 -11 10 0 18 -5 18 -10 0 -6 10 -14 23 -19 12 -5 60 -32 107 -60 47 -28 88 -51 93 -51 4 0 6 656 5 1457 l-3 1458 -65 37 c-36 20 -74 42 -85 48 -11 6 -33 19 -50 30 -16 11 -40 24 -52 29 -11 5 -24 15 -28 20 -3 6 -12 11 -20 11 -8 0 -33 13 -57 29 -53 35 -126 78 -155 91 -13 5 -23 14 -23 20 0 5 -9 10 -19 10 -11 0 -39 13 -63 29 -36 24 -266 158 -358 208 -14 8 -38 23 -55 33 -16 10 -50 30 -75 43 -25 14 -61 34 -80 46 -19 11 -55 32 -80 46 -25 14 -72 41 -105 60 -33 20 -69 40 -80 45 -11 6 -33 19 -50 30 -16 11 -39 24 -50 30 -11 6 -33 19 -50 30 -16 11 -43 26 -60 34 -16 8 -52 29 -80 45 -27 17 -59 35 -70 41 -11 6 -33 19 -50 30 -16 11 -39 24 -50 30 -11 6 -47 26 -80 45 -33 19 -70 40 -82 45 -13 5 -23 14 -23 20 0 5 -8 10 -19 10 -10 0 -24 6 -30 14 -7 8 -23 17 -36 20 -14 4 -25 11 -25 16 0 6 -5 10 -11 10 -6 0 -37 15 -68 34 -75 45 -160 94 -191 109 -14 6 -27 15 -30 19 -3 4 -26 18 -50 31 -74 40 -140 77 -243 139 -55 32 -102 58 -107 58 -4 0 -13 7 -20 15 -7 8 -21 15 -32 15 -10 0 -21 7 -24 15 -4 8 -11 15 -16 15 -6 0 -43 19 -82 43 -39 24 -78 46 -86 50 -8 4 -28 16 -45 27 -33 21 -86 50 -92 50 -1 0 -3 -654 -3 -1453z"/>
              <path d="M8900 9027 c-58 -34 -116 -68 -130 -75 -45 -23 -71 -39 -83 -51 -6 -6 -19 -11 -29 -11 -10 0 -18 -4 -18 -9 0 -5 -12 -16 -27 -24 -72 -36 -169 -91 -183 -101 -8 -7 -33 -21 -55 -31 -22 -11 -46 -26 -53 -32 -7 -7 -17 -13 -22 -13 -5 0 -29 -13 -53 -30 -25 -16 -52 -30 -60 -30 -9 0 -20 -6 -24 -12 -9 -14 -24 -24 -98 -64 -27 -14 -64 -37 -82 -50 -17 -13 -38 -24 -46 -24 -8 0 -20 -7 -27 -15 -7 -8 -18 -15 -25 -15 -7 0 -45 -22 -86 -48 -41 -27 -96 -60 -124 -74 -80 -40 -118 -62 -133 -75 -7 -7 -20 -13 -28 -13 -8 0 -17 -7 -20 -15 -4 -8 -14 -15 -24 -15 -11 0 -22 -5 -25 -11 -4 -5 -17 -15 -28 -20 -30 -13 -103 -55 -155 -90 -24 -16 -49 -29 -57 -29 -8 0 -17 -5 -20 -11 -4 -5 -17 -15 -28 -20 -12 -5 -31 -15 -42 -22 -11 -7 -51 -30 -90 -52 -38 -22 -78 -44 -87 -50 -9 -5 -36 -21 -60 -34 -24 -13 -62 -36 -86 -52 -24 -16 -48 -29 -53 -29 -6 0 -25 -11 -42 -24 -18 -14 -43 -29 -57 -35 -14 -6 -32 -15 -40 -21 -59 -38 -166 -100 -172 -100 -5 0 -27 -12 -51 -27 -56 -37 -74 -47 -127 -74 -25 -13 -49 -27 -55 -32 -13 -10 -147 -88 -205 -119 -25 -12 -47 -26 -50 -29 -3 -3 -15 -11 -28 -18 -25 -13 -21 -27 11 -42 12 -5 36 -18 52 -29 17 -11 37 -22 45 -26 8 -3 22 -9 30 -14 8 -5 62 -37 120 -71 126 -74 236 -138 270 -157 14 -7 39 -22 55 -32 17 -11 39 -24 50 -30 11 -6 47 -26 80 -45 33 -19 80 -46 105 -60 25 -14 59 -34 75 -45 17 -11 37 -23 45 -27 8 -4 71 -40 139 -80 67 -40 125 -73 128 -73 3 0 25 -13 50 -30 24 -16 47 -30 50 -30 3 0 60 -33 127 -73 66 -40 128 -76 136 -80 8 -4 29 -16 45 -27 17 -11 37 -23 45 -27 13 -5 160 -91 225 -130 11 -7 31 -17 45 -23 14 -6 39 -22 57 -36 17 -13 38 -24 46 -24 8 0 20 -7 27 -15 7 -8 16 -15 21 -15 4 0 27 -13 51 -29 24 -15 66 -41 93 -56 79 -43 140 -79 145 -85 5 -5 46 -28 115 -63 22 -11 54 -31 72 -44 17 -12 35 -23 39 -23 3 0 39 -19 78 -43 39 -24 78 -46 86 -50 8 -4 29 -16 45 -27 17 -11 39 -24 50 -30 11 -6 34 -19 50 -30 17 -11 53 -31 80 -45 28 -14 65 -35 84 -46 40 -24 31 -27 195 71 32 19 70 43 85 52 14 10 40 24 56 33 51 26 112 61 143 83 16 12 40 26 53 32 13 6 38 19 54 30 17 11 37 23 45 27 8 4 92 53 187 110 94 57 174 103 177 103 3 0 22 12 43 26 21 14 47 30 58 35 11 5 27 13 35 19 40 26 168 100 173 100 4 0 23 12 44 26 21 14 47 30 58 35 11 5 27 13 35 19 25 17 364 216 380 223 8 4 24 13 35 19 10 7 37 24 60 38 22 13 49 30 60 37 11 7 27 16 35 20 15 7 253 146 280 164 8 5 22 12 30 16 7 4 79 45 160 93 80 47 152 89 160 93 8 4 29 16 45 27 17 11 37 23 45 27 8 4 34 20 56 35 23 15 47 28 52 28 6 0 37 17 69 39 32 21 81 50 108 65 87 47 125 71 127 80 3 8 -54 46 -98 65 -19 8 -135 76 -174 101 -8 6 -26 15 -40 21 -14 6 -39 21 -57 35 -17 13 -38 24 -46 24 -8 0 -20 7 -27 15 -7 8 -17 15 -23 15 -6 0 -18 6 -26 14 -9 7 -47 31 -86 51 -38 21 -86 48 -105 60 -19 12 -42 25 -50 28 -8 4 -28 16 -45 27 -16 11 -40 24 -52 29 -11 5 -24 15 -28 20 -3 6 -12 11 -20 11 -8 0 -33 13 -57 29 -24 16 -62 39 -86 52 -24 13 -51 29 -60 34 -9 6 -60 35 -112 65 -52 30 -104 60 -115 67 -11 7 -29 16 -41 22 -11 5 -50 27 -86 49 -35 22 -74 43 -86 46 -12 4 -22 11 -22 16 0 4 -8 10 -17 14 -10 3 -31 14 -48 25 -16 11 -46 28 -65 38 -62 33 -152 85 -253 145 -55 32 -102 58 -107 58 -4 0 -13 7 -20 15 -7 8 -21 15 -31 15 -10 0 -22 6 -26 13 -4 7 -19 18 -33 24 -14 7 -47 26 -75 43 -27 16 -57 33 -65 37 -8 4 -46 26 -85 48 -38 23 -77 44 -85 48 -8 4 -28 16 -45 27 -16 11 -39 24 -50 29 -11 5 -36 20 -55 32 -19 13 -55 34 -80 47 -25 13 -58 32 -75 42 -16 11 -39 24 -50 30 -11 6 -33 19 -50 30 -16 11 -40 24 -52 29 -12 6 -39 21 -60 34 -56 35 -133 77 -141 77 -4 0 -54 -28 -112 -63z"/>
              <path d="M5361 7005 c-29 -19 -57 -35 -63 -35 -5 0 -24 -11 -41 -24 -18 -14 -43 -29 -57 -35 -14 -6 -32 -15 -40 -21 -8 -5 -51 -30 -95 -55 -44 -26 -87 -51 -95 -56 -8 -5 -24 -14 -35 -19 -11 -6 -33 -19 -50 -30 -16 -11 -42 -25 -57 -31 -16 -6 -28 -14 -28 -19 0 -4 -8 -10 -17 -14 -10 -3 -25 -10 -33 -15 -34 -23 -155 -93 -174 -102 -12 -5 -28 -13 -36 -19 -39 -25 -206 -123 -225 -131 -11 -5 -29 -15 -40 -21 -26 -17 -95 -60 -120 -74 -11 -7 -40 -22 -65 -35 -25 -12 -47 -26 -50 -30 -3 -4 -17 -13 -30 -18 -26 -11 -33 -16 -108 -63 -24 -16 -50 -28 -58 -28 -7 0 -14 -4 -14 -8 0 -5 -25 -22 -55 -38 -64 -34 -75 -40 -132 -77 -24 -15 -47 -27 -53 -27 -6 0 -29 -13 -52 -30 -22 -16 -45 -30 -51 -30 -5 0 -26 -13 -47 -30 -21 -16 -43 -30 -48 -30 -6 0 -31 -13 -55 -30 -25 -16 -47 -30 -51 -30 -3 0 -47 -25 -98 -56 -50 -31 -101 -60 -113 -65 -20 -9 -28 -14 -100 -59 -22 -14 -60 -36 -85 -49 -25 -12 -58 -31 -75 -41 -16 -10 -48 -28 -70 -40 -22 -12 -58 -34 -80 -49 -22 -15 -57 -35 -77 -44 -21 -10 -38 -21 -38 -24 0 -9 33 -32 47 -33 7 0 31 -13 55 -29 61 -41 129 -79 161 -92 15 -6 27 -14 27 -19 0 -4 8 -10 18 -14 9 -3 25 -10 35 -16 34 -20 52 -30 72 -40 11 -6 34 -19 50 -30 17 -11 37 -23 45 -27 8 -4 47 -25 85 -48 39 -22 77 -44 85 -48 8 -4 42 -23 75 -42 33 -19 69 -40 80 -45 11 -6 34 -19 50 -30 17 -11 39 -24 50 -30 11 -6 34 -19 50 -30 17 -11 44 -26 60 -34 17 -8 53 -29 80 -45 28 -17 73 -42 100 -56 75 -40 98 -53 118 -67 29 -21 90 -57 117 -69 13 -5 27 -13 30 -17 3 -4 25 -17 50 -30 25 -13 59 -32 75 -42 52 -33 79 -48 114 -65 19 -8 58 -30 85 -48 28 -17 60 -38 71 -45 11 -6 31 -17 45 -23 14 -6 39 -21 57 -35 17 -13 38 -24 47 -24 8 0 18 -5 21 -11 4 -5 17 -14 28 -20 12 -5 31 -15 42 -21 53 -34 104 -64 145 -85 63 -33 90 -49 103 -62 6 -6 17 -11 23 -11 7 0 32 -12 56 -27 74 -48 82 -53 108 -65 14 -7 38 -21 53 -31 16 -11 58 -35 95 -54 37 -20 74 -42 83 -49 8 -8 21 -14 27 -14 6 0 17 -6 24 -12 8 -7 29 -21 48 -32 93 -49 146 -80 160 -91 30 -24 80 -39 93 -26 6 6 18 11 26 11 8 0 22 7 31 15 15 13 72 48 125 75 11 6 34 19 50 30 17 10 50 30 75 42 25 13 64 36 87 51 24 15 47 27 52 27 5 0 14 7 21 15 7 8 31 24 54 35 22 11 57 29 76 41 19 12 56 33 83 46 26 14 47 29 47 34 0 5 9 9 19 9 11 0 23 5 26 11 4 5 17 15 28 20 12 5 36 18 52 29 17 10 50 29 75 42 25 13 47 26 50 30 3 4 17 12 30 18 14 5 39 19 55 30 17 11 39 24 50 30 42 23 67 38 78 49 6 6 17 11 25 11 7 0 28 11 45 24 18 14 43 30 57 35 14 6 39 20 55 31 17 11 39 24 50 30 11 6 34 19 50 30 17 11 36 22 43 25 6 3 18 7 25 10 6 3 26 14 42 25 17 11 39 24 50 30 11 6 34 19 50 30 17 11 37 23 45 27 8 4 44 24 79 46 35 21 74 43 85 48 22 9 30 14 104 62 24 15 45 27 47 27 3 0 35 18 71 41 37 22 77 45 88 50 12 5 35 18 51 29 17 11 39 24 50 30 11 6 43 24 70 41 28 16 64 37 80 45 17 8 44 23 60 34 17 11 39 24 50 30 11 6 34 19 50 30 17 11 39 24 50 30 11 5 47 26 80 45 33 19 67 38 75 41 8 4 23 14 33 22 16 14 13 17 -35 47 -29 17 -60 34 -68 38 -8 4 -37 21 -65 37 -27 16 -65 38 -82 47 -18 9 -33 20 -33 25 0 4 -9 8 -19 8 -11 0 -23 5 -26 11 -4 5 -17 14 -28 20 -12 5 -29 13 -37 18 -8 5 -51 30 -95 56 -44 25 -87 50 -95 55 -8 5 -35 20 -60 32 -25 13 -49 29 -53 35 -4 7 -16 13 -25 13 -10 0 -22 4 -28 10 -10 10 -240 144 -289 168 -16 8 -44 25 -62 38 -17 13 -36 24 -42 24 -5 0 -29 13 -53 29 -52 34 -125 77 -154 90 -11 5 -51 28 -88 50 -36 23 -69 41 -72 41 -4 0 -39 19 -78 43 -39 24 -78 46 -86 50 -8 4 -28 16 -45 27 -16 11 -41 24 -54 30 -13 6 -35 19 -50 29 -14 10 -48 31 -76 45 -27 15 -63 36 -80 47 -16 10 -39 23 -51 28 -18 8 -130 73 -174 101 -8 5 -28 16 -45 24 -16 8 -52 29 -80 45 -27 17 -59 35 -70 41 -11 6 -33 19 -50 29 -16 11 -50 30 -75 42 -25 12 -63 34 -85 48 -56 35 -73 45 -130 75 -27 15 -63 35 -80 46 -77 49 -283 160 -296 160 -8 0 -38 -16 -68 -35z"/>
              <path d="M12485 7010 c-58 -33 -106 -60 -155 -86 -19 -11 -39 -25 -43 -31 -4 -7 -16 -13 -26 -13 -10 0 -24 -7 -31 -15 -7 -8 -16 -15 -21 -15 -5 0 -52 -26 -106 -58 -98 -57 -127 -74 -193 -109 -19 -10 -40 -24 -48 -30 -7 -7 -20 -13 -28 -13 -8 0 -17 -7 -20 -15 -4 -8 -14 -15 -24 -15 -11 0 -22 -5 -25 -11 -4 -5 -17 -14 -28 -20 -12 -5 -29 -13 -37 -18 -8 -5 -22 -12 -30 -16 -16 -6 -34 -17 -97 -58 -24 -15 -45 -27 -49 -27 -3 0 -26 -13 -51 -30 -24 -16 -50 -30 -58 -30 -8 0 -17 -5 -20 -11 -4 -5 -17 -15 -28 -20 -12 -5 -38 -19 -57 -30 -44 -27 -123 -72 -175 -100 -22 -12 -44 -28 -48 -35 -4 -8 -15 -14 -23 -14 -8 0 -33 -11 -55 -25 -22 -14 -50 -30 -62 -36 -24 -11 -41 -21 -104 -62 -24 -15 -45 -27 -47 -27 -3 0 -39 -20 -79 -45 -41 -25 -79 -45 -85 -45 -5 0 -15 -7 -22 -15 -7 -8 -21 -15 -31 -15 -11 0 -19 -5 -19 -10 0 -6 -10 -15 -22 -20 -13 -6 -30 -14 -38 -19 -8 -5 -22 -12 -30 -15 -8 -4 -28 -15 -45 -26 -16 -11 -39 -24 -50 -30 -11 -6 -42 -24 -70 -41 -27 -16 -63 -37 -80 -45 -16 -8 -43 -23 -60 -34 -32 -20 -141 -82 -165 -94 -8 -4 -24 -12 -35 -19 -11 -7 -56 -34 -100 -60 -44 -26 -88 -52 -97 -57 -10 -6 -26 -15 -35 -20 -10 -6 -27 -15 -38 -20 -11 -6 -33 -19 -50 -30 -16 -11 -52 -31 -80 -45 -27 -14 -63 -35 -80 -45 -16 -11 -36 -23 -42 -26 -21 -10 -15 -21 20 -38 35 -18 50 -27 115 -68 24 -16 50 -28 58 -28 7 0 14 -5 14 -10 0 -6 11 -15 23 -19 13 -5 54 -28 91 -50 36 -23 69 -41 71 -41 3 0 24 -12 48 -27 59 -38 78 -50 112 -67 31 -16 81 -45 183 -108 33 -20 70 -39 81 -43 12 -3 21 -11 21 -16 0 -5 4 -9 10 -9 5 0 55 -27 111 -60 55 -33 102 -60 104 -60 2 0 61 -34 130 -75 70 -41 131 -75 135 -75 4 0 13 -7 20 -15 7 -8 21 -15 32 -15 10 0 21 -7 24 -15 4 -8 11 -15 16 -15 6 0 47 -22 92 -49 139 -84 150 -90 172 -100 19 -8 135 -76 174 -101 8 -6 24 -15 35 -20 11 -6 34 -19 50 -30 17 -11 44 -26 60 -34 38 -19 98 -54 150 -87 22 -14 47 -29 55 -32 8 -4 29 -16 45 -27 17 -10 53 -31 80 -45 28 -14 59 -31 70 -38 79 -49 103 -64 120 -75 11 -6 29 -16 40 -21 11 -5 37 -21 58 -35 21 -14 40 -26 44 -26 3 0 50 -27 104 -60 l99 -59 102 60 c57 33 110 64 118 69 8 6 24 15 35 20 11 6 34 19 50 29 17 11 50 30 75 42 25 13 51 29 58 36 7 7 18 13 23 13 5 0 39 18 75 41 37 22 77 45 88 50 12 5 35 18 51 29 17 11 39 24 50 30 11 6 36 20 55 31 19 12 55 32 80 46 81 44 134 75 178 104 24 16 48 29 53 29 6 0 25 11 42 24 18 14 43 29 57 35 14 6 41 21 60 32 19 12 55 32 80 46 25 13 54 29 65 36 10 7 37 23 60 37 22 13 60 35 85 48 25 12 59 32 75 42 17 11 37 23 45 27 8 4 44 24 79 46 35 21 74 43 85 48 12 6 30 15 41 22 11 7 51 30 90 52 38 22 79 45 90 52 11 7 29 17 40 23 11 6 43 24 70 41 28 16 61 35 75 42 14 6 27 15 30 19 3 4 17 12 30 18 14 5 39 19 55 30 17 10 50 30 75 42 25 13 63 35 85 49 60 37 76 46 125 71 25 12 59 33 75 45 17 12 41 27 55 32 14 6 39 20 55 31 17 11 53 31 80 45 28 14 64 35 80 45 17 11 39 24 50 30 31 16 89 51 97 59 4 4 -9 15 -30 26 -40 21 -228 129 -252 145 -8 6 -26 15 -40 21 -14 6 -38 21 -55 33 -16 12 -37 26 -45 29 -22 10 -114 62 -204 115 -43 26 -101 60 -130 76 -28 15 -52 32 -54 37 -2 5 -12 9 -22 9 -10 0 -22 5 -25 11 -4 5 -17 14 -28 20 -23 9 -31 14 -105 62 -24 15 -46 27 -49 27 -3 0 -38 19 -77 43 -39 24 -78 46 -86 50 -8 4 -28 16 -45 27 -16 11 -39 24 -51 29 -19 8 -136 76 -174 101 -8 6 -25 14 -37 19 -11 6 -24 15 -28 20 -3 6 -14 11 -25 11 -10 0 -20 7 -24 15 -3 8 -12 15 -19 15 -8 0 -20 7 -27 15 -7 8 -19 15 -28 15 -8 0 -23 6 -31 14 -9 7 -47 30 -85 50 -38 21 -94 54 -125 74 -31 20 -76 47 -101 60 -25 13 -58 32 -75 42 -16 10 -54 31 -82 47 -29 15 -53 31 -53 35 0 4 -6 8 -14 8 -7 0 -19 7 -26 15 -7 8 -18 15 -26 15 -7 0 -33 14 -57 30 -25 17 -47 30 -50 30 -5 0 -244 138 -277 160 -8 6 -25 14 -37 19 -11 6 -24 15 -28 20 -3 6 -15 11 -26 11 -10 0 -19 4 -19 9 0 9 -96 61 -113 61 -7 -1 -34 -14 -62 -30z"/>
            </g>
          </svg>
          <h1 className="text-3xl sm:text-4xl mb-3" style={{ color: '#FFFFFF', fontWeight: 800, letterSpacing: '-0.02em' }}>Production Specs &amp;<br />Acceptance Criteria</h1>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
            Exodia Game Development &middot; Marketing Department
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FF5900' }}></span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Help us understand your vision</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FF5900' }}></span>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="p-6 rounded-2xl border-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#FFE4C4', boxShadow: '0 4px 16px rgba(255,137,66,0.08)' }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFE4D0)' }}>
              <svg className="w-5 h-5" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#9A3412' }}>How this works</p>
              <p className="text-sm leading-relaxed" style={{ color: '#9A3412', fontWeight: 400, lineHeight: 1.7 }}>
                This document helps us understand your expectations for production deliverables and quality standards. The information you provide here will guide our Operations and QA teams in creating detailed specifications and validation procedures. <strong>No technical expertise required</strong> — just share what you know.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 pb-12 space-y-8">
        {/* Section 1 */}
        <div className="rounded-2xl overflow-hidden border-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>1</span>
              <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Basic Project Information</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Client / Studio Name</label>
                <input type="text" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="Enter your studio name" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Project Name</label>
                <input type="text" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="Enter project name" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Point of Contact</label>
                <input type="text" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Email Address</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="your@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Project Type</label>
              <div className="flex flex-wrap gap-4">
                {radioOptions('projectType', ['Project Base', 'Staff Augmentation'])}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="projectType" value="Others (Specify)" checked={form.projectType === 'Others (Specify)'} onChange={() => handleRadioGroup('projectType', 'Others (Specify)')} className="w-4 h-4" style={{ accentColor: '#FF5900' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                  </label>
                  <input type="text" value={form.projectTypeOther} onChange={(e) => setForm({ ...form, projectTypeOther: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Target Platform</label>
              <div className="flex flex-wrap gap-4">
                {checkboxOptions('targetPlatform', ['PC', 'Mobile', 'Web', 'Console', 'Not sure yet'])}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value="Others (Specify)" checked={form.targetPlatform.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('targetPlatform', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                  </label>
                  <input type="text" value={form.targetPlatformOther} onChange={(e) => setForm({ ...form, targetPlatformOther: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Timezone</label>
              <input type="text" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="e.g. EST (UTC-5)" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Start Date</label>
              <input type="text" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="e.g. Aug 01, 2026" />
            </div>
<div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Expected Deadline</label>
              <input type="text" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="e.g. Oct 15, 2026" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Budget Range</label>
              <input type="text" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="e.g. $5,000 - $10,000" />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Link to Project Document</label>
              <input type="text" value={form.docLink} onChange={(e) => setForm({ ...form, docLink: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="Google Drive, Notion, etc." />
            </div>
          </div>
        </div>

        {/* Section 2: Deliverables */}
        <div className="rounded-2xl overflow-hidden border-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>2</span>
              <h2 className="text-base text-white" style={{ fontWeight: 600 }}>What You Want Us to Create</h2>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: '#6B7280', fontWeight: 300 }}>
              List each deliverable, describe what it should include, and define how we will check if it's correct.
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
                    <tr key={i}>
                      {(['name', 'description', 'criteria', 'reference', 'quantity', 'serviceType'] as const).map((field) => (
                        <td key={field} className="p-1.5 border" style={{ borderColor: '#E5E7EB' }}>
                          <input
                            type="text"
                            value={row[field]}
                            onChange={(e) => updateDeliverableRow(i, field, e.target.value)}
                            className="w-full px-2 py-1.5 border rounded outline-none text-xs"
                            style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}
                            placeholder={`Enter ${field}`}
                          />
                        </td>
                      ))}
                      <td className="p-1.5 border" style={{ borderColor: '#E5E7EB' }}>
                        <button type="button" onClick={() => removeDeliverableRow(i)} className="p-1 rounded" style={{ color: '#EF4444' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addDeliverableRow} className="mt-3 px-4 py-2 text-sm rounded-lg transition flex items-center gap-1.5" style={{ color: '#FF5900', backgroundColor: '#FFF0E6', fontWeight: 500 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Deliverable Row
            </button>
          </div>
        </div>

        {/* Section 3: Review & Approval */}
        <div className="rounded-2xl overflow-hidden border-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>3</span>
              <h2 className="text-base text-white" style={{ fontWeight: 600 }}>How Will You Review &amp; Approve the Work?</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Who will review and approve this?</label>
              <div className="flex flex-wrap gap-4">
                {checkboxOptions('reviewer', ['Client', "Client's Team", 'Stakeholders', "Client's QA"])}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value="Others (Specify)" checked={form.reviewer.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('reviewer', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                  </label>
                  <input type="text" value={form.reviewerOther} onChange={(e) => setForm({ ...form, reviewerOther: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>How many review rounds are included?</label>
              <div className="flex flex-wrap gap-4">{radioOptions('reviewRounds', ['1', '2', '3', 'Not Sure'])}</div>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Expected review time</label>
              <div className="flex flex-wrap gap-4">{radioOptions('reviewTime', ['1 business day', '2 business days', '3 business days', 'Not Sure'])}</div>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Basis for approval</label>
              <div className="flex flex-wrap gap-4">{checkboxOptions('approvalBasis', ['The acceptance expectations defined in this Section 2 (Acceptance Criteria)'])}</div>
            </div>
          </div>
        </div>

        {/* Section 4: Project Governance */}
        <div className="rounded-2xl overflow-hidden border-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>4</span>
              <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Project Governance</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Communication Tool</label>
              <div className="flex flex-wrap gap-4">
                {checkboxOptions('commsTool', ['Discord', 'Slack'])}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value="Others (Specify)" checked={form.commsTool.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('commsTool', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                  </label>
                  <input type="text" value={form.commsToolOther} onChange={(e) => setForm({ ...form, commsToolOther: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />
                </div>
              </div>
            </div>
            <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
              <p className="text-sm mb-3 font-medium" style={{ color: '#374151' }}>If Project Base</p>
              <div className="space-y-3 pl-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Weekly target meeting</label>
                  <div className="flex flex-wrap gap-4">{checkboxOptions('weeklyMeeting', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}</div>
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Preferred target meeting time <span className="text-xs font-normal" style={{ color: '#9CA3AF' }}>(No graveyard shift)</span></label>
                  <div className="flex flex-wrap gap-4">
                    {radioOptions('meetingTime', ['10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'])}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="meetingTime" value="Others (Specify)" checked={form.meetingTime === 'Others (Specify)'} onChange={() => handleRadioGroup('meetingTime', 'Others (Specify)')} className="w-4 h-4" style={{ accentColor: '#FF5900' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                      </label>
                      <input type="text" value={form.meetingTimeOther} onChange={(e) => setForm({ ...form, meetingTimeOther: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
              <p className="text-sm mb-3 font-medium" style={{ color: '#374151' }}>If Staff Augmentation</p>
              <div className="space-y-3 pl-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Daily team sync-up</label>
                  <div className="flex flex-wrap gap-4">{checkboxOptions('dailySync', ['Everyday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}</div>
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Preferred sync-up time <span className="text-xs font-normal" style={{ color: '#9CA3AF' }}>(No graveyard shift)</span></label>
                  <div className="flex flex-wrap gap-4">
                    {radioOptions('syncTime', ['10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'])}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="syncTime" value="Others (Specify)" checked={form.syncTime === 'Others (Specify)'} onChange={() => handleRadioGroup('syncTime', 'Others (Specify)')} className="w-4 h-4" style={{ accentColor: '#FF5900' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                      </label>
                      <input type="text" value={form.syncTimeOther} onChange={(e) => setForm({ ...form, syncTimeOther: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Training &amp; onboarding</label>
                  <div className="flex flex-wrap gap-4">{checkboxOptions('training', ['Client', 'Exodia', 'Third Party'])}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Technical Details */}
        <div className="rounded-2xl overflow-hidden border-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>5</span>
              <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Technical Details</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>Game Engine</label>
              <div className="flex flex-wrap gap-4">
                {checkboxOptions('gameEngine', ['Unity', 'Unreal', 'Not sure yet'])}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value="Others (Specify)" checked={form.gameEngine.includes('Others (Specify)')} onChange={(e) => handleCheckboxGroup('gameEngine', 'Others (Specify)', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Others:</span>
                  </label>
                  <input type="text" value={form.gameEngineOther} onChange={(e) => setForm({ ...form, gameEngineOther: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Specify..." />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Technical Requirements</label>
              <textarea value={form.techRequirements} onChange={(e) => setForm({ ...form, techRequirements: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="File format, naming convention, output format, etc." />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Tools &amp; Software Required</label>
              <textarea value={form.toolsSoftware} onChange={(e) => setForm({ ...form, toolsSoftware: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="List any required tools or software" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Performance or Platform Constraints</label>
              <textarea value={form.performanceConstraints} onChange={(e) => setForm({ ...form, performanceConstraints: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Any performance targets or platform limitations" />
            </div>
          </div>
        </div>

        {/* Section 6: Client Confirmation */}
        <div className="rounded-2xl overflow-hidden border-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-4 border-b-2" style={{ backgroundColor: '#1B1A1C', borderColor: '#1B1A1C' }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>6</span>
              <h2 className="text-base text-white" style={{ fontWeight: 600 }}>Client Confirmation</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="p-5 rounded-xl border-2" style={{ backgroundColor: '#FFF7ED', borderColor: '#FFE4C4' }}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm leading-relaxed" style={{ color: '#9A3412', fontWeight: 400, lineHeight: 1.7 }}>
                  By signing this form, the client confirms that the deliverables, specifications, and acceptance expectations stated above are accurate and approved. This document will be used as the basis for project scoping, quotation, production execution, and QA validation. Any changes after approval may require a formal revision and may impact cost, timeline, or delivery scope.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Client Name &amp; Signature</label>
                <input type="text" value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="Type your full name" required />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>Date</label>
                <input type="text" value={form.signatureDate} onChange={(e) => setForm({ ...form, signatureDate: e.target.value })} className="w-full px-3.5 py-3 border-2 rounded-xl outline-none text-sm transition" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }} placeholder="e.g. Jul 01, 2026" required />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="text-center">
          <button
            type="submit"
            className="px-12 py-4 rounded-2xl text-white text-base font-semibold transition-all hover:-translate-y-1 active:translate-y-0"
            style={{ backgroundColor: '#FF5900', boxShadow: '0 8px 28px rgba(255,89,0,0.35)' }}
          >
            Submit Your Specifications
          </button>
          <p className="text-xs mt-3" style={{ color: '#9CA3AF', fontWeight: 400 }}>We'll review and get back to you within 1-2 business days</p>
        </div>
      </form>

      {/* Footer */}
      <div className="py-8 px-4 text-center border-t-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF', fontWeight: 400 }}>
          Exodia Game Development &middot; Marketing Department &middot; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}