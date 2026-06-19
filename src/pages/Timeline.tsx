import { useState } from 'react'

type LeadStatus = 'initial-meeting' | 'second-meeting' | 'third-meeting' | 'quotation' | 'start-of-project' | 'follow-up'

interface Lead {
  id: number
  company: string
  contact: string
  email: string
  value: string
  date: string
  status: LeadStatus
}

const columns: { key: LeadStatus; label: string; color: string }[] = [
  { key: 'initial-meeting', label: 'Initial Meeting', color: 'bg-blue-500' },
  { key: 'second-meeting', label: '2nd Meeting', color: 'bg-indigo-500' },
  { key: 'third-meeting', label: '3rd Meeting', color: 'bg-violet-500' },
  { key: 'quotation', label: 'Quotation', color: 'bg-amber-500' },
  { key: 'start-of-project', label: 'Start of Project', color: 'bg-green-500' },
  { key: 'follow-up', label: 'Follow Up', color: 'bg-gray-500' },
]

const initialLeads: Lead[] = [
  { id: 1, company: 'Acme Corp', contact: 'John Smith', email: 'john@acme.com', value: '$25,000', date: 'Jun 18', status: 'initial-meeting' },
  { id: 2, company: 'TechStart Inc', contact: 'Sarah Lee', email: 'sarah@techstart.io', value: '$12,500', date: 'Jun 17', status: 'initial-meeting' },
  { id: 3, company: 'Global Media', contact: 'Mike Chen', email: 'mike@globalmedia.com', value: '$45,000', date: 'Jun 15', status: 'second-meeting' },
  { id: 4, company: 'Brandify', contact: 'Emma Davis', email: 'emma@brandify.co', value: '$18,000', date: 'Jun 14', status: 'second-meeting' },
  { id: 5, company: 'NovaTech', contact: 'Alex Wong', email: 'alex@novatech.com', value: '$32,000', date: 'Jun 12', status: 'third-meeting' },
  { id: 6, company: 'Pinnacle Ltd', contact: 'Rachel Kim', email: 'rachel@pinnacle.com', value: '$55,000', date: 'Jun 10', status: 'quotation' },
  { id: 7, company: 'Vertex Solutions', contact: 'Tom Harris', email: 'tom@vertex.com', value: '$28,000', date: 'Jun 8', status: 'quotation' },
  { id: 8, company: 'Skyline Digital', contact: 'Lisa Park', email: 'lisa@skyline.io', value: '$40,000', date: 'Jun 5', status: 'start-of-project' },
  { id: 9, company: 'Orbit Media', contact: 'David Brown', email: 'david@orbit.com', value: '$15,000', date: 'Jun 3', status: 'follow-up' },
  { id: 10, company: 'Crest Industries', contact: 'Nina Patel', email: 'nina@crest.com', value: '$62,000', date: 'Jun 1', status: 'follow-up' },
  { id: 11, company: 'Apex Games', contact: 'Ryan Cruz', email: 'ryan@apexgames.com', value: '$35,000', date: 'May 28', status: 'initial-meeting' },
  { id: 12, company: 'Lunar Studios', contact: 'Kate Kim', email: 'kate@lunar.co', value: '$22,000', date: 'May 25', status: 'third-meeting' },
]

export default function Timeline() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [draggedLead, setDraggedLead] = useState<number | null>(null)
  const [moveLeadId, setMoveLeadId] = useState<number | null>(null)

  const handleDragStart = (leadId: number) => {
    setDraggedLead(leadId)
  }

  const handleDrop = (status: LeadStatus) => {
    if (draggedLead === null) return
    setLeads(prev =>
      prev.map(lead =>
        lead.id === draggedLead ? { ...lead, status } : lead
      )
    )
    setDraggedLead(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleMoveLead = (leadId: number, status: LeadStatus) => {
    setLeads(prev =>
      prev.map(lead =>
        lead.id === leadId ? { ...lead, status } : lead
      )
    )
    setMoveLeadId(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Lead Pipeline</h1>
        <p className="text-sm sm:text-base text-gray-500">Drag and drop on desktop, or tap the arrow icon on mobile to move leads</p>
      </div>

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
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
