import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, X } from 'lucide-react'

const scheduleByDate = {
  '2026-09-28': [
    { id: 1, time: '9:00 AM', title: 'DBMS Class', location: 'Room 003', category: 'class', color: 'border-l-blue-500 bg-blue-50/40' },
    { id: 2, time: '11:00 AM', title: 'Java Lab', location: 'Lab 1', category: 'lab', color: 'border-l-emerald-500 bg-emerald-50/40' },
    { id: 3, time: '2:00 PM', title: 'Project Discussion', location: 'Online', category: 'meeting', color: 'border-l-purple-500 bg-purple-50/40' },
    { id: 4, time: '5:00 PM', title: 'Complete Assignment', location: 'Personal', category: 'task', color: 'border-l-amber-500 bg-amber-50/40' },
  ],
}

export default function CalendarPage() {
  const [selectedDay, setSelectedDay] = useState(28)
  const [showModal, setShowModal] = useState(false)
  const [events, setEvents] = useState(scheduleByDate)

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  // September 2026 starts on Tuesday (offset = 2), 30 days
  const calendarCells = [
    null, null, 1, 2, 3, 4, 5,
    6, 7, 8, 9, 10, 11, 12,
    13, 14, 15, 16, 17, 18, 19,
    20, 21, 22, 23, 24, 25, 26,
    27, 28, 29, 30, null, null, null
  ]

  const currentEvents = events[`2026-09-${selectedDay}`] || []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header matching Screen 9 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Calendar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your classes, tasks and important dates.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-dark"
        >
          <Plus size={15} />
          <span>+ Add Event</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Calendar Grid */}
        <div className="lg:col-span-7 app-card p-6 bg-white">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-base text-gray-900">September 2026</h2>
            <div className="flex items-center gap-1">
              <button className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                <ChevronLeft size={16} />
              </button>
              <button className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center mb-2">
            {daysOfWeek.map((day) => (
              <span key={day} className="text-xs font-semibold text-gray-400 py-1">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid matching Screen 9 */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="h-9" />
              }
              const isSelected = day === selectedDay
              const hasEvents = day === 28 || day === 26 || day === 30

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(day)}
                  className={`h-9 w-9 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-medium transition-all relative ${
                    isSelected
                      ? 'bg-[#171d26] text-white shadow-xs'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{day}</span>
                  {hasEvents && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-amber-500 absolute bottom-1" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Column: Schedule matching Screen 9 */}
        <div className="lg:col-span-5 app-card p-6 bg-white flex flex-col">
          <div className="pb-3 mb-4 border-b border-gray-100">
            <h2 className="font-bold text-sm text-gray-900">
              {selectedDay === 28 ? 'Today - Sep 28, 2026' : `Schedule - Sep ${selectedDay}, 2026`}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{currentEvents.length} events scheduled</p>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {currentEvents.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                No events scheduled for this day.
              </div>
            ) : (
              currentEvents.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border border-gray-200 border-l-4 ${item.color} bg-white transition-all`}
                >
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span className="font-semibold text-gray-900 text-xs flex items-center gap-1">
                      <Clock size={11} className="text-gray-400" />
                      {item.time}
                    </span>
                    <span className="text-[10px] font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                      {item.location}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{item.title}</h3>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
