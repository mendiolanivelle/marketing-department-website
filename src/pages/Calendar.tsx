import { useState, useMemo } from 'react'

interface CalendarEvent {
  id: number
  title: string
  date: string
  color: string
  time?: string
}

const sampleEvents: CalendarEvent[] = [
  { id: 1, title: 'Q3 Campaign Planning', date: '2026-06-25', color: '#ff5900', time: '10:00 AM' },
  { id: 2, title: 'Brand Review Meeting', date: '2026-06-25', color: '#1a73e8', time: '2:00 PM' },
  { id: 3, title: 'Content Deadline', date: '2026-06-22', color: '#e8710a', time: '5:00 PM' },
  { id: 4, title: 'Team Standup', date: '2026-06-23', color: '#0b8043', time: '9:00 AM' },
  { id: 5, title: 'Social Media Launch', date: '2026-06-23', color: '#8e24aa', time: '12:00 PM' },
  { id: 6, title: 'Design Sprint', date: '2026-06-18', color: '#1a73e8', time: 'All Day' },
  { id: 7, title: 'Client Presentation', date: '2026-06-18', color: '#ff5900', time: '3:00 PM' },
  { id: 8, title: 'Marketing Offsite', date: '2026-07-10', color: '#e8710a', time: 'All Day' },
  { id: 9, title: 'Marketing Offsite', date: '2026-07-11', color: '#e8710a', time: 'All Day' },
  { id: 10, title: 'Marketing Offsite', date: '2026-07-12', color: '#e8710a', time: 'All Day' },
  { id: 11, title: 'Review Submissions Due', date: '2026-07-01', color: '#d93025', time: '11:59 PM' },
  { id: 12, title: 'Weekly Sync', date: '2026-06-29', color: '#0b8043', time: '10:00 AM' },
  { id: 13, title: 'Photo Shoot', date: '2026-06-15', color: '#8e24aa', time: '9:00 AM' },
  { id: 14, title: 'Email Campaign Send', date: '2026-06-12', color: '#1a73e8', time: '8:00 AM' },
  { id: 15, title: 'Budget Review', date: '2026-06-08', color: '#d93025', time: '2:00 PM' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDateKey(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

export default function Calendar() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)

    const days: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
      })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
      })
    }

    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
      })
    }

    return days
  }, [currentYear, currentMonth])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    sampleEvents.forEach((event) => {
      if (!map[event.date]) map[event.date] = []
      map[event.date].push(event)
    })
    return map
  }, [])

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const goToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

  const isToday = (year: number, month: number, day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : []

  const rows = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    rows.push(calendarDays.slice(i, i + 7))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-b border-gray-200 gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {MONTHS[currentMonth]} {currentYear}
              </h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrevMonth}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              onClick={goToToday}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition self-start sm:self-auto"
            >
              Today
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {rows.map((week, weekIdx) =>
              week.map((dayInfo) => {
                const dateKey = formatDateKey(dayInfo.year, dayInfo.month, dayInfo.day)
                const dayEvents = eventsByDate[dateKey] || []
                const todayFlag = isToday(dayInfo.year, dayInfo.month, dayInfo.day)
                const isSelected = selectedDate === dateKey

                return (
                  <div
                    key={`${weekIdx}-${dayInfo.day}`}
                    onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
                    className={`
                      min-h-[80px] sm:min-h-[110px] border-b border-r border-gray-200 p-1 sm:p-1.5 cursor-pointer transition-colors
                      ${!dayInfo.isCurrentMonth ? 'bg-gray-50/70' : 'bg-white'}
                      ${isSelected ? 'bg-orange-50/50' : ''}
                      hover:bg-gray-50
                      ${weekIdx === 0 ? '' : ''}
                    `}
                  >
                    <div className="flex justify-center sm:justify-start mb-0.5">
                      <span
                        className={`
                          inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm rounded-full
                          ${todayFlag ? 'bg-[#ff5900] text-white font-bold' : ''}
                          ${!todayFlag && dayInfo.isCurrentMonth ? 'text-gray-900 font-medium' : ''}
                          ${!todayFlag && !dayInfo.isCurrentMonth ? 'text-gray-400' : ''}
                        `}
                      >
                        {dayInfo.day}
                      </span>
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate font-medium text-white"
                          style={{ backgroundColor: event.color }}
                        >
                          <span className="truncate">{event.title}</span>
                        </div>
                      ))}
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={`m-${event.id}`}
                          className="sm:hidden flex items-center justify-center w-5 h-5 rounded-full mx-auto"
                          style={{ backgroundColor: event.color }}
                          title={event.title}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="hidden sm:block text-xs text-gray-500 font-medium px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                      {dayEvents.length > 2 && (
                        <div className="sm:hidden text-xs text-gray-500 text-center font-medium">
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Selected date detail panel */}
        {selectedDate && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h2>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">No events scheduled for this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-500">{event.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
