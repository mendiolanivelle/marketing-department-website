import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  department: z.string().min(1, 'Department is required'),
  requestType: z.string().min(1, 'Please select a request type'),
  priority: z.string().min(1, 'Please select a priority'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type ContactFormData = z.infer<typeof contactSchema>

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  })

  const onSubmit = async (_data: ContactFormData) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSubmitted(true)
    reset()
    setTimeout(() => setSubmitted(false), 5000)
  }

  return (
    <div>
      <section className="pt-20 pb-12 sm:pt-28 sm:pb-16 px-4 sm:px-6 text-center bg-white">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1B1A1C] mb-3 sm:mb-4 tracking-tight">Contact the Team</h1>
        <p className="text-base sm:text-lg text-[#3E4048] max-w-2xl mx-auto">Submit a request, ask a question, or get in touch with the Marketing department</p>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-16">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1B1A1C] mb-3 sm:mb-4">Reach Out</h2>
            <p className="text-[#3E4048] text-base sm:text-lg mb-6 sm:mb-10 leading-relaxed">
              Need marketing support? Have a question about brand guidelines? Want to discuss a campaign idea? Use the form or reach us through the channels below.
            </p>

            <div className="space-y-4 sm:space-y-6">
              {[
                { icon: '&#128231;', title: 'Email', info: 'marketing@company.com' },
                { icon: '&#128172;', title: 'Slack Channel', info: '#marketing-requests' },
                { icon: '&#128205;', title: 'Office Location', info: 'Floor 4, Room 412' },
                { icon: '&#128336;', title: 'Office Hours', info: 'Mon - Fri: 9:00 AM - 5:30 PM' },
                { icon: '&#128197;', title: 'Book a Meeting', info: 'calendly.com/company/marketing' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 sm:gap-4 items-start">
                  {i === 0 ? <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[rgba(202,205,215,0.2)] rounded-xl flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div> : i === 1 ? <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[rgba(202,205,215,0.2)] rounded-xl flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div> : i === 2 ? <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[rgba(202,205,215,0.2)] rounded-xl flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div> : i === 3 ? <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[rgba(202,205,215,0.2)] rounded-xl flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div> : <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[rgba(202,205,215,0.2)] rounded-xl flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
                  <div>
                    <h4 className="font-semibold text-[#1B1A1C] text-sm">{item.title}</h4>
                    <p className="text-[#3E4048] text-sm">{item.info}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 sm:p-10 rounded-2xl border-2 border-[#CACDD7] exodia-card">
            {submitted && (
              <div className="bg-[rgba(255,89,0,0.05)] border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
                Request submitted! We'll review it and get back to you within 1-2 business days.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-[#3E4048] mb-2">Your Name</label>
                <input
                  {...register('name')}
                  className="w-full px-4 py-3 border border-[#CACDD7] rounded-lg focus:ring-2 focus:ring-[#1B1A1C] focus:border-transparent outline-none transition"
                  placeholder="Jane Smith"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-semibold text-[#3E4048] mb-2">Your Department</label>
                <input
                  {...register('department')}
                  className="w-full px-4 py-3 border border-[#CACDD7] rounded-lg focus:ring-2 focus:ring-[#1B1A1C] focus:border-transparent outline-none transition"
                  placeholder="e.g. Sales, Product, Engineering"
                />
                {errors.department && <p className="mt-1 text-sm text-red-600">{errors.department.message}</p>}
              </div>

              <div>
                <label htmlFor="requestType" className="block text-sm font-semibold text-[#3E4048] mb-2">Request Type</label>
                <select
                  {...register('requestType')}
                  className="w-full px-4 py-3 border border-[#CACDD7] rounded-lg focus:ring-2 focus:ring-[#1B1A1C] focus:border-transparent outline-none transition appearance-none bg-white"
                >
                  <option value="">Select a request type</option>
                  <option value="campaign">Campaign Support</option>
                  <option value="content">Content / Copywriting</option>
                  <option value="brand">Brand Assets / Guidelines</option>
                  <option value="social">Social Media</option>
                  <option value="event">Event / Webinar</option>
                  <option value="analytics">Analytics / Reporting</option>
                  <option value="other">Other</option>
                </select>
                {errors.requestType && <p className="mt-1 text-sm text-red-600">{errors.requestType.message}</p>}
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-semibold text-[#3E4048] mb-2">Priority</label>
                <select
                  {...register('priority')}
                  className="w-full px-4 py-3 border border-[#CACDD7] rounded-lg focus:ring-2 focus:ring-[#1B1A1C] focus:border-transparent outline-none transition appearance-none bg-white"
                >
                  <option value="">Select priority</option>
                  <option value="low">Low - No rush</option>
                  <option value="medium">Medium - Within 2 weeks</option>
                  <option value="high">High - Within 1 week</option>
                  <option value="urgent">Urgent - ASAP</option>
                </select>
                {errors.priority && <p className="mt-1 text-sm text-red-600">{errors.priority.message}</p>}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-[#3E4048] mb-2">Details</label>
                <textarea
                  {...register('message')}
                  rows={5}
                  className="w-full px-4 py-3 border border-[#CACDD7] rounded-lg focus:ring-2 focus:ring-[#1B1A1C] focus:border-transparent outline-none transition resize-vertical"
                  placeholder="Describe your request, goals, timeline, and any relevant context..."
                ></textarea>
                {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#1B1A1C] hover:bg-[#1B1A1C] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#1B1A1C]/20"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
