const services = [
  {
    icon: '&#127919;',
    title: 'Brand Guidelines & Assets',
    description: 'Access approved brand templates, logos, color palettes, typography, and usage guidelines for all internal and external materials.',
    features: ['Logo Files', 'Template Library', 'Style Guides', 'Presentation Templates']
  },
  {
    icon: '&#128187;',
    title: 'Campaign Support',
    description: 'Submit a request and our team will help plan, create, and execute marketing campaigns for your product launches or initiatives.',
    features: ['Campaign Planning', 'Asset Creation', 'Channel Strategy', 'Launch Support']
  },
  {
    icon: '&#128241;',
    title: 'Social Media',
    description: 'We manage all company social channels. Submit content requests or coordinate with us for team announcements and thought leadership.',
    features: ['Content Requests', 'LinkedIn Posts', 'Employee Advocacy', 'Crisis Comms']
  },
  {
    icon: '&#9997;',
    title: 'Content & Copywriting',
    description: 'Need blog posts, whitepapers, case studies, or sales collateral? Our content team creates compelling materials for every stage of the funnel.',
    features: ['Blog Posts', 'Case Studies', 'Sales Collateral', 'Whitepapers']
  },
  {
    icon: '&#128200;',
    title: 'Analytics & Reporting',
    description: 'Access marketing dashboards, request custom reports, or schedule a walkthrough of our performance data and KPIs.',
    features: ['Performance Dashboards', 'Custom Reports', 'KPI Tracking', 'Data Walkthroughs']
  },
  {
    icon: '&#127758;',
    title: 'Event & Webinar Support',
    description: 'Planning an internal event, webinar, or conference presence? We handle promotion, logistics, and post-event follow-up.',
    features: ['Event Promotion', 'Webinar Setup', 'Conference Planning', 'Post-Event Reports']
  }
]

export default function Services() {
  return (
    <div>
      <section className="pt-20 pb-12 sm:pt-28 sm:pb-16 px-4 sm:px-6 text-center bg-white">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1B1A1C] mb-3 sm:mb-4 tracking-tight">Department Services</h1>
        <p className="text-base sm:text-lg text-[#3E4048] max-w-2xl mx-auto">What the Marketing team can do for you and your team</p>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {services.map((service, index) => (
            <div key={index} className="bg-white p-6 sm:p-9 rounded-2xl border-2 border-[#CACDD7] exodia-card hover:border-[#CACDD7] hover:shadow-xl hover:-translate-y-1 transition-all">
              {i === 0 ? <svg className="w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> : i === 1 ? <svg className="w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> : i === 2 ? <svg className="w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> : i === 3 ? <svg className="w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> : i === 4 ? <svg className="w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> : <svg className="w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>}
              <h3 className="text-lg sm:text-xl font-bold text-[#1B1A1C] mb-2 sm:mb-3">{service.title}</h3>
              <p className="text-[#3E4048] text-sm leading-relaxed mb-4 sm:mb-5">{service.description}</p>
              <ul className="flex flex-wrap gap-2">
                {service.features.map((feature, i) => (
                  <li key={i} className="bg-[rgba(202,205,215,0.2)] text-[#3E4048] px-3 py-1 rounded-md text-xs font-semibold">
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-[rgba(202,205,215,0.15)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1B1A1C] text-center mb-2 sm:mb-3">How to Request Our Help</h2>
          <p className="text-center text-[#3E4048] text-base sm:text-lg mb-8 sm:mb-12">Our standard workflow for handling internal requests</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { num: '01', title: 'Submit a Request', desc: 'Fill out the contact form with details about your project, timeline, and goals.' },
              { num: '02', title: 'Intake Meeting', desc: "We'll schedule a brief call to align on scope, deliverables, and expectations." },
              { num: '03', title: 'Execution', desc: "Our team gets to work. You'll receive regular updates and review checkpoints." },
              { num: '04', title: 'Delivery & Review', desc: 'We deliver final assets and gather feedback to improve future collaborations.' },
            ].map((step, i) => (
              <div key={i} className="text-center p-6 sm:p-8">
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-300 mb-3 sm:mb-4">{step.num}</div>
                <h3 className="text-base sm:text-lg font-semibold text-[#1B1A1C] mb-2">{step.title}</h3>
                <p className="text-[#3E4048] text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
