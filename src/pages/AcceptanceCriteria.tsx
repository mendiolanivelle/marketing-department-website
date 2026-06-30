import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface Submission {
  id: number | string
  tracking_id: string
  client_name: string
  project_name: string
  contact: string
  email: string
  project_type: string
  target_platform: string[]
  timezone: string
  start_date: string
  deadline: string
  budget: string
  doc_link: string
  deliverables: any[]
  reviewer: string[]
  review_rounds: string
  review_time: string
  approval_basis: string[]
  comms_tool: string[]
  weekly_meeting: string[]
  meeting_time: string
  daily_sync: string[]
  sync_time: string
  training: string[]
  game_engine: string[]
  tech_requirements: string
  tools_software: string
  performance_constraints: string
  signature: string
  signature_date: string
  created_at: string
}

export default function AcceptanceCriteria() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showSentModal, setShowSentModal] = useState(false)
  const [sentTicketLink, setSentTicketLink] = useState('')
  const [sentCount, setSentCount] = useState(0)

  const [sendForm, setSendForm] = useState({ to: '', subject: '', body: '', attachment: '', additionalAttachments: [] as string[] })

  const formatId = (sub: Submission): string => {
    if (sub.tracking_id) return sub.tracking_id
    const d = new Date(sub.created_at)
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const seq = String(100 + Number(sub.id) % 900).padStart(3, '0')
    return 'AC-' + yy + mm + '-' + seq
  }

  const fetchSubmissions = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('acceptance_forms')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSubmissions(data || [])
    } catch (err) {
      console.error('Error fetching submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSentCount = async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { count } = await supabase
        .from('project_review_tickets')
        .select('id', { count: 'exact', head: true })
      if (count !== null) setSentCount(count)
    } catch {}
  }

  const generatePDF = (sub: Submission): Blob => {
    const esc = (t: string) => (t || '—').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\n/g, '\\n')
    const pt = (mm: number) => Math.round(mm * 2.83465 * 10) / 10
    const pw = pt(210), ph = 841.89, mg = pt(15), cw = pw - 2 * mg

    const streams: string[] = []
    let curStream = ''
    let y = 15
    let pageIdx = 0
    const MAX_Y = 275

    const w = (s: string) => { curStream += s + '\n' }
    const color = (r: number, g: number, b: number) => w(r / 255 + ' ' + g / 255 + ' ' + b / 255 + ' rg')
    const colorg = (r: number, g: number, b: number) => w(r / 255 + ' ' + g / 255 + ' ' + b / 255 + ' RG')
    const fnt = (id: string, sz: number) => w('/' + id + ' ' + sz + ' Tf')
    const txt = (x: number, yPos: number, t: string) => w(pt(x) + ' ' + pt(yPos) + ' Td (' + esc(t) + ') Tj')
    const rect = (x: number, y2: number, w2: number, h2: number) => w(pt(x) + ' ' + pt(y2) + ' ' + pt(w2) + ' ' + pt(h2) + ' re')
    const fill = () => w('f')
    const nextPage = () => {
      curStream += 'ET'
      streams.push(curStream)
      curStream = 'BT\n'
      y = 15
      pageIdx++
    }

    w('BT')
    color(255, 89, 0)
    rect(15, y, 180, 12)
    fill()
    color(255, 255, 255)
    fnt('F2', 16)
    txt(17, y + 3.5, 'Exodia Game Dev - Acceptance Criteria Form')
    y += 9
    color(255, 255, 255)
    fnt('F1', 7)
    txt(17, y + 1.5, 'ID: ' + (formatId(sub)))
    y += 18

    const check = () => { if (y > MAX_Y) nextPage() }
    const section = (title: string, fn: () => void) => {
      check(); color(255, 89, 0); rect(15, y, 180, 7); fill()
      color(255, 255, 255); fnt('F1', 9); txt(17, y + 2.5, title); y += 10
      color(27, 26, 28); fnt('F1', 8); fn(); y += 2
    }

    const row = (label: string, value: string) => {
      check()
      colorg(107, 114, 128); fnt('F1', 8); txt(15, y, label)
      color(27, 26, 28); fnt('F1', 8)
      const val = value || '—'
      const maxW = Math.floor((cw - 50) / 1.6)
      for (let i = 0; i < val.length; i += maxW) {
        if (i > 0) { check(); txt(15, y, '') }
        txt(i === 0 ? 65 : 15, y, val.substring(i, i + maxW))
        if (i > 0) y += 3.5
      }
      y += 3.5
    }

    const multi = (label: string, items: string[] | any[]) => row(label, items?.length ? items.join(', ') : '—')

    section('Section 1: Basic Project Information', () => {
      row('Client / Studio Name', sub.client_name); row('Project Name', sub.project_name)
      row('Point of Contact', sub.contact); row('Email', sub.email)
      row('Project Type', sub.project_type); multi('Target Platform', sub.target_platform)
      row('Timezone', sub.timezone); row('Expected Start Date', sub.start_date)
      row('Expected Deadline', sub.deadline); row('Budget Range', sub.budget)
      row('Project Document Link', sub.doc_link)
    })

    section('Section 2: What You Want Us to Create', () => {
      if (sub.deliverables?.length) {
        colorg(55, 65, 81); fnt('F2', 8)
        txt(15, y, 'Deliverable'); txt(55, y, 'Description'); txt(115, y, 'Criteria'); txt(175, y, 'Qty')
        y += 5; color(27, 26, 28); fnt('F1', 8)
        sub.deliverables.forEach((d: any) => {
          check(); txt(15, y, d.name || '—')
          txt(55, y, (d.description || '—').substring(0, 28))
          txt(115, y, (d.criteria || '—').substring(0, 28))
          txt(175, y, String(d.quantity || '—'))
          y += 4
        })
      } else { fnt('F3', 8); txt(15, y, 'No deliverables specified.'); y += 4 }
    })

    section('Section 3: Review & Approval', () => {
      multi('Reviewers', sub.reviewer); row('Review Rounds', sub.review_rounds)
      row('Expected Review Time', sub.review_time); multi('Basis for Approval', sub.approval_basis)
    })

    section('Section 4: Project Governance', () => {
      multi('Communication Tool', sub.comms_tool); multi('Weekly Meeting', sub.weekly_meeting)
      row('Meeting Time', sub.meeting_time); multi('Daily Sync', sub.daily_sync)
      row('Sync Time', sub.sync_time); multi('Training', sub.training)
    })

    section('Section 5: Technical Details', () => {
      multi('Game Engine', sub.game_engine)
      if (sub.tech_requirements) row('Technical Requirements', sub.tech_requirements)
      if (sub.tools_software) row('Tools & Software', sub.tools_software)
      if (sub.performance_constraints) row('Performance Constraints', sub.performance_constraints)
    })

    section('Section 6: Client Confirmation', () => {
      check()
      color(255, 247, 237); rect(15, y - 1, 180, 18); fill()
      color(154, 52, 18); fnt('F1', 7)
      const conf = 'By signing this form, the client confirms that the deliverables, specifications, and acceptance expectations stated above are accurate and approved. This document will be used as the basis for project scoping, quotation, production execution, and QA validation.'
      for (let i = 0; i < conf.length; i += 110) { check(); txt(17, y, conf.substring(i, i + 110)); y += 3 }
      y += 5
      row('Signed by', sub.signature)
      row('Date', sub.signature_date || new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
    })

    check()
    colorg(156, 163, 175); fnt('F1', 7)
    txt(15, y + 5, 'Exodia Game Dev \u00b7 Marketing Department \u00b7 Submitted ' + new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }))

    curStream += 'ET'
    streams.push(curStream)
    const numPages = pageIdx + 1

    let objIdx = 1
    const obj = (s: string) => { const n = objIdx++; return { num: n, data: n + ' 0 obj\n' + s + '\nendobj' } }

    const catalog = obj('<< /Type /Catalog /Pages ' + (objIdx + 1) + ' 0 R >>')
    const fHelv = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    const fHelvB = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
    const fHelvO = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>')
    const fontObjNums = { F1: fHelv.num, F2: fHelvB.num, F3: fHelvO.num }

    const pageObjNum = objIdx
    const pagesObj = obj('<< /Type /Pages /Kids [' + Array.from({ length: numPages }, (_, i) => (pageObjNum + 1 + i * 2) + ' 0 R').join(' ') + '] /Count ' + numPages + ' >>')

    const allObjs = [catalog, fHelv, fHelvB, fHelvO, pagesObj]
    for (let i = 0; i < numPages; i++) {
      const s = streams[i]
      const fontRef = '/F1 ' + fontObjNums.F1 + ' 0 R /F2 ' + fontObjNums.F2 + ' 0 R /F3 ' + fontObjNums.F3 + ' 0 R'
      const page = obj('<< /Type /Page /Parent ' + pagesObj.num + ' 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Contents ' + (objIdx + 1) + ' 0 R /Resources << /Font << ' + fontRef + ' >> >> >>')
      const stream = obj('<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream')
      allObjs.push(page, stream)
    }

    const body = allObjs.map(o => o.data).join('\n')
    let currentOff = '%PDF-1.4\n'.length
    const offsets: number[] = []
    for (const o of allObjs) {
      offsets[o.num] = currentOff
      currentOff += o.data.length + 1 // +1 for the '\n' from join
    }
    const xrefOff = currentOff
    const xref = 'xref\n0 ' + (allObjs.length + 1) + '\n' +
      '0000000000 65535 f \n' +
      allObjs.map(o => String(offsets[o.num]).padStart(10, '0') + ' 00000 n \n').join('')
    const trailer = 'trailer\n<< /Size ' + (allObjs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOff + '\n%%EOF'

    return new Blob(['%PDF-1.4\n' + body + '\n' + xref + trailer], { type: 'application/pdf' })
  }

  const uploadPDF = async (sub: Submission): Promise<string | null> => {
    if (!isSupabaseConfigured || !supabase) return null
    try {
      const pdfBlob = generatePDF(sub)
      const fileName = 'acceptance-form-' + sub.id + '.pdf'
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })
      const { data, error } = await supabase.storage
        .from('acceptance-forms')
        .upload(fileName, file, { upsert: true, contentType: 'application/pdf' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage
        .from('acceptance-forms')
        .getPublicUrl(fileName)
      return publicUrl
    } catch (err) {
      console.error('Error uploading PDF:', err)
      return null
    }
  }

  useEffect(() => {
    fetchSubmissions()
    fetchSentCount()
    if (!isSupabaseConfigured || !supabase) return

    // Realtime subscription for new submissions
    const channel = supabase
      .channel('acceptance_forms_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acceptance_forms' }, () => {
        fetchSubmissions()
        fetchSentCount()
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Acceptance Criteria Forms</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            View all client-submitted acceptance criteria forms. New submissions appear in real time.
          </p>
        </div>
        <a
          href="/#/acceptance-form"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-white rounded-lg transition flex-shrink-0 hover:-translate-y-0.5"
          style={{ backgroundColor: 'var(--accent)', color: '#FFFFFF', fontWeight: 500 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Public Form
        </a>
      </div>
        {showSentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)' }} onClick={() => setShowSentModal(false)}>
          <div className="relative rounded-2xl border p-8 max-w-sm w-full text-center theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowSentModal(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg transition hover:opacity-70"
              style={{ color: '#9CA3AF' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FFF0E6' }}>
              <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg mb-2" style={{ color: '#1B1A1C', fontWeight: 700 }}>Sent to Ops!</h3>
            <p className="text-sm" style={{ color: '#6B7280', fontWeight: 300 }}>
              The ticket has been submitted and is now available for review.
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(sentTicketLink)}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-medium transition hover:opacity-80"
              style={{ backgroundColor: '#FFF0E6', color: '#FF5900' }}
            >
              Copy ticket link
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      {!loading && submissions.length > 0 && (
        <div className="flex gap-3 sm:gap-4 mb-4 flex-wrap">
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</span>
            <span className="ml-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{submissions.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sent to Ops</span>
            <span className="ml-2 text-sm font-bold" style={{ color: '#FF5900' }}>{sentCount}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Project Base</span>
            <span className="ml-2 text-sm font-bold" style={{ color: 'var(--accent)' }}>{submissions.filter(s => s.project_type === 'Project Base').length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Staff Aug</span>
            <span className="ml-2 text-sm font-bold" style={{ color: '#2563EB' }}>{submissions.filter(s => s.project_type === 'Staff Augmentation').length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border flex items-center gap-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <svg className="w-3.5 h-3.5" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Delete</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>No submissions yet. Share the public form link to start receiving entries.</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Public link: /acceptance-form</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Project</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tracking ID</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Client</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Contact</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Platform</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Budget</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Submitted</th>
                  <th className="p-3 w-10"></th>
                  <th className="p-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    className="cursor-pointer transition hover:opacity-80"
                    style={{ borderTop: '1px solid var(--border-secondary)' }}
                  >
                    <td className="p-3">
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sub.project_name || 'Untitled'}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatId(sub)}</span>
                    </td>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{sub.client_name || '—'}</td>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>
                      {sub.contact || '—'}
                      {sub.email && <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{sub.email}</span>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md text-xs" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>
                        {sub.project_type || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {(sub.target_platform || []).length > 0
                          ? (sub.target_platform as string[]).slice(0, 2).map((p: string, i: number) => (
                              <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{p}</span>
                            ))
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </div>
                    </td>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{sub.budget || '—'}</td>
                    <td className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-3">
                      <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm('Delete this submission? This cannot be undone.')) {
                            if (!isSupabaseConfigured || !supabase) return
                            supabase.from('acceptance_forms').delete().eq('id', sub.id).then(() => fetchSubmissions())
                          }
                        }}
                        className="p-1.5 rounded-lg transition hover:opacity-70"
                        style={{ color: '#FF5900' }}
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const link = window.location.origin + '/#/view-acceptance/' + formatId(sub)
                          navigator.clipboard.writeText(link)
                        }}
                        className="p-1.5 rounded-lg transition hover:opacity-70"
                        style={{ color: '#9CA3AF' }}
                        title="Copy shareable link"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </button>
                    </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal - PDF-style form view */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }} onClick={() => setSelectedSubmission(null)} />
          <div className="relative rounded-2xl border max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
            {/* Print-style header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-3">
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
<div>
                    <p className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Exodia Game Dev</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>Acceptance Criteria Form</p>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: '#9CA3AF' }}>ID: {formatId(selectedSubmission)}</p>
                  </div>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="p-2 rounded-lg transition hover:bg-gray-100" style={{ color: '#6B7280' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Section 1 */}
              <div>
                <div className="mb-4 pb-2 border-b-2" style={{ borderColor: '#FF5900' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#1B1A1C' }}>Section 1: Basic Project Information</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Client / Studio Name</span>
                    <p className="mt-0.5 font-medium" style={{ color: '#1B1A1C' }}>{selectedSubmission.client_name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Project Name</span>
                    <p className="mt-0.5 font-medium" style={{ color: '#1B1A1C' }}>{selectedSubmission.project_name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Point of Contact</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.contact || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Email</span>
                    <p className="mt-0.5" style={{ color: '#2563EB' }}>{selectedSubmission.email || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Project Type</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.project_type || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Target Platform</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.target_platform || []).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Timezone</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.timezone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Expected Start Date</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.start_date || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Expected Deadline</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.deadline || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Budget Range</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.budget || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs" style={{ color: '#6B7280' }}>Project Document Link</span>
                    <p className="mt-0.5" style={{ color: '#2563EB' }}>{selectedSubmission.doc_link || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div>
                <div className="mb-3 pb-2 border-b-2" style={{ borderColor: '#FF5900' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#1B1A1C' }}>Section 2: What You Want Us to Create</h2>
                </div>
                {selectedSubmission.deliverables && selectedSubmission.deliverables.length > 0 ? (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB' }}>
                        <th className="p-2.5 border text-left font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Deliverable</th>
                        <th className="p-2.5 border text-left font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Description</th>
                        <th className="p-2.5 border text-left font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Acceptance Criteria</th>
                        <th className="p-2.5 border text-left font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Reference</th>
                        <th className="p-2.5 border text-left font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Qty</th>
                        <th className="p-2.5 border text-left font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Service Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSubmission.deliverables.map((d: any, i: number) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                          <td className="p-2.5 border font-medium" style={{ borderColor: '#E5E7EB', color: '#1B1A1C' }}>{d.name || '—'}</td>
                          <td className="p-2.5 border" style={{ borderColor: '#E5E7EB', color: '#4B5563' }}>{d.description || '—'}</td>
                          <td className="p-2.5 border" style={{ borderColor: '#E5E7EB', color: '#4B5563' }}>{d.criteria || '—'}</td>
                          <td className="p-2.5 border" style={{ borderColor: '#E5E7EB', color: '#2563EB' }}>{d.reference || '—'}</td>
                          <td className="p-2.5 border" style={{ borderColor: '#E5E7EB', color: '#4B5563' }}>{d.quantity || '—'}</td>
                          <td className="p-2.5 border" style={{ borderColor: '#E5E7EB', color: '#4B5563' }}>{d.serviceType || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm italic" style={{ color: '#9CA3AF' }}>No deliverables specified.</p>
                )}
              </div>

              {/* Section 3 */}
              <div>
                <div className="mb-3 pb-2 border-b-2" style={{ borderColor: '#FF5900' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#1B1A1C' }}>Section 3: Review & Approval</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Reviewers</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.reviewer || []).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Review Rounds</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.review_rounds || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Expected Review Time</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.review_time || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Basis for Approval</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.approval_basis || []).join(', ') || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Section 4 */}
              <div>
                <div className="mb-3 pb-2 border-b-2" style={{ borderColor: '#FF5900' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#1B1A1C' }}>Section 4: Project Governance</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Communication Tool</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.comms_tool || []).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Weekly Meeting</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.weekly_meeting || []).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Meeting Time</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.meeting_time || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Daily Sync</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.daily_sync || []).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Sync Time</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.sync_time || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Training</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.training || []).join(', ') || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Section 5 */}
              <div>
                <div className="mb-3 pb-2 border-b-2" style={{ borderColor: '#FF5900' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#1B1A1C' }}>Section 5: Technical Details</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Game Engine</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{(selectedSubmission.game_engine || []).join(', ') || '—'}</p>
                  </div>
                  <div className={selectedSubmission.tech_requirements ? '' : 'hidden'}>
                    {selectedSubmission.tech_requirements && <><span className="text-xs" style={{ color: '#6B7280' }}>Technical Requirements</span><p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.tech_requirements}</p></>}
                  </div>
                </div>
                {(selectedSubmission.tools_software || selectedSubmission.performance_constraints) && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-3">
                    {selectedSubmission.tools_software && (
                      <div>
                        <span className="text-xs" style={{ color: '#6B7280' }}>Tools & Software</span>
                        <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.tools_software}</p>
                      </div>
                    )}
                    {selectedSubmission.performance_constraints && (
                      <div>
                        <span className="text-xs" style={{ color: '#6B7280' }}>Performance Constraints</span>
                        <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.performance_constraints}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 6 */}
              <div>
                <div className="mb-3 pb-2 border-b-2" style={{ borderColor: '#FF5900' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#1B1A1C' }}>Section 6: Client Confirmation</h2>
                </div>
                <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FFF7ED', borderColor: '#FFE4C4' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#9A3412' }}>
                    By signing this form, the client confirms that the deliverables, specifications, and acceptance expectations stated above are accurate and approved. This document will be used as the basis for project scoping, quotation, production execution, and QA validation.
                  </p>
                </div>
                <div className="mt-4 flex gap-6 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Signed by</span>
                    <p className="mt-0.5 font-medium" style={{ color: '#1B1A1C' }}>{selectedSubmission.signature || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Date</span>
                    <p className="mt-0.5" style={{ color: '#1B1A1C' }}>{selectedSubmission.signature_date || new Date(selectedSubmission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t text-center" style={{ borderColor: '#E5E7EB' }}>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>Exodia Game Dev &middot; Marketing Department &middot; Submitted {new Date(selectedSubmission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              {/* Prepare to Send */}
              <div className="pt-4 text-center">
                <button
                  onClick={async () => {
                    const pdfUrl = await uploadPDF(selectedSubmission)
                    setSendForm({
                      to: selectedSubmission.email || '',
                      subject: formatId(selectedSubmission) + ' - ' + (selectedSubmission.project_name || 'Untitled'),
                      body: `Dear ${selectedSubmission.client_name || 'Client'},\n\nPlease find attached the Acceptance Criteria Form for "${selectedSubmission.project_name || 'Untitled'}" submitted on ${new Date(selectedSubmission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.\n\nView online: ${window.location.origin}/#/view-acceptance/${formatId(selectedSubmission)}\n\nBest regards,\nMarketing Department\nExodia Game Dev`,
                      attachment: pdfUrl || '',
                      additionalAttachments: [],
                    })
                    setShowSendModal(true)
                  }}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5"
                  style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}
                >
                  Prepare to Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && selectedSubmission && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'var(--overlay-blur)' }} onClick={() => setShowSendModal(false)} />
          <div className="relative rounded-2xl border max-w-5xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
              <h2 className="text-base font-bold" style={{ color: '#1B1A1C' }}>Send to Operations</h2>
              <button onClick={() => setShowSendModal(false)} className="p-2 rounded-lg transition hover:bg-gray-100" style={{ color: '#6B7280' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 gap-6">
                {/* Left: Form fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: '#374151' }}>Email Address</label>
                    <input type="email" value={sendForm.to} onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="ops@exodiagamedev.com" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: '#374151' }}>Subject</label>
                    <input type="text" value={sendForm.subject} onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: '#374151' }}>Email Message / Body</label>
                    <textarea value={sendForm.body} onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })} rows={6} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm resize-none" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: '#374151' }}>Attachment Link</label>
                    <input type="text" value={sendForm.attachment} onChange={(e) => setSendForm({ ...sendForm, attachment: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm" style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }} placeholder="Paste a Google Drive or file link..." />
                  </div>
                  {sendForm.attachment && (
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}>
                      <div className="px-4 py-3 border-b text-xs font-medium flex items-center gap-2" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', color: '#374151' }}>
                        <svg className="w-4 h-4" style={{ color: '#FF5900' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                          <path d="M14 2v6h6" fill="none" stroke="#fff" strokeWidth="2" />
                          <path d="M16 13H8m0 4h8m-8-8h2" fill="none" stroke="#FF5900" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Attached PDF — Acceptance Criteria Form
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <a
                          href={sendForm.attachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm underline truncate max-w-[70%]"
                          style={{ color: '#2563EB' }}
                        >
                          {sendForm.attachment}
                        </a>
                        <span className="text-xs" style={{ color: '#6B7280' }}>PDF</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: '#374151' }}>Additional Attachment Links</label>
                    <div className="space-y-2">
                      {sendForm.additionalAttachments.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={link}
                            onChange={(e) => {
                              const updated = [...sendForm.additionalAttachments]
                              updated[idx] = e.target.value
                              setSendForm({ ...sendForm, additionalAttachments: updated })
                            }}
                            className="w-full px-3.5 py-2.5 border rounded-lg outline-none text-sm"
                            style={{ borderColor: '#D1D5DB', color: '#1B1A1C' }}
                            placeholder="Paste a link..."
                          />
                          <button
                            onClick={() => {
                              const updated = sendForm.additionalAttachments.filter((_, i) => i !== idx)
                              setSendForm({ ...sendForm, additionalAttachments: updated })
                            }}
                            className="px-2 rounded-lg transition"
                            style={{ color: '#EF4444' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setSendForm({ ...sendForm, additionalAttachments: [...sendForm.additionalAttachments, ''] })}
                        className="flex items-center gap-1.5 text-xs transition hover:opacity-70"
                        style={{ color: '#FF5900', fontWeight: 500 }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add another link
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const attachmentLines = [
                        sendForm.attachment ? 'Attached Meeting Link: ' + sendForm.attachment : '',
                        ...sendForm.additionalAttachments.filter(l => l.trim()).map((l, i) => 'Attachment ' + (i + 1) + ': ' + l)
                      ].filter(Boolean).join('\n')
                      const fullBody = sendForm.body + (attachmentLines ? '\n\n' + attachmentLines : '')
                      const ticketLink = window.location.origin + '/#/view-acceptance/' + (selectedSubmission ? formatId(selectedSubmission) : '')
                      const apiUrl = import.meta.env.VITE_SUPABASE_URL
                      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
                      let saved = false
                      if (selectedSubmission && apiUrl && anonKey) {
                        try {
                          const resp = await fetch(apiUrl + '/rest/v1/project_review_tickets', {
                            method: 'POST',
                            headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                            body: JSON.stringify({
                              tracking_id: formatId(selectedSubmission),
                              project_name: selectedSubmission.project_name,
                              client_name: selectedSubmission.client_name,
                              email_to: sendForm.to,
                              email_subject: sendForm.subject,
                              email_body: fullBody,
                              attachment_pdf: sendForm.attachment || null,
                              additional_attachments: sendForm.additionalAttachments.filter(l => l.trim()),
                              ticket_link: 'https://operations.exodiagamedev.com/project-review-ticket?tracking_id=' + encodeURIComponent(formatId(selectedSubmission)),
                              status: 'Sent',
                            }),
                          })
                          if (resp.ok) saved = true
                          if (resp.ok) {
                            const viewLink = window.location.origin + '/#/view-acceptance/' + encodeURIComponent(formatId(selectedSubmission))
                            try {
                              const emailResp = await fetch(apiUrl + '/functions/v1/send-ticket-email', {
                                method: 'POST',
                                headers: { 'Authorization': 'Bearer ' + anonKey, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  to: sendForm.to,
                                  trackingId: formatId(selectedSubmission),
                                  projectName: selectedSubmission.project_name,
                                  ticketLink: viewLink,
                                }),
                              })
                              if (!emailResp.ok) {
                                console.error('Email function returned:', emailResp.status, await emailResp.text())
                              }
                            } catch (emailErr) {
                              console.error('Failed to send email:', emailErr)
                            }
                          }
                        } catch (err) {
                          console.error('Failed to save ticket:', err)
                        }
                      }
                      setShowSendModal(false)
                      setSentTicketLink(ticketLink)
                      fetchSentCount()
                      setShowSentModal(true)
                      setTimeout(() => setShowSentModal(false), 6000)
                    }}
                    className="w-full px-6 py-3 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5"
                    style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}
                  >
                    Send to Ops
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}