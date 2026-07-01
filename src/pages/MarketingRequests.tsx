import { logActivity } from '../lib/activityLogger'

export default function MarketingRequests() {
  return (
    <div>
      {/* Header */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h1 className="text-3xl sm:text-4xl mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Marketing Requests</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Submit your marketing requests and reach out to the team
          </p>
        </div>
      </section>

      {/* Submit a Request Link */}
      <section className="py-12 px-4 sm:px-6 text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl p-8 sm:p-10 border theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl sm:text-2xl mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Submit a Marketing Request</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              Use our structured form to submit your request. Include all necessary details so the marketing team can act quickly.
            </p>
            <a
              href="/#/submit-request"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-medium transition hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Open Submission Form
            </a>
          </div>
        </div>
      </section>

      {/* Reach Out to Us */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 text-center" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 id="contact" className="text-2xl sm:text-4xl mb-4" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>Reach Out to Us</h2>
          <p className="text-sm sm:text-base mb-10 leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--btn-primary-text)', opacity: 0.8, fontWeight: 300 }}>
            Need marketing support? Have a question about brand guidelines? Reach us through the channels below.
          </p>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
            {[
              { icon: '📧', title: 'Email', info: 'maxene_pableo@exodiagamedev.com' },
              { icon: '💬', title: 'Slack', info: '#marketing-requests' },
              { icon: '📍', title: 'Office', info: 'Floor 4, Room 412' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-5 sm:p-6 rounded-xl min-w-[180px]" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--accent)' }}>{item.icon}</div>
                <p className="text-sm" style={{ color: 'var(--btn-primary-text)', fontWeight: 600 }}>{item.title}</p>
                <p className="text-xs text-center" style={{ color: 'var(--btn-primary-text)', opacity: 0.7, fontWeight: 300 }}>{item.info}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}