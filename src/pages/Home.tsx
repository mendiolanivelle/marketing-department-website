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
      <section className="pt-32 pb-20 px-6 text-center bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
            Welcome to the <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Marketing Hub</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 leading-relaxed">
            Your central portal for department resources, campaign requests, brand assets, and team updates.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/contact" className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-200">
              Submit a Request
            </Link>
            <Link to="/services" className="px-8 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-indigo-600 hover:text-indigo-600 transition">
              Our Services
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 -mt-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-5 text-left">&#128227; Announcements</h2>
            <ul className="space-y-3">
              {announcements.map((item) => (
                <li key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">
                      {item.tag}
                    </span>
                    <span className="text-gray-700 text-sm font-medium">{item.title}</span>
                  </div>
                  <span className="text-gray-400 text-xs whitespace-nowrap">{item.date}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-5 text-left">&#128279; Quick Links</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {quickLinks.map((link, i) => (
                <a key={i} href={link.href} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg text-gray-700 text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <span className="text-lg" dangerouslySetInnerHTML={{ __html: link.icon }}></span>
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-3">Department Highlights</h2>
          <p className="text-center text-gray-500 text-lg mb-12">Key metrics and focus areas for this quarter</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '&#127919;', title: 'Active Campaigns', desc: '12 campaigns currently running across digital, print, and event channels.' },
              { icon: '&#127912;', title: 'Brand Refresh', desc: 'New brand guidelines v2.0 are live. Review the updated assets and templates.' },
              { icon: '&#128200;', title: 'Q2 Results', desc: 'Lead generation up 23% and engagement rate improved by 18% quarter-over-quarter.' },
              { icon: '&#129309;', title: 'Cross-Team Collab', desc: 'Working with Sales, Product, and Customer Success on the Q3 go-to-market plan.' },
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-2xl border border-gray-200 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1 transition-all bg-white">
                <div className="text-4xl mb-4" dangerouslySetInnerHTML={{ __html: item.icon }}></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
