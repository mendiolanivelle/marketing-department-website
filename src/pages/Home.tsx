import { Link } from 'react-router-dom'

const announcements = [
  { id: 1, title: 'Q3 Campaign Planning Kickoff', date: 'Jun 25, 2026', tag: 'Meeting' },
  { id: 2, title: 'New Brand Guidelines v2.0 Released', date: 'Jun 20, 2026', tag: 'Update' },
  { id: 3, title: 'Marketing Offsite - July 10-12', date: 'Jun 18, 2026', tag: 'Event' },
  { id: 4, title: 'Annual Review Submissions Due July 1', date: 'Jun 15, 2026', tag: 'Deadline' },
]

const quickLinks = [
  { label: 'Submit Campaign Request', icon: '&#128221;', href: '/contact' },
  { label: 'Brand Assets & Guidelines', icon: '&#128193;', href: '#' },
  { label: 'Campaign Calendar', icon: '&#128197;', href: '#' },
  { label: 'Performance Dashboard', icon: '&#128200;', href: '#' },
  { label: 'Content Templates', icon: '&#128196;', href: '#' },
  { label: 'Team Wiki', icon: '&#128218;', href: '#' },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <section className="pt-20 pb-12 px-4 sm:px-6 text-center bg-white sm:pt-32 sm:pb-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-4 sm:mb-6 tracking-tight">
            Welcome to the <span className="text-gray-500">Marketing Hub</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-600 mb-6 sm:mb-10 leading-relaxed">
            Your central portal for department resources, campaign requests, brand assets, and team updates.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/contact" className="px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition shadow-lg shadow-gray-900/20">
              Submit a Request
            </Link>
            <Link to="/services" className="px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-900 transition">
              Our Services
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12 sm:pb-20 -mt-6 sm:-mt-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-8 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 text-left">Lead Pipeline</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              <div className="p-3 sm:p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Total Leads</div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">247</div>
                <div className="text-xs text-gray-400 mt-1">Generated this quarter</div>
              </div>
              <div className="p-3 sm:p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Emails Sent</div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">189</div>
                <div className="text-xs text-gray-400 mt-1">76% of total leads</div>
              </div>
              <div className="p-3 sm:p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Replied</div>
                <div className="text-2xl sm:text-3xl font-bold text-green-600">64</div>
                <div className="text-xs text-gray-400 mt-1">34% response rate</div>
              </div>
              <div className="p-3 sm:p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-500 mb-1">No Reply</div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">125</div>
                <div className="text-xs text-gray-400 mt-1">Follow-up needed</div>
              </div>
              <div className="p-3 sm:p-5 bg-gray-50 rounded-xl border border-gray-200 col-span-2 sm:col-span-1">
                <div className="text-xs sm:text-sm text-gray-500 mb-1">Meetings Left</div>
                <div className="text-2xl sm:text-3xl font-bold text-orange-500">18</div>
                <div className="text-xs text-gray-400 mt-1">Target: 50 meetings</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-5 text-left">&#128227; Announcements</h2>
            <ul className="space-y-2 sm:space-y-3">
              {announcements.map((item) => (
                <li key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-2 sm:gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-orange-50 text-orange-500 px-2.5 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">
                      {item.tag}
                    </span>
                    <span className="text-gray-700 text-sm font-medium">{item.title}</span>
                  </div>
                  <span className="text-gray-400 text-xs whitespace-nowrap sm:text-right">{item.date}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-5 text-left">&#128279; Quick Links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quickLinks.map((link, i) => (
                <a key={i} href={link.href} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-100 hover:text-gray-900 transition">
                  <span className="text-lg" dangerouslySetInnerHTML={{ __html: link.icon }}></span>
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 text-center mb-2 sm:mb-3">Department Highlights</h2>
          <p className="text-center text-gray-500 text-base sm:text-lg mb-8 sm:mb-12">Key metrics and focus areas for this quarter</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '&#127919;', title: 'Active Campaigns', desc: '12 campaigns currently running across digital, print, and event channels.' },
              { icon: '&#127912;', title: 'Brand Refresh', desc: 'New brand guidelines v2.0 are live. Review the updated assets and templates.' },
              { icon: '&#128200;', title: 'Q2 Results', desc: 'Lead generation up 23% and engagement rate improved by 18% quarter-over-quarter.' },
              { icon: '&#129309;', title: 'Cross-Team Collab', desc: 'Working with Sales, Product, and Customer Success on the Q3 go-to-market plan.' },
            ].map((item, i) => (
              <div key={i} className="p-6 sm:p-8 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-xl hover:-translate-y-1 transition-all bg-white">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4" dangerouslySetInnerHTML={{ __html: item.icon }}></div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
