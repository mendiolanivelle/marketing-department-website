import { useState } from 'react'

interface MockAsset {
  id: string
  name: string
  category: string
  type: 'image' | 'pdf' | 'doc' | 'sheet' | 'video'
  addedAt: string
  thumbnail?: string
  size: string
}

const CATEGORIES = ['All Files', 'Presentations', 'Social Media', 'Brand Assets', 'Templates', 'Documents']

const CATEGORY_COLORS: Record<string, string> = {
  'Presentations': '#FF5900',
  'Social Media': '#FF8A00',
  'Brand Assets': '#6C5CE7',
  'Templates': '#00B894',
  'Documents': '#0984E3',
}

const mockAssets: MockAsset[] = [
  { id: '1', name: 'Q3 Investor Deck', category: 'Presentations', type: 'pdf', addedAt: '2026-06-20', size: '4.2 MB' },
  { id: '2', name: 'Product Launch Keynote', category: 'Presentations', type: 'pdf', addedAt: '2026-06-18', size: '8.7 MB' },
  { id: '3', name: 'LinkedIn Banner - Q3 Campaign', category: 'Social Media', type: 'image', addedAt: '2026-06-22', size: '1.1 MB' },
  { id: '4', name: 'Instagram Story Template', category: 'Social Media', type: 'image', addedAt: '2026-06-19', size: '0.8 MB' },
  { id: '5', name: 'Company Logo - Full Color', category: 'Brand Assets', type: 'image', addedAt: '2026-06-15', size: '2.3 MB' },
  { id: '6', name: 'Brand Style Guide v3.0', category: 'Brand Assets', type: 'pdf', addedAt: '2026-06-10', size: '12.5 MB' },
  { id: '7', name: 'Email Newsletter Template', category: 'Templates', type: 'doc', addedAt: '2026-06-21', size: '0.5 MB' },
  { id: '8', name: 'Campaign Brief Template', category: 'Templates', type: 'doc', addedAt: '2026-06-14', size: '0.3 MB' },
  { id: '9', name: 'Q2 Marketing Report', category: 'Documents', type: 'sheet', addedAt: '2026-06-12', size: '3.6 MB' },
  { id: '10', name: 'Conference Budget Breakdown', category: 'Documents', type: 'sheet', addedAt: '2026-06-08', size: '1.8 MB' },
  { id: '11', name: 'Twitter Thread - Launch Week', category: 'Social Media', type: 'doc', addedAt: '2026-06-23', size: '0.2 MB' },
  { id: '12', name: 'All-Hands Q3 Kickoff Deck', category: 'Presentations', type: 'pdf', addedAt: '2026-06-17', size: '6.4 MB' },
]

function getTypeIcon(type: MockAsset['type']) {
  switch (type) {
    case 'image':
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'pdf':
      return (
        <svg className="w-8 h-8" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    case 'doc':
      return (
        <svg className="w-8 h-8" style={{ color: '#0984E3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'sheet':
      return (
        <svg className="w-8 h-8" style={{ color: '#00B894' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'video':
      return (
        <svg className="w-8 h-8" style={{ color: '#6C5CE7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FileTracker() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All Files')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const filtered = mockAssets.filter(a => {
    const matchCategory = activeCategory === 'All Files' || a.category === activeCategory
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'All Files' ? mockAssets.length : mockAssets.filter(a => a.category === cat).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'rgba(202,205,215,0.15)' }}>
      {/* Left Sidebar - Categories */}
      <aside className="w-56 flex-shrink-0 hidden sm:flex flex-col" style={{ backgroundColor: '#3E4048' }}>
        <div className="px-5 pt-6 pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Categories</h2>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 text-left"
              style={{
                backgroundColor: activeCategory === cat ? '#FF5900' : 'transparent',
                color: activeCategory === cat ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                fontWeight: activeCategory === cat ? 600 : 400,
              }}
              onMouseEnter={e => {
                if (activeCategory !== cat) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = '#FFFFFF'
                }
              }}
              onMouseLeave={e => {
                if (activeCategory !== cat) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                }
              }}
            >
              <span className="truncate">{cat}</span>
              <span className="text-xs ml-2 flex-shrink-0" style={{ opacity: 0.6 }}>({categoryCounts[cat]})</span>
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {filtered.length} file{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </aside>

      {/* Mobile category scroll */}
      <div className="sm:hidden flex gap-2 px-4 pt-4 pb-2 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-4 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all"
            style={{
              backgroundColor: activeCategory === cat ? '#FF5900' : '#3E4048',
              color: activeCategory === cat ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              fontWeight: activeCategory === cat ? 600 : 400,
            }}
          >
            {cat} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search files by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none text-sm transition"
                style={{ borderColor: '#CACDD7', color: '#1B1A1C', backgroundColor: '#FFFFFF' }}
              />
            </div>
            <button
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload New Asset
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="p-4 sm:p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <svg className="w-20 h-20 mx-auto mb-4" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg" style={{ color: '#3E4048', fontWeight: 500 }}>No files match your search</p>
              <p className="text-sm mt-1" style={{ color: '#CACDD7', fontWeight: 300 }}>Try a different keyword or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(asset => (
                <div
                  key={asset.id}
                  className="rounded-xl border-2 overflow-hidden transition-all duration-200 hover:shadow-lg"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}
                  onMouseEnter={() => setHoveredId(asset.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Thumbnail / Preview area */}
                  <div className="h-36 flex items-center justify-center" style={{ backgroundColor: 'rgba(202,205,215,0.2)' }}>
                    {asset.type === 'image' ? (
                      <div className="flex flex-col items-center gap-1" style={{ color: '#CACDD7' }}>
                        {getTypeIcon(asset.type)}
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>Image Preview</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        {getTypeIcon(asset.type)}
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>
                          {asset.type.toUpperCase()} File
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate" style={{ color: '#1B1A1C', fontWeight: 600 }}>{asset.name}</p>
                      </div>
                      {/* Hover actions */}
                      <div className={`flex items-center gap-1 transition-opacity duration-200 ${hoveredId === asset.id ? 'opacity-100' : 'opacity-0'}`}>
                        <button
                          className="p-1.5 rounded-lg transition hover:scale-105"
                          style={{ color: '#3E4048', backgroundColor: 'rgba(202,205,215,0.3)' }}
                          title="Download"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          className="p-1.5 rounded-lg transition hover:scale-105"
                          style={{ color: '#FF5900', backgroundColor: 'rgba(202,205,215,0.3)' }}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Category tag */}
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[asset.category]}20`,
                          color: CATEGORY_COLORS[asset.category],
                        }}
                      >
                        {asset.category}
                      </span>
                    </div>

                    {/* Date + size */}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{formatDate(asset.addedAt)}</span>
                      <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{asset.size}</span>
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