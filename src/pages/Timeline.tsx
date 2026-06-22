import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type LeadStatus = 'initial-meeting' | 'second-meeting' | 'third-meeting' | 'quotation' | 'start-of-project' | 'follow-up'

interface Lead {
  id: string
  company: string
  contact: string
  email: string
  value: string
  date: string
  status: LeadStatus
  created_at: string
  updated_at: string
}

const columns: { key: LeadStatus; label: string; color: string }[] = [
  { key: 'initial-meeting', label: 'Initial Meeting', color: 'bg-blue-500' },
  { key: 'second-meeting', label: '2nd Meeting', color: 'bg-indigo-500' },
  { key: 'third-meeting', label: '3rd Meeting', color: 'bg-violet-500' },
  { key: 'quotation', label: 'Quotation', color: 'bg-amber-500' },
  { key: 'start-of-project', label: 'Start of Project', color: 'bg-green-500' },
  { key: 'follow-up', label: 'Follow Up', color: 'bg-gray-500' },
]

export default function Timeline() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedLead, setDraggedLead] = useState<string | null>(null)
  const [moveLeadId, setMoveLeadId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [formData, setFormData] = useState({
    company: '',
    contact: '',
    email: '',
    value: '',
    date: '',
    status: 'initial-meeting' as LeadStatus,
  })

  const fetchLeads = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) setLeads(data)
    } catch (err) {
      console.error('Error fetching leads:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()

    if (!isSupabaseConfigured || !supabase) return

    const channel = supabase
      .channel('leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLeads])

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId)
  }

  const handleDrop = async (status: LeadStatus) => {
    if (draggedLead === null) return
    
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('leads')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', draggedLead)
        if (error) throw error
      } catch (err) {
        console.error('Error updating lead status:', err)
      }
    }
    setDraggedLead(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleMoveLead = async (leadId: string, status: LeadStatus) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('leads')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', leadId)
        if (error) throw error
      } catch (err) {
        console.error('Error updating lead status:', err)
      }
    }
    setMoveLeadId(null)
  }

  const handleAddLead = async () => {
    if (!formData.company || !formData.contact || !formData.email || !formData.value || !formData.date) {
      alert('Please fill in all fields')
      return
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('leads')
          .insert([{ ...formData }])
        if (error) throw error
        setShowAddForm(false)
        setFormData({
          company: '',
          contact: '',
          email: '',
          value: '',
          date: '',
          status: 'initial-meeting',
        })
      } catch (err) {
        console.error('Error adding lead:', err)
        alert('Failed to add lead')
      }
    }
  }

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead)
    setFormData({
      company: lead.company,
      contact: lead.contact,
      email: lead.email,
      value: lead.value,
      date: lead.date,
      status: lead.status,
    })
    setShowAddForm(true)
  }

  const handleUpdateLead = async () => {
    if (!editingLead) return

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('leads')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingLead.id)
        if (error) throw error
        setShowAddForm(false)
        setEditingLead(null)
        setFormData({
          company: '',
          contact: '',
          email: '',
          value: '',
          date: '',
          status: 'initial-meeting',
        })
      } catch (err) {
        console.error('Error updating lead:', err)
        alert('Failed to update lead')
      }
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('leads')
          .delete()
          .eq('id', leadId)
        if (error) throw error
      } catch (err) {
        console.error('Error deleting lead:', err)
        alert('Failed to delete lead')
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Lead Pipeline</h1>
          <p className="text-sm sm:text-base text-gray-500">Drag and drop on desktop, or tap the arrow icon on mobile to move leads</p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm)
            setEditingLead(null)
            setFormData({
              company: '',
              contact: '',
              email: '',
              value: '',
              date: '',
              status: 'initial-meeting',
            })
          }}
          className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition text-sm whitespace-nowrap"
        >
          {showAddForm ? 'Cancel' : '+ Add Lead'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingLead ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                placeholder="Contact name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                placeholder="Email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                placeholder="$0,000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="text"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                placeholder="e.g., Jun 18"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
              >
                {columns.map((col) => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={editingLead ? handleUpdateLead : handleAddLead}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg transition text-sm"
            >
              {editingLead ? 'Update Lead' : 'Add Lead'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingLead(null)
                setFormData({
                  company: '',
                  contact: '',
                  email: '',
                  value: '',
                  date: '',
                  status: 'initial-meeting',
                })
              }}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {columns.map((column) => {
            const columnLeads = leads.filter(lead => lead.status === column.key)
            return (
              <div
                key={column.key}
                className="min-w-[260px] sm:min-w-[280px] flex-1 bg-gray-100 rounded-2xl p-3 sm:p-4"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.key)}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${column.color}`}></div>
                    <h2 className="font-semibold text-gray-900 text-xs sm:text-sm">{column.label}</h2>
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full">
                    {columnLeads.length}
                  </span>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm mb-0.5 truncate">{lead.company}</h3>
                          <p className="text-xs text-gray-500 mb-2 sm:mb-3 truncate">{lead.contact}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">{lead.value}</span>
                            <span className="text-xs text-gray-400">{lead.date}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditLead(lead)
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                            title="Edit"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteLead(lead.id)
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition"
                            title="Delete"
                          >
                            <svg className="w-4 h-4 text-gray-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <div className="relative lg:hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setMoveLeadId(moveLeadId === lead.id ? null : lead.id)
                              }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                              </svg>
                            </button>
                            {moveLeadId === lead.id && (
                              <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-44">
                                <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">Move to</p>
                                {columns.filter(c => c.key !== lead.status).map((col) => (
                                  <button
                                    key={col.key}
                                    onClick={() => handleMoveLead(lead.id, col.key)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <div className={`w-2 h-2 rounded-full ${col.color}`}></div>
                                    {col.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
