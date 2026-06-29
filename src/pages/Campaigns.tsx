export default function Campaigns() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-center">
        <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        <h1 className="text-2xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Campaigns</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Coming soon</p>
      </div>
    </div>
  )
}