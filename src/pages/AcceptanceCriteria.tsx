import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface Submission {
  id: string
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
  const [sendForm, setSendForm] = useState({ to: '', subject: '', body: '', attachment: '', additionalAttachments: [] as string[] })

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
    if (!isSupabaseConfigured || !supabase) return

    // Realtime subscription for new submissions
    const channel = supabase
      .channel('acceptance_forms_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'acceptance_forms' }, () => {
        fetchSubmissions()
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
          style={{ backgroundColor: 'var(--accent)', fontWeight: 500 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Public Form
        </a>
      </div>

      {/* Stats row */}
      {!loading && submissions.length > 0 && (
        <div className="flex gap-3 sm:gap-4 mb-4 flex-wrap">
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</span>
            <span className="ml-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{submissions.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending</span>
            <span className="ml-2 text-sm font-bold" style={{ color: '#EA580C' }}>{submissions.filter(s => s.project_type === 'Pending').length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Project Base</span>
            <span className="ml-2 text-sm font-bold" style={{ color: 'var(--accent)' }}>{submissions.filter(s => s.project_type === 'Project Base').length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Staff Aug</span>
            <span className="ml-2 text-sm font-bold" style={{ color: '#2563EB' }}>{submissions.filter(s => s.project_type === 'Staff Augmentation').length}</span>
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
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Client</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Contact</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Platform</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Budget</th>
                  <th className="p-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Submitted</th>
                  <th className="p-3 w-10"></th>
                  <th className="p-3 w-32"></th>
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
                        onClick={async (e) => {
                          e.stopPropagation()
                          const pdfUrl = await uploadPDF(sub)
                          setSendForm({
                            to: sub.email || '',
                            subject: `Acceptance Criteria Form - ${sub.project_name || 'Untitled'}`,
                            body: `Dear ${sub.client_name || 'Client'},\n\nPlease find attached the Acceptance Criteria Form for "${sub.project_name || 'Untitled'}" submitted on ${new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.\n\nBest regards,\nMarketing Department\nExodia Game Dev`,
                            attachment: pdfUrl || '',
                            additionalAttachments: [],
                          })
                          setSelectedSubmission(sub)
                          setShowSendModal(true)
                        }}
                        className="px-3 py-1.5 text-xs text-white rounded-lg transition hover:-translate-y-0.5"
                        style={{ backgroundColor: '#FF5900', fontWeight: 500 }}
                      >
                        Send
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
                <svg width="28" height="28" viewBox="0 0 680 680">
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
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1B1A1C' }}>Exodia Game Dev</p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>Acceptance Criteria Form</p>
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
                      subject: `Acceptance Criteria Form - ${selectedSubmission.project_name || 'Untitled'}`,
                      body: `Dear ${selectedSubmission.client_name || 'Client'},\n\nPlease find attached the Acceptance Criteria Form for "${selectedSubmission.project_name || 'Untitled'}" submitted on ${new Date(selectedSubmission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.\n\nBest regards,\nMarketing Department\nExodia Game Dev`,
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
                    onClick={() => {
                      const attachmentLines = [
                        sendForm.attachment ? 'Attached Meeting Link: ' + sendForm.attachment : '',
                        ...sendForm.additionalAttachments.filter(l => l.trim()).map((l, i) => 'Attachment ' + (i + 1) + ': ' + l)
                      ].filter(Boolean).join('\n')
                      const fullBody = sendForm.body + (attachmentLines ? '\n\n' + attachmentLines : '')
                      const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(sendForm.to) + '&su=' + encodeURIComponent(sendForm.subject) + '&body=' + encodeURIComponent(fullBody)
                      window.open(gmailUrl, '_blank')
                      setShowSendModal(false)
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