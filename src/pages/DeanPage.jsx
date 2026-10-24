import { useState, useEffect } from 'react'
import {
  Building, Award, Users, FileText, Bell, Megaphone,
  Loader2, RefreshCw, ChevronRight, CheckCircle2, ShieldCheck, BarChart3, TrendingUp
} from 'lucide-react'
import { deanApi, noticesApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function DeanPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [notices, setNotices] = useState([])

  // Modal for Dean Notice
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    category: 'Academic',
    targetAudience: 'ALL',
    priority: 'HIGH',
  })
  const [savingNotice, setSavingNotice] = useState(false)

  useEffect(() => {
    loadDeanData()
  }, [])

  const loadDeanData = async () => {
    setLoading(true)
    try {
      const [overview, noticeList] = await Promise.all([
        deanApi.getOverview().catch(() => null),
        noticesApi.getAll().catch(() => []),
      ])
      if (overview) setData(overview)
      if (noticeList) setNotices(noticeList.filter((n) => n.publishedByRole === 'DEAN' || n.targetAudience === 'ALL'))
    } catch (err) {
      console.error('Failed to load Dean overview:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDirective = async (e) => {
    e.preventDefault()
    if (!noticeForm.title || !noticeForm.content) return
    setSavingNotice(true)
    try {
      await noticesApi.create(noticeForm)
      setNoticeForm({
        title: '',
        content: '',
        category: 'Academic',
        targetAudience: 'ALL',
        priority: 'HIGH',
      })
      setShowNoticeModal(false)
      loadDeanData()
    } catch (err) {
      alert('Failed to publish Dean directive: ' + err.message)
    } finally {
      setSavingNotice(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Dean Executive Header ── */}
      <div className="bg-gradient-to-r from-[#181d29] via-[#212738] to-[#161a25] p-6 rounded-2xl text-white shadow-md border border-[#2e374d] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Building size={22} />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                Dean of Academic Affairs Portal
                <span className="text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                  Executive Level
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Institute-wide governance, department benchmarking, and high-level academic policy notices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDeanData}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowNoticeModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Megaphone size={14} />
            <span>+ Issue Dean Directive</span>
          </button>
        </div>
      </div>

      {/* ── College-Wide Academic KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="app-card p-5 bg-white border-l-4 border-l-indigo-600">
          <span className="text-xs font-semibold text-gray-500">Total Enrolled Students</span>
          <div className="text-2xl font-black text-gray-900 mt-2">{data?.totalStudents ?? 0}</div>
          <p className="text-[11px] text-indigo-600 font-semibold mt-1">Across 4 Engineering Depts</p>
        </div>

        <div className="app-card p-5 bg-white border-l-4 border-l-emerald-500">
          <span className="text-xs font-semibold text-gray-500">Placement Strong Ratio</span>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {data?.placementStrong ?? 0} <span className="text-sm font-bold text-gray-400">/ {data?.totalStudents ?? 0}</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">High Readiness Candidates</p>
        </div>

        <div className="app-card p-5 bg-white border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-gray-500">Avg Placement Score</span>
          <div className="text-2xl font-black text-gray-900 mt-2">{data?.averagePlacementScore ?? 0}%</div>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">Based on resumes &amp; tasks</p>
        </div>

        <div className="app-card p-5 bg-white border-l-4 border-l-blue-500">
          <span className="text-xs font-semibold text-gray-500">Knowledge Vault</span>
          <div className="text-2xl font-black text-gray-900 mt-2">{data?.totalDocuments ?? 0} Docs</div>
          <p className="text-[11px] text-blue-600 font-semibold mt-1">Academic &amp; Research Assets</p>
        </div>
      </div>

      {/* ── Department Benchmarking & Comparative Analysis ── */}
      <div className="app-card bg-white p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-extrabold text-base text-gray-900">Department Academic &amp; Placement Comparison</h2>
            <p className="text-xs text-gray-500 mt-0.5">Benchmarking HOD departments for upcoming campus drives</p>
          </div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
            All Departments Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.departmentBreakdown &&
            Object.entries(data.departmentBreakdown).map(([deptName, dData]) => (
              <div key={deptName} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-gray-900 truncate max-w-[160px]">{deptName}</h3>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                    CGPA {dData.avgCgpa}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Students:</span>
                    <strong className="text-gray-800">{dData.totalStudents}</strong>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Placement Strong:</span>
                    <strong className="text-emerald-600">{dData.placementStrong}</strong>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((dData.placementStrong / Math.max(1, dData.totalStudents)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Official Dean Directives Issued ── */}
      <div className="app-card bg-white p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-extrabold text-base text-gray-900">Official Dean Academic Directives</h2>
            <p className="text-xs text-gray-500 mt-0.5">High-priority policies broadcasted across colleges</p>
          </div>
          <button onClick={() => setShowNoticeModal(true)} className="btn-amber text-xs py-2 px-3">
            <Megaphone size={13} /> + New Directive
          </button>
        </div>

        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase">
                  🏛️ DEAN DIRECTIVE · {n.category}
                </span>
                <span className="text-[10px] font-bold text-red-600 uppercase">{n.priority}</span>
              </div>
              <h3 className="font-bold text-sm text-gray-900">{n.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{n.content}</p>
              <p className="text-[11px] text-gray-400 pt-1">
                Issued by: <strong className="text-gray-700">{n.publishedByName}</strong> · Target: <strong className="text-gray-700">{n.targetAudience}</strong>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal: Issue Dean Directive ── */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Issue Dean Academic Directive</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">High-priority policy notification</p>
              </div>
              <button onClick={() => setShowNoticeModal(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDirective} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Directive Title</label>
                <input
                  type="text"
                  placeholder="e.g. Dean's Mandatory Guidelines for Autumn Semester"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Department</label>
                  <select
                    value={noticeForm.targetAudience}
                    onChange={(e) => setNoticeForm({ ...noticeForm, targetAudience: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white"
                  >
                    <option value="ALL">All Departments (College-Wide)</option>
                    <option value="Computer Science & Engineering">Computer Science &amp; Eng.</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics & Comm.">Electronics &amp; Comm.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={noticeForm.priority}
                    onChange={(e) => setNoticeForm({ ...noticeForm, priority: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white"
                  >
                    <option value="URGENT">URGENT</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Directive Content</label>
                <textarea
                  rows={4}
                  placeholder="Official instructions and policy details..."
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNoticeModal(false)} className="btn-white text-xs py-2 px-3">
                  Cancel
                </button>
                <button type="submit" disabled={savingNotice} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5">
                  {savingNotice ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                  <span>Broadcast Directive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
