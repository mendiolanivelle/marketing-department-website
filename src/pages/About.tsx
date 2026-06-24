import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div>
      {/* Hero Section with Photo Background */}
      <section
        className="relative h-[800px] flex items-center justify-center px-4 sm:px-6 text-center overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(rgba(27,26,28,0.6), rgba(27,26,28,0.5)), url("https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl text-white mb-4 sm:mb-6 tracking-tight" style={{ fontWeight: 700 }}>
            About Our Department
          </h1>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto" style={{ fontWeight: 300 }}>
            Learn about the Marketing department's mission, structure, and how we support the organization
          </p>
        </div>
      </section>

      {/* Who We Are + Photo */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div>
            <h2 className="text-2xl sm:text-4xl mb-5 sm:mb-6" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Who We Are</h2>
            <p className="mb-4 text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              The Marketing Department is the internal team responsible for building and protecting the company brand, driving demand generation, and supporting all go-to-market initiatives across the organization.
            </p>
            <p className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
              We partner with Sales, Product, Customer Success, and Leadership to develop strategies that align with company objectives and deliver measurable results.
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg" style={{ height: '400px' }}>
            <img
              src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80"
              alt="Marketing Team"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Department Structure */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-4xl text-center mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Department Structure</h2>
          <p className="text-center text-base sm:text-lg mb-10 sm:mb-14 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            Our department is organized into specialized teams that work together to deliver comprehensive marketing solutions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#127912;', title: 'Brand & Creative', desc: 'Visual identity, design systems, brand guidelines, and creative asset production.' },
              { icon: '&#128200;', title: 'Digital & Growth', desc: 'SEO, paid media, email marketing, marketing automation, and performance optimization.' },
              { icon: '&#128221;', title: 'Content & Comms', desc: 'Blog, social media, internal communications, PR, and content strategy.' },
              { icon: '&#128202;', title: 'Analytics & Ops', desc: 'Marketing analytics, reporting, budget management, and tool administration.' },
            ].map((team, i) => (
              <div
                key={i}
                className="p-6 sm:p-8 rounded-2xl border transition-all hover:shadow-lg"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
              >
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: team.icon }}></div>
                <h3 className="text-base sm:text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{team.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{team.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-4xl text-center mb-4" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Our Values</h2>
          <p className="text-center text-base sm:text-lg mb-10 sm:mb-14 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>
            The principles that guide how we work and make decisions every day
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#128161;', title: 'Innovation', desc: 'We experiment with new channels, tools, and approaches to stay ahead of market trends.' },
              { icon: '&#129309;', title: 'Collaboration', desc: 'We work cross-functionally and believe the best results come from diverse perspectives.' },
              { icon: '&#127919;', title: 'Impact', desc: 'Every initiative we undertake is tied to measurable business outcomes and company goals.' },
              { icon: '&#128172;', title: 'Transparency', desc: 'We share our plans, results, and learnings openly with the entire organization.' },
            ].map((value, i) => (
              <div
                key={i}
                className="p-6 sm:p-8 rounded-2xl border transition-all hover:shadow-lg text-center"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
              >
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: value.icon }}></div>
                <h3 className="text-base sm:text-lg mb-2" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Working Hours */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--accent)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* CTA */}
          <div>
            <h2 className="text-2xl sm:text-4xl text-white mb-4 sm:mb-5" style={{ fontWeight: 700 }}>
              Ready to work with us?
            </h2>
            <p className="text-white/80 text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed" style={{ fontWeight: 300 }}>
              Have a campaign idea or need marketing support? Contact us today and let's build something great together.
            </p>
            <Link
              to="/contact"
              className="inline-block px-8 py-3.5 rounded-xl text-white border-2 border-white hover:bg-white transition font-medium"
              style={{ fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FF5900')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#FFFFFF')}
            >
              Get in Touch
            </Link>
          </div>

          {/* Working Hours */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-10 border border-white/20">
            <h3 className="text-xl sm:text-2xl text-white mb-5 sm:mb-6" style={{ fontWeight: 700 }}>Working Hours</h3>
            <div className="space-y-3">
              {[
                { day: 'Monday', hours: '9:00 AM – 6:00 PM' },
                { day: 'Tuesday', hours: '9:00 AM – 6:00 PM' },
                { day: 'Wednesday', hours: '9:00 AM – 6:00 PM' },
                { day: 'Thursday', hours: '9:00 AM – 6:00 PM' },
                { day: 'Friday', hours: '9:00 AM – 6:00 PM' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                  <span className="text-white text-sm sm:text-base" style={{ fontWeight: 500 }}>{item.day}</span>
                  <span className="text-white/80 text-sm sm:text-base" style={{ fontWeight: 300 }}>{item.hours}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 pt-3 mt-3 border-t border-white/20">
                <span className="text-white text-sm sm:text-base" style={{ fontWeight: 500 }}>Saturday – Sunday</span>
                <span className="text-white/60 text-sm" style={{ fontWeight: 300 }}>Closed</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}