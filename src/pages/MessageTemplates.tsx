import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const templateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
})

type TemplateFormData = z.infer<typeof templateSchema>

interface MessageTemplate {
  id: string
  title: string
  category: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

const defaultCategories = [
  '1st Meeting - Accept',
  '1st Meeting - Decline',
  '2nd Meeting - Handoff to Sales',
  '2nd Meeting - Handoff to Operations',
  '3rd Meeting - Follow Up',
  'Quotation - Sent',
  'Quotation - Follow Up',
  'Project Start - Welcome',
  'General Follow Up',
]

const fallbackTemplates: MessageTemplate[] = [
  {
    id: '1',
    title: 'Accept Client - 1st Meeting',
    category: '1st Meeting - Accept',
    subject: 'Re: Meeting Request - {{company_name}}',
    body: `Hi {{contact_name}},\n\nThank you for reaching out to Exodia. We'd love to schedule an initial meeting to discuss your project requirements and how our team can help.\n\nAre you available for a call on {{proposed_date}}? Let us know what time works best for you.\n\nLooking forward to connecting.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '2',
    title: 'Decline Client - 1st Meeting',
    category: '1st Meeting - Decline',
    subject: 'Re: Meeting Request - {{company_name}}',
    body: `Hi {{contact_name}},\n\nThank you for your interest in Exodia Game Development. After reviewing your requirements, we regret to inform you that this project doesn't align with our current capacity and expertise.\n\nWe appreciate you considering us and wish you the best with your project.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '3',
    title: 'Handoff to Sales - 2nd Meeting',
    category: '2nd Meeting - Handoff to Sales',
    subject: 'Next Steps - {{company_name}} Project Discussion',
    body: `Hi {{contact_name}},\n\nGreat speaking with you about your project. Based on our discussion, I'd like to introduce you to {{sales_rep_name}} from our Sales team who will help take things forward.\n\nThey'll reach out shortly to discuss pricing, timelines, and next steps. Feel free to reply to this email if you have any immediate questions.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '4',
    title: 'Handoff to Operations - 2nd Meeting',
    category: '2nd Meeting - Handoff to Operations',
    subject: 'Project Onboarding - {{company_name}}',
    body: `Hi {{contact_name}},\n\nFollowing our second meeting, I'm handing you over to our Operations team to begin the onboarding process.\n\n{{ops_rep_name}} will be your main point of contact going forward. They'll set up the project workspace, share the development timeline, and schedule the kickoff meeting.\n\nLooking forward to working together.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
  {
    id: '5',
    title: 'Quotation Sent',
    category: 'Quotation - Sent',
    subject: 'Project Quotation - {{company_name}}',
    body: `Hi {{contact_name}},\n\nPlease find attached our quotation for the {{project_name}} project.\n\nThe proposal includes:\n- Scope of work\n- Timeline and milestones\n- Pricing breakdown\n\nPlease review and let us know if you have any questions. We're happy to hop on a call to walk through the details.\n\nBest regards,\n{{sender_name}}\nExodia Game Development`,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  },
]

export default function MessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>(fallbackTemplates)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  })

  const fetchTemplates = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) setTemplates(data)
    } catch (err) {
      console.error('Error fetching templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const onSubmit = async (data: TemplateFormData) => {
    if (!isSupabaseConfigured || !supabase) {
      if (editingId) {
        setTemplates(prev =>
          prev.map(t =>
            t.id === editingId
              ? { ...t, ...data, updated_at: new Date().toISOString().split('T')[0] }
              : t
          )
        )
      } else {
        const newTemplate: MessageTemplate = {
          id: Date.now().toString(),
          ...data,
          created_at: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString().split('T')[0],
        }
        setTemplates(prev => [newTemplate, ...prev])
      }
      reset()
      setShowForm(false)
      setEditingId(null)
      return
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('message_templates')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert([{ ...data }])
        if (error) throw error
      }
      await fetchTemplates()
      reset()
      setShowForm(false)
      setEditingId(null)
    } catch (err) {
      console.error('Error saving template:', err)
    }
  }

  const handleEdit = (template: MessageTemplate) => {
    reset({
      title: template.title,
      category: template.category,
      subject: template.subject,
      body: template.body,
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('message_templates')
          .delete()
          .eq('id', id)
        if (error) throw error
        await fetchTemplates()
      } catch (err) {
        console.error('Error deleting template:', err)
      }
    } else {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
    setDeleteConfirmId(null)
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const filteredTemplates = selectedCategory === 'All'
    ? templates
    : templates.filter(t => t.category === selectedCategory)

  const categories = ['All', ...defaultCategories]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Message Templates</h1>
          <p className="text-sm sm:text-base text-gray-500">Email templates for client communication and automation</p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false)
              setEditingId(null)
              reset()
            } else {
              setShowForm(true)
            }
          }}
          className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition text-sm whitespace-nowrap"
        >
          {showForm ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium">Supabase not configured</p>
          <p className="text-xs text-amber-600 mt-1">Templates are using local fallback data. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Coolify to enable database storage.</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? 'Edit Template' : 'New Template'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
                <input
                  {...register('title')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                  placeholder="e.g. Accept Client - 1st Meeting"
                />
                {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
                <select
                  {...register('category')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition appearance-none bg-white"
                >
                  <option value="">Select category</option>
                  {defaultCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject Line</label>
              <input
                {...register('subject')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                placeholder="e.g. Re: Meeting Request - {{company_name}}"
              />
              {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject.message}</p>}
              <p className="mt-1 text-xs text-gray-400">Use {'{{variable_name}}'} for dynamic placeholders</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Body</label>
              <textarea
                {...register('body')}
                rows={8}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition resize-vertical font-mono"
                placeholder="Write your email template here..."
              />
              {errors.body && <p className="mt-1 text-xs text-red-600">{errors.body.message}</p>}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg transition text-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editingId ? 'Update Template' : 'Save Template'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); reset() }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-2">No templates found</p>
          <p className="text-gray-400 text-sm">Create your first template to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 hover:border-gray-300 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-semibold mb-2">
                    {template.category}
                  </span>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{template.title}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleCopy(`Subject: ${template.subject}\n\n${template.body}`, template.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition"
                    title="Copy to clipboard"
                  >
                    {copiedId === template.id ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition"
                    title="Edit"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {deleteConfirmId === template.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition"
                        title="Confirm delete"
                      >
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(template.id)}
                      className="p-2 rounded-lg hover:bg-red-50 transition"
                      title="Delete"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1">Subject</p>
                <p className="text-sm text-gray-700 font-medium">{template.subject}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Body</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4 font-mono leading-relaxed">{template.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
