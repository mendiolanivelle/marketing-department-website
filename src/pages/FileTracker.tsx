import { useState, useEffect, useRef } from 'react'

interface TrackedFile {
  id: string
  name: string
  category: string
  dataUrl: string
  size: number
  type: string
  uploadedAt: string
  notes: string
}

const CATEGORIES = ['All', 'Meetings', 'Social Media', 'Presentations']
const STORAGE_KEY = 'exodia-file-tracker'

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export default function FileTracker() {
  const [files, setFiles] = useState<TrackedFile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [showUpload, setShowUpload] = useState(false)
  const [showPreview, setShowPreview] = useState<TrackedFile | null>(null)
  const [uploadCategory, setUploadCategory] = useState('Meetings')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files))
  }, [files])

  const filtered = files.filter(f => {
    const matchCategory = activeCategory === 'All' || f.category === activeCategory
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.notes.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'All' ? files.length : files.filter(f => f.category === cat).length
    return acc
  }, {} as Record<string, number>)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setPendingFile(null); return }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be smaller than 10 MB')
      setPendingFile(null)
      return
    }
    setPendingFile(file)
    setUploadError('')
  }

  const handleUpload = () => {
    if (!pendingFile) { setUploadError('Please select a file'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const newFile: TrackedFile = {
        id: generateId(),
        name: pendingFile.name,
        category: uploadCategory,
        dataUrl: reader.result as string,
        size: pendingFile.size,
        type: pendingFile.type,
        uploadedAt: new Date().toISOString(),
        notes: uploadNotes,
      }
      setFiles(prev => [newFile, ...prev])
      setPendingFile(null)
      setUploadNotes('')
      setUploadError('')
      setShowUpload(false)
    }
    reader.onerror = () => setUploadError('Failed to read file')
    reader.readAsDataURL(pendingFile)
  }

  const handleDelete = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleDownload = (file: TrackedFile) => {
    const a = document.createElement('a')
    a.href = file.dataUrl
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const previewFile = (file: TrackedFile) => {
    setShowPreview(file)
  }

  const canPreview = (type: string) => type.startsWith('image/') || type.startsWith('text/') || type === 'application/pdf'

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgba(202,205,215,0.15)' }}>
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border-2 theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          {/* Header */}
          <div className="border-b theme-transition px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: 'var(--border-primary)' }}>
            <div>
              <h1 className="text-xl sm:text-2xl" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>File Tracker</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Store, organize, and find company files</p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 text-sm whitespace-nowrap"
              style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload File
            </button>
          </div>

          {/* Search + Category filter */}
          <div className="px-5 sm:px-8 py-4 border-b theme-transition flex flex-col sm:flex-row gap-4" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search files by name or notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border outline-none text-sm transition"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="px-5 sm:px-8 py-3 flex flex-wrap gap-2 border-b theme-transition" style={{ borderColor: 'var(--border-primary)' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-4 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  backgroundColor: activeCategory === cat ? '#FF5900' : 'var(--bg-secondary)',
                  color: activeCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: activeCategory === cat ? 600 : 400,
                }}
              >
                {cat}
                <span className="ml-1.5 text-xs opacity-70">({categoryCounts[cat]})</span>
              </button>
            ))}
          </div>

          {/* File list */}
          <div className="p-5 sm:p-8">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No files yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Upload a file to get started</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 transition hover:shadow-sm theme-transition"
                    style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}
                  >
                    {/* File icon */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FF590015' }}>
                      <svg className="w-5 h-5" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{file.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 500 }}>{file.category}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{formatSize(file.size)}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{formatDate(file.uploadedAt)}</span>
                      </div>
                      {file.notes && (
                        <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>{file.notes}</p>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canPreview(file.type) && (
                        <button
                          onClick={() => previewFile(file)}
                          className="p-2 rounded-lg transition hover:scale-105"
                          style={{ color: 'var(--text-secondary)' }}
                          title="Preview"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-2 rounded-lg transition hover:scale-105"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="p-2 rounded-lg transition hover:scale-105"
                        style={{ color: '#FF5900' }}
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)' }} onClick={() => setShowUpload(false)}>
          <div className="relative rounded-2xl border w-full max-w-lg theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b theme-transition" style={{ borderColor: 'var(--border-primary)' }}>
              <h2 className="text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Upload File</h2>
              <button onClick={() => setShowUpload(false)} className="p-1 rounded-lg hover:bg-black/5 transition" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#FF590010', color: '#FF5900', border: '1px solid #FF590030' }}>{uploadError}</div>
              )}
              {/* File picker */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition hover:border-[#FF5900]"
                  style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
                >
                  <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
                  {pendingFile ? (
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{pendingFile.name}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatSize(pendingFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Click to select a file</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Max 10 MB</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Category */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Category</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {/* Notes */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Notes (optional)</label>
                <textarea
                  value={uploadNotes}
                  onChange={e => setUploadNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}
                  placeholder="Brief description of this file..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t theme-transition" style={{ borderColor: 'var(--border-primary)' }}>
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 rounded-lg text-sm transition" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!pendingFile}
                className="px-5 py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-overlay)' }} onClick={() => setShowPreview(null)}>
          <div
            className="relative rounded-2xl border w-full max-w-3xl max-h-[85vh] flex flex-col theme-transition"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 theme-transition" style={{ borderColor: 'var(--border-primary)' }}>
              <h2 className="text-lg truncate" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{showPreview.name}</h2>
              <button onClick={() => setShowPreview(null)} className="p-1 rounded-lg hover:bg-black/5 transition flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {showPreview.type.startsWith('image/') ? (
                <img src={showPreview.dataUrl} alt={showPreview.name} className="max-w-full max-h-[60vh] mx-auto object-contain rounded-lg" />
              ) : showPreview.type.startsWith('text/') ? (
                <pre className="text-sm whitespace-pre-wrap rounded-lg p-4 overflow-auto max-h-[55vh]" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {atob(showPreview.dataUrl.split(',')[1])}
                </pre>
              ) : (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Preview not available for this file type</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0 theme-transition" style={{ borderColor: 'var(--border-primary)' }}>
              <button
                onClick={() => handleDownload(showPreview)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition"
                style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
              <button onClick={() => setShowPreview(null)} className="px-4 py-2 rounded-lg text-sm transition" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}