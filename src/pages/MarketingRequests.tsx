export default function MarketingRequests() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-center">
        <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h1 className="text-2xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Marketing Requests</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Coming soon</p>
      </div>
    </div>
  )
}