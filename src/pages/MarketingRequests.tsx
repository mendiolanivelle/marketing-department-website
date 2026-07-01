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
        <div className="max-w-4xl mx-auto">
          <h2 id="contact" className="text-2xl sm:text-4xl mb-4" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>Reach Out to Us</h2>
          <p className="text-sm sm:text-base mb-12 leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--btn-primary-text)', opacity: 0.8, fontWeight: 300 }}>
            Need marketing support? Have a question about brand guidelines? Reach us through the channels below.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-4 p-6 sm:p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg group" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg" style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1" style={{ color: 'var(--btn-primary-text)', fontWeight: 600 }}>Email</p>
                <p className="text-sm" style={{ color: 'var(--btn-primary-text)', opacity: 0.7, fontWeight: 300 }}>maxene_pableo@exodiagamedev.com</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 p-6 sm:p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg group" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg" style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1" style={{ color: 'var(--btn-primary-text)', fontWeight: 600 }}>Slack</p>
                <p className="text-sm" style={{ color: 'var(--btn-primary-text)', opacity: 0.7, fontWeight: 300 }}>#marketing-requests</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 p-6 sm:p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg group" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg" style={{ backgroundColor: '#FF5900', boxShadow: '0 4px 12px rgba(255,89,0,0.3)' }}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1" style={{ color: 'var(--btn-primary-text)', fontWeight: 600 }}>Office</p>
                <p className="text-sm" style={{ color: 'var(--btn-primary-text)', opacity: 0.7, fontWeight: 300 }}>Floor 4, Room 412</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}