import { useState, useEffect } from 'react'
import {
  Bell, BookOpen, Briefcase, Calendar, FileText, ChevronRight,
  Download, ExternalLink, Megaphone, Loader2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { noticesApi } from '../api/client'

const tabs = ['Notices', 'Syllabus', 'Exam Info', 'Placements', 'Internships', 'Calendar']

function formatDate(iso) {
  if (!iso) return 'Recent'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CollegeHubPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('Notices')
  const [expandedId, setExpandedId] = useState(null)
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotices()
  }, [])

  const loadNotices = async () => {
    setLoading(true)
    try {
      const data = await noticesApi.getUserNotices()
      setNotices(data || [])
    } catch {
      setNotices([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">College Hub</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Campus directives and verified notices from College Admin, Deans, and HODs.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-btn ${activeTab === tab ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content based on Active Tab */}
      {activeTab === 'Notices' && (
        <div className="app-card bg-white divide-y divide-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-amber-500" />
              <span className="text-xs">Loading campus notices...</span>
            </div>
          ) : notices.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">No active notices found.</div>
          ) : (
            notices.map((notice) => {
              const isDean = notice.publishedByRole === 'DEAN'
              const isHod = notice.publishedByRole === 'HOD'
              const isExpanded = expandedId === notice.id

              const roleBadge = isDean
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : isHod
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'

              return (
                <div
                  key={notice.id}
                  className="p-4 hover:bg-gray-50/70 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-gray-50 shrink-0 border border-gray-100">
                        <Megaphone size={16} className={isDean ? 'text-indigo-600' : isHod ? 'text-emerald-600' : 'text-amber-600'} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${roleBadge}`}>
                            {isDean ? '🏛️ DEAN DIRECTIVE' : isHod ? '🏢 HOD NOTICE' : '🛡️ ADMIN NOTICE'}
                          </span>
                          <span className="font-bold text-xs md:text-sm text-gray-800 truncate">
                            {notice.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {formatDate(notice.createdAt)} · By: {notice.publishedByName} · Target: {notice.targetAudience}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-400 shrink-0">
                      <span className="text-[10px] font-bold text-red-600 uppercase hidden sm:block">
                        {notice.priority}
                      </span>
                      <ChevronRight
                        size={15}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 leading-relaxed bg-gray-50/50 p-3 rounded-xl">
                      <p className="whitespace-pre-line">{notice.content}</p>
                      <div className="flex items-center gap-3 mt-3 text-[11px] text-amber-700 font-medium">
                        <span className="text-gray-400 font-normal">Official Verified Publication</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab !== 'Notices' && (
        <div className="app-card p-8 text-center bg-white">
          <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
          <h3 className="font-bold text-sm text-gray-800">{activeTab} for {user?.college || 'Babu Banarasi Das University'}</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Official academic resources and placement material verified for your registered semester.
          </p>
        </div>
      )}
    </div>
  )
}
