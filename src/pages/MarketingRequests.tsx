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

      {/* Reach Out + Working Hours */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-start">
          <div>
            <h2 id="contact" className="text-2xl sm:text-4xl mb-4" style={{ color: 'var(--btn-primary-text)', fontWeight: 700 }}>Reach Out to Us</h2>
            <p className="text-sm sm:text-base mb-5 leading-relaxed" style={{ color: 'var(--btn-primary-text)', opacity: 0.8, fontWeight: 300 }}>
              Need marketing support? Have a question about brand guidelines? Reach us through the channels below.
            </p>
            <div className="space-y-3 mb-6">
              {[
                { icon: '📧', title: 'Email', info: 'maxene_pableo@exodiagamedev.com' },
                { icon: '💬', title: 'Slack', info: '#marketing-requests' },
                { icon: '📍', title: 'Office', info: 'Floor 4, Room 412' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ backgroundColor: 'var(--accent)' }}>{item.icon}</div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--btn-primary-text)', fontWeight: 500 }}>{item.title}</p>
                    <p className="text-xs" style={{ color: 'var(--btn-primary-text)', opacity: 0.7, fontWeight: 300 }}>{item.info}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const form = e.target as HTMLFormElement; const data = Object.fromEntries(new FormData(form)); localStorage.setItem('exodia-contact-submission', JSON.stringify({ ...data, date: new Date().toISOString() })); alert('Request submitted!'); form.reset(); logActivity('Marketing Requests', `Contact form submitted by "${data.name}"`) }} className="space-y-2.5">
              <input name="name" required placeholder="Your Name" className="w-full px-3.5 py-2 rounded-lg outline-none text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              <input name="email" required placeholder="Your Email" className="w-full px-3.5 py-2 rounded-lg outline-none text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              <textarea name="message" required rows={2} placeholder="Briefly describe your request..." className="w-full px-3.5 py-2 rounded-lg outline-none text-sm resize-none" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              <button type="submit" className="px-5 py-2 text-sm rounded-lg transition border-2" style={{ color: 'var(--btn-primary-text)', borderColor: 'var(--btn-primary-text)', fontWeight: 500 }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--btn-primary-text)'; e.currentTarget.style.borderColor = 'var(--btn-primary-text)' }}
              >Send Message</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}