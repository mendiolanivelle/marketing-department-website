export default function About() {
  return (
    <div>
      <section className="pt-20 pb-12 sm:pt-28 sm:pb-16 px-4 sm:px-6 text-center bg-white">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1B1A1C] mb-3 sm:mb-4 tracking-tight">About Our Department</h1>
        <p className="text-base sm:text-lg text-[#3E4048] max-w-2xl mx-auto">Learn about the Marketing department's mission, structure, and how we support the organization</p>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-16 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1B1A1C] mb-4 sm:mb-5">Who We Are</h2>
            <p className="text-[#3E4048] leading-relaxed mb-4 text-base sm:text-lg">
              The Marketing Department is the internal team responsible for building and protecting the company brand, driving demand generation, and supporting all go-to-market initiatives across the organization.
            </p>
            <p className="text-[#3E4048] leading-relaxed text-base sm:text-lg">
              We partner with Sales, Product, Customer Success, and Leadership to develop strategies that align with company objectives and deliver measurable results.
            </p>
          </div>
          <div className="bg-[rgba(202,205,215,0.15)] rounded-2xl p-8 sm:p-16 text-center border-2 border-dashed border-[#CACDD7]">
            <span className="text-5xl sm:text-6xl block mb-3">&#127970;</span>
            <p className="text-[#3E4048] font-medium">Marketing Department - Floor 4</p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-[rgba(202,205,215,0.15)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1B1A1C] text-center mb-8 sm:mb-12">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#128161;', title: 'Innovation', desc: 'We experiment with new channels, tools, and approaches to stay ahead of market trends.' },
              { icon: '&#129309;', title: 'Collaboration', desc: 'We work cross-functionally and believe the best results come from diverse perspectives.' },
              { icon: '&#127919;', title: 'Impact', desc: 'Every initiative we undertake is tied to measurable business outcomes and company goals.' },
              { icon: '&#128172;', title: 'Transparency', desc: 'We share our plans, results, and learnings openly with the entire organization.' },
            ].map((value, i) => (
              <div key={i} className="bg-white p-6 sm:p-8 rounded-2xl text-center border border-[#CACDD7] hover:-translate-y-1 hover:shadow-lg transition-all">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: value.icon }}></div>
                <h3 className="text-base sm:text-lg font-semibold text-[#1B1A1C] mb-2">{value.title}</h3>
                <p className="text-[#3E4048] text-sm leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          <div className="p-6 sm:p-10 rounded-2xl bg-[#1B1A1C] text-white">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Our Mission</h3>
            <p className="text-white/70 leading-relaxed text-base sm:text-lg">
              To drive growth and brand awareness through data-driven marketing strategies that support every team in the organization and deliver measurable business impact.
            </p>
          </div>
          <div className="p-6 sm:p-10 rounded-2xl bg-[#1B1A1C] text-white">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Our Vision</h3>
            <p className="text-white/70 leading-relaxed text-base sm:text-lg">
              To be recognized as a strategic partner within the company, setting the standard for marketing excellence and contributing directly to company-wide success.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-[rgba(202,205,215,0.15)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1B1A1C] text-center mb-8 sm:mb-12">Department Structure</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { title: 'Brand & Creative', desc: 'Visual identity, design systems, brand guidelines, and creative asset production.' },
              { title: 'Digital & Growth', desc: 'SEO, paid media, email marketing, marketing automation, and performance optimization.' },
              { title: 'Content & Communications', desc: 'Blog, social media, internal communications, PR, and content strategy.' },
              { title: 'Analytics & Operations', desc: 'Marketing analytics, reporting, budget management, and tool administration.' },
            ].map((team, i) => (
              <div key={i} className="bg-white p-6 sm:p-8 rounded-2xl border border-[#CACDD7] hover:-translate-y-1 hover:shadow-lg transition-all">
                <h3 className="text-base sm:text-lg font-semibold text-[#1B1A1C] mb-2">{team.title}</h3>
                <p className="text-[#3E4048] text-sm leading-relaxed">{team.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
