import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  FileText, BookOpen, CheckSquare, MessageSquare, Check,
  Award, Bell, Sparkles, ArrowRight, ShieldCheck, TrendingUp
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileApi, noticesApi, tasksApi, notesApi, documentsApi } from '../api/client'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profileData, setProfileData] = useState(null)
  const [notices, setNotices] = useState([])
  const [counts, setCounts] = useState({ docs: 0, notes: 0, tasks: 0 })
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    loadStudentDashboard()
  }, [])

  const loadStudentDashboard = async () => {
    try {
      const [prof, userNotices, docList, noteList, taskList] = await Promise.all([
        profileApi.getMe().catch(() => null),
        noticesApi.getUserNotices().catch(() => []),
        documentsApi.getAll().catch(() => []),
        notesApi.getAll().catch(() => []),
        tasksApi.getAll().catch(() => []),
      ])

      if (prof) setProfileData(prof)
      if (userNotices) setNotices(userNotices.slice(0, 3))
      setCounts({
        docs: docList?.length || 0,
        notes: noteList?.length || 0,
        tasks: taskList?.length || 0,
      })
      if (taskList) setTasks(taskList.slice(0, 4))
    } catch (e) {
      console.error(e)
    }
  }

  const toggleTask = async (id) => {
    try {
      await tasksApi.markComplete(id)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } : t))
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } : t))
    }
  }

  const placementScore = profileData?.placementScore ?? 75
  const placementCategory = profileData?.placementCategory ?? 'STRONG'
  const isStrong = placementCategory === 'STRONG'
  const isModerate = placementCategory === 'MODERATE'

  const statCards = [
    { label: 'Documents', value: counts.docs, delta: 'Study files indexed', deltaColor: 'text-emerald-600', bg: 'bg-blue-50', iconColor: 'text-blue-600', Icon: FileText, route: '/app/documents' },
    { label: 'Notes', value: counts.notes, delta: 'Revision summaries', deltaColor: 'text-emerald-600', bg: 'bg-emerald-50', iconColor: 'text-emerald-600', Icon: BookOpen, route: '/app/notes' },
    { label: 'Tasks', value: counts.tasks, delta: 'Action items', deltaColor: 'text-amber-600', bg: 'bg-orange-50', iconColor: 'text-orange-500', Icon: CheckSquare, route: '/app/tasks' },
    { label: 'AI Tutor', value: '24/7', delta: 'Local Ollama ready', deltaColor: 'text-purple-600', bg: 'bg-purple-50', iconColor: 'text-purple-500', Icon: MessageSquare, route: '/app/chat' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">
            Good day, {user?.name?.split(' ')[0] || 'Student'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Your personal learning and placement preparation workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <ShieldCheck size={14} /> Profile Protected
          </span>
          <div className="text-xs font-semibold text-gray-500 bg-white px-3.5 py-1.5 rounded-xl border border-gray-200 shadow-sm">
            {profileData?.department || 'Computer Science'}
          </div>
        </div>
      </div>

      {/* ── Personal Placement Readiness Banner ── */}
      <div className="app-card bg-gradient-to-r from-[#171b26] to-[#1e2333] p-6 text-white border border-[#2b334a] shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                <Award size={18} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Personal Placement Readiness Status
              </span>
            </div>
            <h2 className="text-xl font-black">
              {isStrong ? '🌟 Placement Strong Category' : isModerate ? '⚡ Moderate Placement Category' : '⚠️ Preparation Phase'}
            </h2>
            <p className="text-xs text-gray-300 max-w-lg leading-relaxed">
              {isStrong
                ? 'Your resume is uploaded, coursework tasks are active, and technical summaries qualify you for upcoming Tier-1 campus placement drives!'
                : 'Upload your latest resume and complete pending technical tasks to elevate your profile into the Placement Strong category.'}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="text-center">
              <div className="text-3xl font-black text-amber-400">{placementScore}%</div>
              <p className="text-[10px] text-gray-300 font-semibold uppercase mt-0.5">Readiness Score</p>
            </div>
            <div className="w-[1px] h-10 bg-white/20" />
            <Link
              to="/app/documents"
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1 shadow-sm"
            >
              <span>Boost Score</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, delta, deltaColor, bg, iconColor, Icon, route }) => (
          <div
            key={label}
            onClick={() => navigate(route)}
            className="app-card app-card-hover p-4 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} ${iconColor} flex items-center justify-center shrink-0`}>
                <Icon size={19} />
              </div>
              <div>
                <div className="text-[26px] font-extrabold text-gray-900 leading-none">{value}</div>
                <div className="text-[12px] font-medium text-gray-500 mt-0.5">{label}</div>
              </div>
            </div>
            <div className={`mt-3 text-[11px] font-bold ${deltaColor}`}>{delta}</div>
          </div>
        ))}
      </div>

      {/* ── Recent Campus Notices from Dean & HOD & Tasks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Notices */}
        <div className="app-card p-5 space-y-3 bg-white">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber-600" />
              <h2 className="font-bold text-gray-900 text-sm">Directives &amp; Department Notices</h2>
            </div>
            <Link to="/app/college-hub" className="text-xs font-semibold text-[#e07a3f] hover:text-[#cc6c34]">
              View all
            </Link>
          </div>

          {notices.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No active notices.</p>
          ) : (
            <div className="space-y-2.5">
              {notices.map((n) => {
                const isDean = n.publishedByRole === 'DEAN'
                const isHod = n.publishedByRole === 'HOD'
                return (
                  <div key={n.id} className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        isDean ? 'bg-indigo-50 text-indigo-700' : isHod ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                      }`}>
                        {isDean ? '🏛️ DEAN DIRECTIVE' : isHod ? '🏢 HOD NOTICE' : '🛡️ ADMIN'}
                      </span>
                      <span className="text-[10px] font-bold text-red-600">{n.priority}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-900">{n.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{n.content}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Action Tasks */}
        <div className="app-card p-5 space-y-3 bg-white">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Action Items &amp; Tasks</h2>
            <Link to="/app/tasks" className="text-xs font-semibold text-[#e07a3f] hover:text-[#cc6c34]">
              View all
            </Link>
          </div>

          <div className="space-y-1.5">
            {tasks.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No pending tasks. Add one in Tasks page!</p>
            ) : (
              tasks.map((task) => {
                const done = task.status === 'COMPLETED'
                return (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          done ? 'bg-[#e07a3f] border-[#e07a3f]' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {done && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                      <span className={`text-xs font-medium truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0 ml-3">
                      {task.dueDate || 'Ongoing'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
