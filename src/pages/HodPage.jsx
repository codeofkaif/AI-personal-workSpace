import { useState, useEffect } from 'react'
import {
  GraduationCap, Award, Users, FileText, Bell, Megaphone,
  Loader2, RefreshCw, CheckCircle2, AlertCircle, Search, Filter, Download
} from 'lucide-react'
import { hodApi, noticesApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function HodPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [notices, setNotices] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')

  // Modal for Department Notice
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    category: 'Workshop',
    targetAudience: user?.department || 'Computer Science & Engineering',
    priority: 'HIGH',
  })
  const [savingNotice, setSavingNotice] = useState(false)

  useEffect(() => {
    loadHodData()
  }, [])

  const loadHodData = async () => {
    setLoading(true)
    try {
      const [overview, noticeList] = await Promise.all([
        hodApi.getOverview().catch(() => null),
        noticesApi.getUserNotices().catch(() => []),
      ])
      if (overview) setData(overview)
      if (noticeList) setNotices(noticeList)
    } catch (err) {
      console.error('Failed to load HOD overview:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNotice = async (e) => {
    e.preventDefault()
    if (!noticeForm.title || !noticeForm.content) return
    setSavingNotice(true)
    try {
      await noticesApi.create({
        ...noticeForm,
        targetAudience: data?.department || 'Computer Science & Engineering',
      })
      setNoticeForm({
        title: '',
        content: '',
        category: 'Workshop',
        targetAudience: data?.department || 'Computer Science & Engineering',
        priority: 'HIGH',
      })
      setShowNoticeModal(false)
      loadHodData()
    } catch (err) {
      alert('Failed to publish notice: ' + err.message)
    } finally {
      setSavingNotice(false)
    }
  }

  const students = data?.students || []
  const filteredStudents = students.filter((s) => {
    const matchesCat = catFilter === 'ALL' || s.category === catFilter
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(search.toLowerCase()))
    return matchesCat && matchesSearch
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── HOD Department Header ── */}
      <div className="bg-gradient-to-r from-[#14231b] via-[#1b3025] to-[#122019] p-6 rounded-2xl text-white shadow-md border border-[#2b4436] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <GraduationCap size={22} />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                HOD Department Portal
                <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  {data?.department || 'Computer Science & Engineering'}
                </span>
              </h1>
              <p className="text-xs text-emerald-300/70 mt-0.5">
                Head of Department oversight for student placement readiness, departmental notices, and coursework.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadHodData}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowNoticeModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-gray-950 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Megaphone size={14} />
            <span>+ Department Circular</span>
          </button>
        </div>
      </div>

      {/* ── Department KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="app-card p-5 bg-white border-l-4 border-l-emerald-600">
          <span className="text-xs font-semibold text-gray-500">Department Students</span>
          <div className="text-2xl font-black text-gray-900 mt-2">{data?.totalStudents ?? 0}</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Enrolled in {data?.department || 'CSE'}</p>
        </div>

        <div className="app-card p-5 bg-white border-l-4 border-l-emerald-500">
          <span className="text-xs font-semibold text-gray-500">Placement Strong</span>
          <div className="text-2xl font-black text-emerald-600 mt-2">{data?.placementStrong ?? 0}</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Ready for Tier-1 Companies</p>
        </div>

        <div className="app-card p-5 bg-white border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-gray-500">Placement Moderate</span>
          <div className="text-2xl font-black text-amber-600 mt-2">{data?.placementModerate ?? 0}</div>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">Preparing &amp; Upskilling</p>
        </div>

        <div className="app-card p-5 bg-white border-l-4 border-l-red-400">
          <span className="text-xs font-semibold text-gray-500">Needs Mentoring</span>
          <div className="text-2xl font-black text-red-500 mt-2">{data?.placementNeedsPrep ?? 0}</div>
          <p className="text-[11px] text-red-500 font-semibold mt-1">Schedule Mentorship Session</p>
        </div>
      </div>

      {/* ── Department Student Roster & Placement Filter ── */}
      <div className="app-card bg-white p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-extrabold text-base text-gray-900">Department Placement Readiness Roster</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Isolated student records for {data?.department || 'your department'}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg outline-none"
              />
            </div>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none font-semibold"
            >
              <option value="ALL">All Categories</option>
              <option value="STRONG">🌟 Strong Placement</option>
              <option value="MODERATE">⚡ Moderate</option>
              <option value="NEEDS_PREPARATION">⚠️ Needs Prep</option>
            </select>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">No students found matching filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Roll Number</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Readiness Score</th>
                  <th className="py-3 px-3">Resume Status</th>
                  <th className="py-3 px-3">Tasks Completed</th>
                  <th className="py-3 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((s) => {
                  const isStrong = s.category === 'STRONG'
                  const isModerate = s.category === 'MODERATE'
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-bold text-gray-900">{s.name}</p>
                        <p className="text-[11px] text-gray-400">{s.email}</p>
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-700">{s.rollNumber}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isStrong
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isModerate
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          {isStrong ? '🌟 Strong' : isModerate ? '⚡ Moderate' : '⚠️ Needs Prep'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-extrabold text-gray-900">{s.readinessScore}%</td>
                      <td className="py-3 px-3 font-medium">
                        {s.hasResume ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                            <CheckCircle2 size={13} /> Verified
                          </span>
                        ) : (
                          <span className="text-red-500 flex items-center gap-1 font-semibold">
                            <AlertCircle size={13} /> Missing
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-700">{s.tasksCompletedCount}</td>
                      <td className="py-3 px-3 font-bold text-gray-700">{s.notesCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Department Circulars Section ── */}
      <div className="app-card bg-white p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-extrabold text-base text-gray-900">Department Circulars &amp; Notices</h2>
            <p className="text-xs text-gray-500 mt-0.5">Circulars issued directly to {data?.department || 'CSE'} students</p>
          </div>
          <button onClick={() => setShowNoticeModal(true)} className="btn-amber text-xs py-2 px-3">
            <Megaphone size={13} /> + New Circular
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notices.map((n) => (
            <div key={n.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                  🏢 HOD CIRCULAR · {n.category}
                </span>
                <span className="text-[10px] font-bold text-red-600">{n.priority}</span>
              </div>
              <h3 className="font-bold text-sm text-gray-900">{n.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{n.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal: Issue Department Circular ── */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Issue Department Circular</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Will be delivered to all {data?.department || 'CSE'} students</p>
              </div>
              <button onClick={() => setShowNoticeModal(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Circular Title</label>
                <input
                  type="text"
                  placeholder="e.g. Final Year Project Review Submission"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={noticeForm.category}
                    onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white"
                  >
                    <option value="Workshop">Workshop</option>
                    <option value="Exam">Exam / Internal</option>
                    <option value="Placement">Placement Guidance</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={noticeForm.priority}
                    onChange={(e) => setNoticeForm({ ...noticeForm, priority: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                    <option value="MEDIUM">MEDIUM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Circular Content</label>
                <textarea
                  rows={4}
                  placeholder="Type department instructions..."
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNoticeModal(false)} className="btn-white text-xs py-2 px-3">
                  Cancel
                </button>
                <button type="submit" disabled={savingNotice} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5">
                  {savingNotice ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                  <span>Publish to Department</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
