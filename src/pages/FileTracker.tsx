import { useState, useEffect, useRef } from 'react'
import { logActivity } from '../lib/activityLogger'

interface Asset {
  id: string
  name: string
  category: string
  type: string
  dataUrl?: string
  url?: string
  addedAt: string
  size: number
  isMock?: boolean
}

const CATEGORIES = ['All Files', 'Presentations', 'Social Media', 'Brand Assets', 'Templates', 'Documents']

const CATEGORY_COLORS: Record<string, string> = {
  'Presentations': '#FF5900',
  'Social Media': '#FF8A00',
  'Brand Assets': '#6C5CE7',
  'Templates': '#00B894',
  'Documents': '#0984E3',
}

const STORAGE_KEY = 'exodia-file-tracker-assets'

const mockAssets: Asset[] = [
  { id: 'mock-1', name: 'Q3 Investor Deck', category: 'Presentations', type: 'application/pdf', addedAt: '2026-06-20T10:00:00', size: 4400000, isMock: true },
  { id: 'mock-2', name: 'Product Launch Keynote', category: 'Presentations', type: 'application/pdf', addedAt: '2026-06-18T14:30:00', size: 9100000, isMock: true },
  { id: 'mock-3', name: 'LinkedIn Banner - Q3 Campaign', category: 'Social Media', type: 'image/png', addedAt: '2026-06-22T09:15:00', size: 1150000, isMock: true },
  { id: 'mock-4', name: 'Instagram Story Template', category: 'Social Media', type: 'image/jpeg', addedAt: '2026-06-19T11:00:00', size: 840000, isMock: true },
  { id: 'mock-5', name: 'Company Logo - Full Color', category: 'Brand Assets', type: 'image/svg+xml', addedAt: '2026-06-15T08:00:00', size: 2400000, isMock: true },
  { id: 'mock-6', name: 'Brand Style Guide v3.0', category: 'Brand Assets', type: 'application/pdf', addedAt: '2026-06-10T16:00:00', size: 13100000, isMock: true },
  { id: 'mock-7', name: 'Email Newsletter Template', category: 'Templates', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', addedAt: '2026-06-21T13:00:00', size: 520000, isMock: true },
  { id: 'mock-8', name: 'Campaign Brief Template', category: 'Templates', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', addedAt: '2026-06-14T10:00:00', size: 310000, isMock: true },
  { id: 'mock-9', name: 'Q2 Marketing Report', category: 'Documents', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', addedAt: '2026-06-12T15:00:00', size: 3800000, isMock: true },
  { id: 'mock-10', name: 'Conference Budget Breakdown', category: 'Documents', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', addedAt: '2026-06-08T09:00:00', size: 1900000, isMock: true },
  { id: 'mock-11', name: 'Twitter Thread - Launch Week', category: 'Social Media', type: 'text/plain', addedAt: '2026-06-23T12:00:00', size: 210000, isMock: true },
  { id: 'mock-12', name: 'All-Hands Q3 Kickoff Deck', category: 'Presentations', type: 'application/pdf', addedAt: '2026-06-17T08:30:00', size: 6700000, isMock: true },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isImage(type: string): boolean { return type.startsWith('image/') }
function isLink(type: string): boolean { return type === 'link' }

function getFileTypeIcon(type: string) {
  if (isLink(type)) return 'link'
  if (isImage(type)) return 'image'
  if (type.includes('pdf')) return 'pdf'
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('sheet')) return 'sheet'
  if (type.includes('video')) return 'video'
  return 'doc'
}

function getExt(type: string): string {
  if (isLink(type)) return 'URL'
  const map: Record<string, string> = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/svg+xml': 'SVG', 'image/gif': 'GIF', 'image/webp': 'WEBP', 'text/plain': 'TXT', 'text/csv': 'CSV' }
  return map[type] || type.split('/').pop()?.toUpperCase() || 'FILE'
}

function renderTypeIcon(type: string, size: number, color: string) {
  const icon = getFileTypeIcon(type)
  switch (icon) {
    case 'link':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
    case 'image':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    case 'pdf':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    case 'doc':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    case 'sheet':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    case 'video':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  }
}

function generateId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

function isValidUrl(str: string): boolean {
  try { new URL(str); return true } catch { return false }
}

function normalizeUrl(str: string): string {
  if (!str.startsWith('http://') && !str.startsWith('https://')) return 'https://' + str
  return str
}

export default function FileTracker() {
  const [userAssets, setUserAssets] = useState<Asset[]>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [deletedMockIds, setDeletedMockIds] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('exodia-deleted-mock-assets'); return new Set(s ? JSON.parse(s) : []) } catch { return new Set() }
  })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All Files')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file')
  const [uploadCategory, setUploadCategory] = useState('Presentations')
  const [uploadError, setUploadError] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userAssets))
  }, [userAssets])

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.setAttribute('webkitdirectory', '')
  }, [])

  const allAssets = [...userAssets, ...mockAssets.filter(m => !deletedMockIds.has(m.id))]

  // Persist deleted mock IDs
  useEffect(() => {
    localStorage.setItem('exodia-deleted-mock-assets', JSON.stringify([...deletedMockIds]))
  }, [deletedMockIds])

  const filtered = allAssets.filter(a => {
    const matchCategory = activeCategory === 'All Files' || a.category === activeCategory
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'All Files' ? allAssets.length : allAssets.filter(a => a.category === cat).length
    return acc
  }, {} as Record<string, number>)

  const handleFilesSelected = (files: FileList) => {
    const list: File[] = []
    for (let i = 0; i < files.length; i++) list.push(files[i])
    setPendingFiles(prev => [...prev, ...list])
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  const readAndUpload = (file: File) => {
    return new Promise<void>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const asset: Asset = {
          id: generateId(),
          name: file.name,
          category: uploadCategory,
          type: file.type || 'application/octet-stream',
          dataUrl: reader.result as string,
          addedAt: new Date().toISOString(),
          size: file.size,
        }
        setUserAssets(prev => [asset, ...prev])
        resolve()
        logActivity('Files', `Uploaded "${file.name}"`)
      }
      reader.onerror = () => { setUploadError('Some files failed to read. They may be too large.'); resolve() }
      reader.readAsDataURL(file)
    })
  }

  const handleUpload = async () => {
    if (uploadMode === 'file') {
      if (pendingFiles.length === 0) { setUploadError('Please select at least one file'); return }
      setUploadError('')
      const files = [...pendingFiles]
      setPendingFiles([])
      setShowUpload(false)
      for (const file of files) await readAndUpload(file)
    } else {
      const name = linkName.trim()
      if (!name) { setUploadError('Please enter a name for the link'); return }
      const url = normalizeUrl(linkUrl.trim())
      if (!isValidUrl(url)) { setUploadError('Please enter a valid URL'); return }
      const asset: Asset = {
        id: generateId(),
        name,
        category: uploadCategory,
        type: 'link',
        url,
        addedAt: new Date().toISOString(),
        size: 0,
      }
      setUserAssets(prev => [asset, ...prev])
      setLinkName('')
      setLinkUrl('')
      setUploadError('')
      setShowUpload(false)
      logActivity('Files', `Added link "${name}" (${url})`)
    }
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this file?')) return
    const asset = userAssets.find(a => a.id === id) || mockAssets.find(a => a.id === id)
    if (asset && mockAssets.some(m => m.id === id)) {
      setDeletedMockIds(prev => { const next = new Set(prev); next.add(id); return next })
    } else {
      setUserAssets(prev => prev.filter(a => a.id !== id))
    }
    if (previewAsset?.id === id) setPreviewAsset(null)
    if (asset) logActivity('Files', `Deleted "${asset.name}"`)
  }

  const handleDownload = (asset: Asset) => {
    if (asset.isMock || !asset.dataUrl) return
    const a = document.createElement('a')
    a.href = asset.dataUrl
    a.download = asset.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const openLink = (asset: Asset) => {
    if (asset.url) window.open(asset.url, '_blank', 'noopener,noreferrer')
  }

  const startEditing = (asset: Asset) => {
    if (asset.isMock) return
    setEditingId(asset.id)
    setEditValue(asset.name)
  }

  const saveEdit = () => {
    const trimmed = editValue.trim()
    if (!trimmed || !editingId) { setEditingId(null); return }
    setUserAssets(prev => prev.map(a => a.id === editingId ? { ...a, name: trimmed } : a))
    setEditingId(null)
  }

  const thumbnailColor = (cat: string) => CATEGORY_COLORS[cat] || '#FF5900'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowUpload(false)}>
          <div className="relative rounded-2xl border w-full max-w-lg max-h-[85vh] flex flex-col" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              <h2 className="text-lg" style={{ color: '#1B1A1C', fontWeight: 700 }}>Add Asset</h2>
              <button onClick={() => { setShowUpload(false); setPendingFiles([]); setUploadError('') }} className="p-1 rounded-lg transition" style={{ color: '#CACDD7' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {uploadError && <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#FF590010', color: '#FF5900', border: '1px solid #FF590030' }}>{uploadError}</div>}
              {/* Mode toggle */}
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#CACDD7' }}>
                <button onClick={() => setUploadMode('file')} className="flex-1 py-2 text-sm font-medium transition" style={{ backgroundColor: uploadMode === 'file' ? '#FF5900' : 'transparent', color: uploadMode === 'file' ? '#FFFFFF' : '#3E4048' }}>
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    File Upload
                  </span>
                </button>
                <button onClick={() => setUploadMode('link')} className="flex-1 py-2 text-sm font-medium transition" style={{ backgroundColor: uploadMode === 'link' ? '#FF5900' : 'transparent', color: uploadMode === 'link' ? '#FFFFFF' : '#3E4048' }}>
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    Link / URL
                  </span>
                </button>
              </div>
              {/* File upload section */}
              {uploadMode === 'file' ? (
                <>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>Files</label>
                    <div className="border-2 border-dashed rounded-xl p-5 text-center" style={{ borderColor: '#CACDD7', backgroundColor: 'rgba(202,205,215,0.1)' }}>
                      <input ref={fileInputRef} type="file" multiple onChange={e => { if (e.target.files) handleFilesSelected(e.target.files) }} className="hidden" />
                      <input ref={folderInputRef} type="file" onChange={e => { if (e.target.files) handleFilesSelected(e.target.files) }} className="hidden" />
                      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-3">
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          Select Files
                        </button>
                        <button onClick={() => folderInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ border: '2px solid #FF5900', color: '#FF5900', fontWeight: 600 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                          Select Folder
                        </button>
                      </div>
                      <p className="text-xs" style={{ color: '#CACDD7' }}>Any file type, no size limit</p>
                    </div>
                  </div>
                  {pendingFiles.length > 0 && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>{pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} selected</label>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-lg p-2" style={{ borderColor: '#CACDD7' }}>
                        {pendingFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm" style={{ backgroundColor: 'rgba(202,205,215,0.1)' }}>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="truncate flex-1" style={{ color: '#1B1A1C' }}>{f.name}</span>
                            <span className="text-xs flex-shrink-0" style={{ color: '#CACDD7' }}>{formatSize(f.size)}</span>
                            <button onClick={() => removePendingFile(i)} className="p-0.5 rounded flex-shrink-0 hover:bg-black/5" style={{ color: '#FF5900' }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>Name</label>
                    <input type="text" value={linkName} onChange={e => setLinkName(e.target.value)}
                      placeholder="e.g. Google Drive - Brand Assets"
                      className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>URL</label>
                    <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }} />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>Category</label>
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm" style={{ borderColor: '#CACDD7', color: '#1B1A1C', backgroundColor: '#FFFFFF' }}>
                  {CATEGORIES.filter(c => c !== 'All Files').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              <button onClick={() => { setShowUpload(false); setPendingFiles([]); setLinkName(''); setLinkUrl(''); setUploadError('') }} className="px-4 py-2 rounded-lg text-sm transition" style={{ color: '#3E4048', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleUpload} disabled={uploadMode === 'file' ? pendingFiles.length === 0 : !linkName.trim() || !linkUrl.trim()} className="px-5 py-2 rounded-lg text-sm transition disabled:opacity-50" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                {uploadMode === 'file' ? `Upload${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}` : 'Add Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview / Overview modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPreviewAsset(null)}>
          <div className="relative rounded-2xl border w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {renderTypeIcon(previewAsset.type, 6, CATEGORY_COLORS[previewAsset.category] || '#FF5900')}
                <h2 className="text-lg truncate" style={{ color: '#1B1A1C', fontWeight: 700 }}>{previewAsset.name}</h2>
              </div>
              <button onClick={() => setPreviewAsset(null)} className="p-1 rounded-lg transition flex-shrink-0 ml-2" style={{ color: '#CACDD7' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto flex flex-col lg:flex-row">
              <div className="flex-1 min-h-64 lg:min-h-0 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(202,205,215,0.1)' }}>
                {isLink(previewAsset.type) ? (
                  <div className="text-center">
                    {renderTypeIcon(previewAsset.type, 20, CATEGORY_COLORS[previewAsset.category] || '#FF5900')}
                    <p className="text-sm mt-4 mb-3 max-w-xs break-all" style={{ color: '#3E4048', fontWeight: 500 }}>{previewAsset.url}</p>
                    <button onClick={() => openLink(previewAsset)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Open Link
                    </button>
                  </div>
                ) : previewAsset.dataUrl && isImage(previewAsset.type) ? (
                  <img src={previewAsset.dataUrl} alt={previewAsset.name} className="max-w-full max-h-[40vh] lg:max-h-[55vh] object-contain rounded-lg" />
                ) : (
                  <div className="text-center">
                    {renderTypeIcon(previewAsset.type, 20, '#CACDD7')}
                    <p className="text-sm mt-3" style={{ color: '#3E4048', fontWeight: 500 }}>Preview not available</p>
                    <p className="text-xs mt-1" style={{ color: '#CACDD7' }}>Download the file to view it</p>
                  </div>
                )}
              </div>
              <div className="w-full lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l p-6 space-y-5 overflow-y-auto" style={{ borderColor: '#CACDD7' }}>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Name</label>
                  {!previewAsset.isMock ? (
                    <input type="text" defaultValue={previewAsset.name}
                      onBlur={e => { const v = e.target.value.trim(); if (v) setUserAssets(prev => prev.map(a => a.id === previewAsset.id ? { ...a, name: v } : a)) }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }} />
                  ) : (
                    <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{previewAsset.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Category</label>
                  {!previewAsset.isMock ? (
                    <select defaultValue={previewAsset.category}
                      onChange={e => setUserAssets(prev => prev.map(a => a.id === previewAsset.id ? { ...a, category: e.target.value } : a))}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }}>
                      {CATEGORIES.filter(c => c !== 'All Files').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${CATEGORY_COLORS[previewAsset.category]}20`, color: CATEGORY_COLORS[previewAsset.category] }}>{previewAsset.category}</span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>{isLink(previewAsset.type) ? 'URL' : 'File Type'}</label>
                  {isLink(previewAsset.type) ? (
                    <a href={previewAsset.url} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all" style={{ color: '#FF5900' }}>{previewAsset.url}</a>
                  ) : (
                    <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{previewAsset.type || 'Unknown'} ({getExt(previewAsset.type)})</p>
                  )}
                </div>
                {!isLink(previewAsset.type) && (
                  <div>
                    <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Size</label>
                    <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{formatSize(previewAsset.size)}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Date Added</label>
                  <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{formatDate(previewAsset.addedAt)}</p>
                </div>
                <div className="pt-3 space-y-2">
                  {isLink(previewAsset.type) && previewAsset.url && (
                    <button onClick={() => openLink(previewAsset)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Open Link
                    </button>
                  )}
                  {!previewAsset.isMock && previewAsset.dataUrl && !isLink(previewAsset.type) && (
                    <button onClick={() => handleDownload(previewAsset)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Download
                    </button>
                  )}
                  <button onClick={() => { handleDelete(previewAsset.id); setPreviewAsset(null) }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition" style={{ border: '2px solid #FF5900', color: '#FF5900', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
</button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div>
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-3 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="relative sm:max-w-xs lg:max-w-sm flex-shrink-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border outline-none text-sm transition"
                style={{ borderColor: '#CACDD7', color: '#1B1A1C', backgroundColor: '#FFFFFF' }} />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    backgroundColor: activeCategory === cat ? '#FF5900' : 'rgba(202,205,215,0.25)',
                    color: activeCategory === cat ? '#FFFFFF' : '#3E4048',
                    fontWeight: activeCategory === cat ? 600 : 400,
                  }}>
                  {cat}
                  <span style={{ opacity: 0.6 }}>({categoryCounts[cat]})</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowUpload(true)} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:-translate-y-0.5 flex-shrink-0" style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Upload
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <svg className="w-20 h-20 mx-auto mb-4" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-lg" style={{ color: '#3E4048', fontWeight: 500 }}>No files found</p>
              <p className="text-sm mt-1" style={{ color: '#CACDD7', fontWeight: 300 }}>Try a different keyword or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(asset => (
                <div key={asset.id}
                  onClick={() => { if (isLink(asset.type) && asset.url) { window.open(asset.url, '_blank', 'noopener,noreferrer') } else { setPreviewAsset(asset) } }}
                  className="rounded-xl border-2 overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}
                  onMouseEnter={() => setHoveredId(asset.id)} onMouseLeave={() => setHoveredId(null)}>
                  <div className="h-36 flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'rgba(202,205,215,0.2)' }}>
                    {isLink(asset.type) ? (
                      <div className="flex flex-col items-center gap-1" style={{ color: thumbnailColor(asset.category) }}>
                        {renderTypeIcon(asset.type, 8, thumbnailColor(asset.category))}
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>URL</span>
                      </div>
                    ) : asset.dataUrl && isImage(asset.type) ? (
                      <img src={asset.dataUrl} alt={asset.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-1" style={{ color: thumbnailColor(asset.category) }}>
                        {renderTypeIcon(asset.type, 8, thumbnailColor(asset.category))}
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>{getExt(asset.type)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {editingId === asset.id ? (
                          <input ref={editInputRef} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                            className="w-full px-1.5 py-0.5 rounded border text-sm outline-none"
                            style={{ borderColor: '#FF5900', color: '#1B1A1C' }}
                            onClick={e => e.stopPropagation()} />
                        ) : (
                          <p className="text-sm truncate cursor-pointer hover:underline" style={{ color: '#1B1A1C', fontWeight: 600 }}
                            onClick={e => { e.stopPropagation(); startEditing(asset) }} title="Click to rename">{asset.name}</p>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 transition-opacity duration-200 ${hoveredId === asset.id ? 'opacity-100' : 'opacity-0'}`}>
                        {!asset.isMock && !isLink(asset.type) && asset.dataUrl && (
                          <button onClick={e => { e.stopPropagation(); handleDownload(asset) }} className="p-1.5 rounded-lg transition hover:scale-105" style={{ color: '#3E4048', backgroundColor: 'rgba(202,205,215,0.3)' }} title="Download">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); handleDelete(asset.id) }} className="p-1.5 rounded-lg transition hover:scale-105" style={{ color: '#FF5900', backgroundColor: 'rgba(202,205,215,0.3)' }} title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${CATEGORY_COLORS[asset.category]}20`, color: CATEGORY_COLORS[asset.category] }}>{asset.category}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{formatDate(asset.addedAt)}</span>
                      {!isLink(asset.type) ? (
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{formatSize(asset.size)}</span>
                      ) : (
                        <span className="text-xs" style={{ color: '#FF5900', fontWeight: 400 }}>Link</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}