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
      <section className="pt-28 pb-16 px-6 text-center bg-white">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">Contact the Team</h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">Submit a request, ask a question, or get in touch with the Marketing department</p>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Reach Out</h2>
            <p className="text-gray-500 text-lg mb-10 leading-relaxed">
              Need marketing support? Have a question about brand guidelines? Want to discuss a campaign idea? Use the form or reach us through the channels below.
            </p>

            <div className="space-y-6">
              {[
                { icon: '&#128231;', title: 'Email', info: 'marketing@company.com' },
                { icon: '&#128172;', title: 'Slack Channel', info: '#marketing-requests' },
                { icon: '&#128205;', title: 'Office Location', info: 'Floor 4, Room 412' },
                { icon: '&#128336;', title: 'Office Hours', info: 'Mon - Fri: 9:00 AM - 5:30 PM' },
                { icon: '&#128197;', title: 'Book a Meeting', info: 'calendly.com/company/marketing' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" dangerouslySetInnerHTML={{ __html: item.icon }}></div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                    <p className="text-gray-500 text-sm">{item.info}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-10 rounded-2xl border border-gray-200">
            {submitted && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
                Request submitted! We'll review it and get back to you within 1-2 business days.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">Your Name</label>
                <input
                  {...register('name')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                  placeholder="Jane Smith"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-semibold text-gray-700 mb-2">Your Department</label>
                <input
                  {...register('department')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                  placeholder="e.g. Sales, Product, Engineering"
                />
                {errors.department && <p className="mt-1 text-sm text-red-600">{errors.department.message}</p>}
              </div>

              <div>
                <label htmlFor="requestType" className="block text-sm font-semibold text-gray-700 mb-2">Request Type</label>
                <select
                  {...register('requestType')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition appearance-none bg-white"
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
                <label htmlFor="priority" className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                <select
                  {...register('priority')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition appearance-none bg-white"
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
                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">Details</label>
                <textarea
                  {...register('message')}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition resize-vertical"
                  placeholder="Describe your request, goals, timeline, and any relevant context..."
                ></textarea>
                {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gray-900/20"
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
