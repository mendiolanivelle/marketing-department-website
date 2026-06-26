import { useState, useEffect, useRef } from 'react'

interface Asset {
  id: string
  name: string
  category: string
  type: string
  dataUrl?: string
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

function getFileTypeIcon(type: string) {
  if (isImage(type)) return 'image'
  if (type.includes('pdf')) return 'pdf'
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('sheet')) return 'sheet'
  if (type.includes('video')) return 'video'
  return 'doc'
}

function getExt(type: string): string {
  const map: Record<string, string> = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/svg+xml': 'SVG', 'image/gif': 'GIF', 'image/webp': 'WEBP', 'text/plain': 'TXT', 'text/csv': 'CSV' }
  return map[type] || type.split('/').pop()?.toUpperCase() || 'FILE'
}

function renderTypeIcon(type: string, size: number, color: string) {
  const icon = getFileTypeIcon(type)
  switch (icon) {
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

export default function FileTracker() {
  const [userAssets, setUserAssets] = useState<Asset[]>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All Files')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('Presentations')
  const [uploadError, setUploadError] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userAssets))
  }, [userAssets])

  const allAssets = [...userAssets, ...mockAssets]

  const filtered = allAssets.filter(a => {
    const matchCategory = activeCategory === 'All Files' || a.category === activeCategory
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'All Files' ? allAssets.length : allAssets.filter(a => a.category === cat).length
    return acc
  }, {} as Record<string, number>)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setPendingFile(null); return }
    setPendingFile(file)
    setUploadError('')
  }

  const handleUpload = () => {
    if (!pendingFile) { setUploadError('Please select a file'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const asset: Asset = {
        id: generateId(),
        name: pendingFile.name,
        category: uploadCategory,
        type: pendingFile.type || 'application/octet-stream',
        dataUrl: reader.result as string,
        addedAt: new Date().toISOString(),
        size: pendingFile.size,
      }
      setUserAssets(prev => [asset, ...prev])
      setPendingFile(null)
      setUploadError('')
      setShowUpload(false)
    }
    reader.onerror = () => setUploadError('Failed to read file. The file may be too large for browser storage.')
    reader.readAsDataURL(pendingFile)
  }

  const handleDelete = (id: string) => {
    setUserAssets(prev => prev.filter(a => a.id !== id))
    setPreviewAsset(null)
  }

  const handleDownload = (asset: Asset) => {
    if (asset.isMock || !asset.dataUrl) return
    const a = document.createElement('a')
    a.href = asset.dataUrl
    a.download = asset.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const thumbnailColor = (cat: string) => CATEGORY_COLORS[cat] || '#FF5900'

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'rgba(202,205,215,0.15)' }}>
      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowUpload(false)}>
          <div className="relative rounded-2xl border w-full max-w-lg" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#CACDD7' }}>
              <h2 className="text-lg" style={{ color: '#1B1A1C', fontWeight: 700 }}>Upload New Asset</h2>
              <button onClick={() => setShowUpload(false)} className="p-1 rounded-lg transition" style={{ color: '#CACDD7' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#FF590010', color: '#FF5900', border: '1px solid #FF590030' }}>{uploadError}</div>
              )}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition hover:border-[#FF5900]"
                  style={{ borderColor: '#CACDD7', backgroundColor: 'rgba(202,205,215,0.1)' }}
                >
                  <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
                  {pendingFile ? (
                    <div>
                      <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{pendingFile.name}</p>
                      <p className="text-xs mt-1" style={{ color: '#CACDD7' }}>{formatSize(pendingFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-10 h-10 mx-auto mb-2" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      <p className="text-sm" style={{ color: '#3E4048', fontWeight: 500 }}>Click to select a file</p>
                      <p className="text-xs mt-1" style={{ color: '#CACDD7' }}>Any file type, no size limit</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>Category</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm"
                  style={{ borderColor: '#CACDD7', color: '#1B1A1C', backgroundColor: '#FFFFFF' }}
                >
                  {CATEGORIES.filter(c => c !== 'All Files').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#CACDD7' }}>
              <button onClick={() => { setShowUpload(false); setPendingFile(null); setUploadError('') }} className="px-4 py-2 rounded-lg text-sm transition" style={{ color: '#3E4048', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleUpload} disabled={!pendingFile} className="px-5 py-2 rounded-lg text-sm transition disabled:opacity-50" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>Upload</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPreviewAsset(null)}>
          <div className="relative rounded-2xl border w-full max-w-3xl max-h-[85vh] flex flex-col" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              <h2 className="text-lg truncate" style={{ color: '#1B1A1C', fontWeight: 700 }}>{previewAsset.name}</h2>
              <button onClick={() => setPreviewAsset(null)} className="p-1 rounded-lg transition flex-shrink-0" style={{ color: '#CACDD7' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
              {previewAsset.dataUrl && isImage(previewAsset.type) ? (
                <img src={previewAsset.dataUrl} alt={previewAsset.name} className="max-w-full max-h-[55vh] object-contain rounded-lg" />
              ) : (
                <div className="text-center py-16">
                  {renderTypeIcon(previewAsset.type, 16, '#CACDD7')}
                  <p className="text-sm mt-3" style={{ color: '#3E4048', fontWeight: 500 }}>Preview not available for this file type</p>
                  <p className="text-xs mt-1" style={{ color: '#CACDD7' }}>Download the file to view it</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              {!previewAsset.isMock && previewAsset.dataUrl && (
                <button onClick={() => { handleDownload(previewAsset); setPreviewAsset(null) }} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Download
                </button>
              )}
              <button onClick={() => setPreviewAsset(null)} className="px-4 py-2 rounded-lg text-sm transition" style={{ color: '#3E4048', fontWeight: 500 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`flex-shrink-0 hidden sm:flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-14' : 'w-56'}`} style={{ backgroundColor: '#3E4048' }}>
        <div className="flex items-center justify-between px-3 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {!sidebarCollapsed && <h2 className="text-sm font-semibold tracking-wider uppercase truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>Categories</h2>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-lg transition-all duration-200 flex-shrink-0 hover:scale-105 ${sidebarCollapsed ? 'mx-auto' : ''}`}
            style={{ color: 'rgba(255,255,255,0.5)' }}
            title={sidebarCollapsed ? 'Expand categories' : 'Collapse categories'}
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`w-full flex items-center rounded-lg text-sm transition-all duration-200 text-left ${sidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2.5'}`}
              style={{
                backgroundColor: activeCategory === cat ? '#FF5900' : 'transparent',
                color: activeCategory === cat ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                fontWeight: activeCategory === cat ? 600 : 400,
              }}
              onMouseEnter={e => { if (activeCategory !== cat) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#FFFFFF' } }}
              onMouseLeave={e => { if (activeCategory !== cat) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' } }}
              title={sidebarCollapsed ? cat : undefined}
            >
              {sidebarCollapsed ? (
                <span className="text-xs font-bold">{cat.charAt(0)}</span>
              ) : (
                <>
                  <span className="truncate">{cat}</span>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ opacity: 0.6 }}>({categoryCounts[cat]})</span>
                </>
              )}
            </button>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="px-4 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{filtered.length} file{filtered.length !== 1 ? 's' : ''} found</div>
          </div>
        )}
      </aside>

      {/* Mobile categories */}
      <div className="sm:hidden flex gap-2 px-4 pt-4 pb-2 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className="px-4 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all"
            style={{ backgroundColor: activeCategory === cat ? '#FF5900' : '#3E4048', color: activeCategory === cat ? '#FFFFFF' : 'rgba(255,255,255,0.7)', fontWeight: activeCategory === cat ? 600 : 400 }}>
            {cat} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search files by name..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none text-sm transition"
                style={{ borderColor: '#CACDD7', color: '#1B1A1C', backgroundColor: '#FFFFFF' }} />
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Upload New Asset
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
                  className="rounded-xl border-2 overflow-hidden transition-all duration-200 hover:shadow-lg"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}
                  onMouseEnter={() => setHoveredId(asset.id)}
                  onMouseLeave={() => setHoveredId(null)}>
                  {/* Thumbnail */}
                  <div className="h-36 flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'rgba(202,205,215,0.2)' }}>
                    {asset.dataUrl && isImage(asset.type) ? (
                      <img src={asset.dataUrl} alt={asset.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-1" style={{ color: thumbnailColor(asset.category) }}>
                        {renderTypeIcon(asset.type, 8, thumbnailColor(asset.category))}
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>{getExt(asset.type)}</span>
                      </div>
                    )}
                  </div>
                  {/* Card body */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate" style={{ color: '#1B1A1C', fontWeight: 600 }}>{asset.name}</p>
                      </div>
                      <div className={`flex items-center gap-1 transition-opacity duration-200 ${hoveredId === asset.id ? 'opacity-100' : 'opacity-0'}`}>
                        {asset.dataUrl && isImage(asset.type) && (
                          <button onClick={() => setPreviewAsset(asset)} className="p-1.5 rounded-lg transition hover:scale-105" style={{ color: '#3E4048', backgroundColor: 'rgba(202,205,215,0.3)' }} title="Preview">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                        )}
                        {!asset.isMock && asset.dataUrl && (
                          <button onClick={() => handleDownload(asset)} className="p-1.5 rounded-lg transition hover:scale-105" style={{ color: '#3E4048', backgroundColor: 'rgba(202,205,215,0.3)' }} title="Download">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                        )}
                        <button onClick={() => handleDelete(asset.id)} className="p-1.5 rounded-lg transition hover:scale-105" style={{ color: '#FF5900', backgroundColor: 'rgba(202,205,215,0.3)' }} title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${CATEGORY_COLORS[asset.category]}20`, color: CATEGORY_COLORS[asset.category] }}>
                        {asset.category}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{formatDate(asset.addedAt)}</span>
                      <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{formatSize(asset.size)}</span>
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