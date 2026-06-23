const teamMembers = [
  { name: 'Sarah Chen', role: 'VP of Marketing', bio: 'Leads department strategy and oversees all marketing operations. 15 years of B2B marketing experience.', initials: 'SC' },
  { name: 'Marcus Johnson', role: 'Creative Director', bio: 'Manages the brand and creative team. Ensures visual consistency across all company materials.', initials: 'MJ' },
  { name: 'Emily Rodriguez', role: 'Digital Marketing Manager', bio: 'Owns paid media, SEO, and marketing automation. Drives our demand generation engine.', initials: 'ER' },
  { name: 'David Kim', role: 'Content Lead', bio: 'Oversees blog, whitepapers, case studies, and sales enablement content across all channels.', initials: 'DK' },
  { name: 'Lisa Patel', role: 'Social Media & Comms', bio: 'Manages company social channels, employee advocacy, and internal communications.', initials: 'LP' },
  { name: 'James Wilson', role: 'Marketing Analytics', bio: 'Builds dashboards, tracks KPIs, and provides data-driven insights to the team and leadership.', initials: 'JW' },
  { name: 'Anna Kowalski', role: 'Event Coordinator', bio: 'Plans and executes company events, webinars, trade shows, and conference participation.', initials: 'AK' },
  { name: 'Ryan Thompson', role: 'Marketing Operations', bio: 'Manages marketing tech stack, CRM integrations, and process automation for the department.', initials: 'RT' }
]

export default function Team() {
  return (
    <div>
      <section className="pt-20 pb-12 sm:pt-28 sm:pb-16 px-4 sm:px-6 text-center bg-white">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1B1A1C] mb-3 sm:mb-4 tracking-tight">Our Team</h1>
        <p className="text-base sm:text-lg text-[#3E4048] max-w-2xl mx-auto">Meet the Marketing department team members</p>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {teamMembers.map((member, index) => (
            <div key={index} className="bg-white p-6 sm:p-9 rounded-2xl border border-[#CACDD7] text-center hover:border-[#CACDD7] hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#1B1A1C] flex items-center justify-center mx-auto mb-4 sm:mb-5">
                <span className="text-white text-lg sm:text-xl font-bold">{member.initials}</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#1B1A1C] mb-1">{member.name}</h3>
              <span className="block text-[#3E4048] text-xs sm:text-sm font-semibold mb-2 sm:mb-3">{member.role}</span>
              <p className="text-[#3E4048] text-sm leading-relaxed">{member.bio}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-[rgba(202,205,215,0.15)] text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1B1A1C] mb-3 sm:mb-4">Open Roles</h2>
          <p className="text-[#3E4048] text-base sm:text-lg mb-6 sm:mb-8">
            We're currently hiring for the following positions within the Marketing department. Reach out to Sarah Chen or HR for more details.
          </p>
          <div className="flex flex-col gap-3 max-w-lg mx-auto">
            {[
              { title: 'Marketing Coordinator', type: 'Full-time · Hybrid' },
              { title: 'Senior Content Strategist', type: 'Full-time · Remote' },
            ].map((role, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-white border border-[#CACDD7] rounded-xl hover:border-[#CACDD7] hover:shadow-md transition gap-2 sm:gap-0">
                <h4 className="font-semibold text-[#1B1A1C]">{role.title}</h4>
                <span className="text-sm text-[#3E4048]">{role.type}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
