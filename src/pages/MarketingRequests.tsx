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
            <div className="flex flex-col items-center gap-4 p-7 sm:p-9 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 group" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, #EA4335, #FB8861)' }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1.5" style={{ color: '#FFFFFF', fontWeight: 600 }}>Email</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>maxene_pableo@exodiagamedev.com</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 p-7 sm:p-9 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 group" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, #4A154B, #7B2D8E)' }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 15.5C6 17.43 4.93 19 3.5 19S1 17.43 1 15.5 2.07 12 3.5 12 6 13.57 6 15.5M6 8.5C6 10.43 4.93 12 3.5 12S1 10.43 1 8.5 2.07 5 3.5 5 6 6.57 6 8.5M9 12c0 1.93 1.07 3.5 2.5 3.5S14 13.93 14 12s-1.07-3.5-2.5-3.5S9 10.07 9 12m6-3.5c0 1.93 1.07 3.5 2.5 3.5S20 10.43 20 8.5 18.93 5 17.5 5 15 6.57 15 8.5m2.5 6c-1.43 0-2.5 1.57-2.5 3.5s1.07 3.5 2.5 3.5 2.5-1.57 2.5-3.5-1.07-3.5-2.5-3.5z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1.5" style={{ color: '#FFFFFF', fontWeight: 600 }}>Slack</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>#marketing-requests</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 p-7 sm:p-9 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 group" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, #0078D4, #00BCF2)' }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
              </div>
              <div>
                <p className="text-base mb-1.5" style={{ color: '#FFFFFF', fontWeight: 600 }}>Office</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>Floor 4, Room 412</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}