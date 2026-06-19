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
      <section className="pt-28 pb-16 px-6 text-center bg-gradient-to-b from-indigo-50 to-white">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">Our Team</h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">Meet the Marketing department team members</p>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {teamMembers.map((member, index) => (
            <div key={index} className="bg-white p-9 rounded-2xl border border-gray-200 text-center hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-5">
                <span className="text-white text-xl font-bold">{member.initials}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{member.name}</h3>
              <span className="block text-indigo-600 text-sm font-semibold mb-3">{member.role}</span>
              <p className="text-gray-500 text-sm leading-relaxed">{member.bio}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-50 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Open Roles</h2>
          <p className="text-gray-500 text-lg mb-8">
            We're currently hiring for the following positions within the Marketing department. Reach out to Sarah Chen or HR for more details.
          </p>
          <div className="flex flex-col gap-3 max-w-lg mx-auto">
            {[
              { title: 'Marketing Coordinator', type: 'Full-time · Hybrid' },
              { title: 'Senior Content Strategist', type: 'Full-time · Remote' },
            ].map((role, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:shadow-md transition">
                <h4 className="font-semibold text-gray-900">{role.title}</h4>
                <span className="text-sm text-gray-500">{role.type}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
