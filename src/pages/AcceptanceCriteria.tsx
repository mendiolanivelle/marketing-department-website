export default function AcceptanceCriteria() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-center">
        <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 className="text-2xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Acceptance Criteria Form</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>Coming soon</p>
      </div>
    </div>
  )
}