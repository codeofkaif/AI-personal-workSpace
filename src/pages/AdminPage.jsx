import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, Bell, BarChart3, Trash2, X, Loader2, CheckCircle,
  AlertCircle, RefreshCw, Users, Shield, Award, Activity, Search,
  Filter, Download, ChevronRight, UserCheck, ShieldCheck, Lock, Megaphone
} from 'lucide-react'
import { adminApi, noticesApi, documentsApi, activitiesApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString()
}

export default function AdminPage() {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [activeTab, setActiveTab] = useState('placement') // 'placement', 'activity', 'notices', 'users', 'docs', 'security'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data states
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDocuments: 0,
    totalTasks: 0,
    totalNotes: 0,
    totalNotices: 0,
    placementStrong: 0,
    placementModerate: 0,
    placementNeedsPrep: 0,
    averagePlacementScore: 0,
  })
  const [placementStudents, setPlacementStudents] = useState([])
  const [activities, setActivities] = useState([])
  const [notices, setNotices] = useState([])
  const [usersList, setUsersList] = useState([])
  const [collegeDocs, setCollegeDocs] = useState([])

  // Filters
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [catFilter, setCatFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    category: 'Placement',
    targetAudience: 'ALL',
    priority: 'HIGH',
  })
  const [noticeSaving, setNoticeSaving] = useState(false)

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [statsData, placementData, actData, noticesData, usersData, docsData] = await Promise.all([
        adminApi.getStats().catch(() => ({})),
        adminApi.getPlacementCategories('', '').catch(() => []),
        adminApi.getActivities(60).catch(() => []),
        noticesApi.getAll().catch(() => []),
        adminApi.getUsers().catch(() => []),
        documentsApi.getCollegeDocs().catch(() => []),
      ])

      if (statsData) setStats(statsData)
      if (placementData) setPlacementStudents(placementData)
      if (actData) setActivities(actData)
      if (noticesData) setNotices(noticesData)
      if (usersData) setUsersList(usersData)
      if (docsData) setCollegeDocs(docsData)
    } catch (err) {
      console.error('Error loading admin portal data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadAllData()
  }

  // Upload College Document
  const handleUploadCollegeDoc = async (e) => {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    setUploadStatus(null)
    try {
      await documentsApi.uploadCollege(selectedFile)
      setUploadStatus({ type: 'success', msg: `✅ "${selectedFile.name}" indexed for all students!` })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadAllData()
      setTimeout(() => {
        setShowUploadModal(false)
        setUploadStatus(null)
      }, 1800)
    } catch (err) {
      setUploadStatus({ type: 'error', msg: 'Upload failed: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  // Publish Notice
  const handleCreateNotice = async (e) => {
    e.preventDefault()
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) return
    setNoticeSaving(true)
    try {
      await noticesApi.create(noticeForm)
      setNoticeForm({
        title: '',
        content: '',
        category: 'Placement',
        targetAudience: 'ALL',
        priority: 'HIGH',
      })
      setShowNoticeModal(false)
      await loadAllData()
    } catch (err) {
      alert('Failed to publish notice: ' + err.message)
    } finally {
      setNoticeSaving(false)
    }
  }

  // Delete Notice
  const handleDeleteNotice = async (id) => {
    if (!window.confirm('Delete this notice?')) return
    try {
      await noticesApi.delete(id)
      setNotices((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // Change user role
  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminApi.updateUserRole(userId, newRole)
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
    } catch (err) {
      alert('Failed to update role: ' + err.message)
    }
  }

  // Filtered placement students
  const filteredPlacement = placementStudents.filter((s) => {
    const matchesDept = deptFilter === 'ALL' || (s.department && s.department.toLowerCase().includes(deptFilter.toLowerCase()))
    const matchesCat = catFilter === 'ALL' || s.category === catFilter
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase()) || (s.rollNumber && s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesDept && matchesCat && matchesSearch
  })

  // Export CSV
  const handleExportPlacementCSV = () => {
    const headers = ['Name', 'Email', 'Roll Number', 'Department', 'Placement Category', 'Readiness Score', 'Has Resume', 'Tasks Completed', 'Notes']
    const rows = filteredPlacement.map((s) => [
      `"${s.name}"`,
      `"${s.email}"`,
      `"${s.rollNumber || ''}"`,
      `"${s.department || ''}"`,
      `"${s.category}"`,
      s.readinessScore,
      s.hasResume ? 'YES' : 'NO',
      s.tasksCompletedCount,
      s.notesCount,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Placement_Roster_${deptFilter}_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Top Command Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#151922] via-[#1c2230] to-[#12161f] p-6 rounded-2xl text-white shadow-md border border-[#2a3245]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
              <Shield size={20} />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                College Super Admin &amp; Governance
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  RBAC Active
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Full authority over Students, HODs, Deans, Placement Category analysis, and Campus Audit trails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 transition-all"
            title="Refresh Real-time Data"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowNoticeModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-gray-950 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Megaphone size={14} />
            <span>+ Broadcast Notice</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-gray-900 hover:bg-gray-100 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Upload size={14} />
            <span>Upload College Doc</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="app-card p-4 bg-white border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Placement Strong</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Award size={15} /></span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{stats.placementStrong ?? 0}</div>
          <p className="text-[11px] font-semibold text-emerald-600 mt-1">Tier 1 Ready Candidates</p>
        </div>

        <div className="app-card p-4 bg-white border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Placement Moderate</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><BarChart3 size={15} /></span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{stats.placementModerate ?? 0}</div>
          <p className="text-[11px] font-semibold text-amber-600 mt-1">In Preparation Phase</p>
        </div>

        <div className="app-card p-4 bg-white border-l-4 border-l-red-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Needs Mentoring</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded-lg"><AlertCircle size={15} /></span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{stats.placementNeedsPrep ?? 0}</div>
          <p className="text-[11px] font-semibold text-red-500 mt-1">Missing Resume / Low Activity</p>
        </div>

        <div className="app-card p-4 bg-white border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Total Students</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Users size={15} /></span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{stats.totalStudents ?? 0}</div>
          <p className="text-[11px] font-semibold text-blue-600 mt-1">Avg Score: {stats.averagePlacementScore ?? 0}%</p>
        </div>

        <div className="app-card p-4 bg-white border-l-4 border-l-purple-500 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Audit Actions</span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Activity size={15} /></span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{activities.length}</div>
          <p className="text-[11px] font-semibold text-purple-600 mt-1">Live Activity Stream</p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'placement', label: '🎯 Placement Strong Engine', count: placementStudents.length },
          { id: 'activity',  label: '📊 Student Activity & Audit Stream', count: activities.length },
          { id: 'notices',   label: '📢 Notice Central (Dean/HOD/Admin)', count: notices.length },
          { id: 'users',     label: '👥 User & Role Management', count: usersList.length },
          { id: 'docs',      label: '📁 College Knowledge Base', count: collegeDocs.length },
          { id: 'security',  label: '🛡️ Role Isolation & Privacy Rules' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === t.id
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab 1: PLACEMENT STRONG ENGINE ── */}
      {activeTab === 'placement' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="app-card bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student name, email, roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold text-gray-500">Category:</span>
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="STRONG">🌟 Strong Placement</option>
                  <option value="MODERATE">⚡ Moderate</option>
                  <option value="NEEDS_PREPARATION">⚠️ Needs Prep</option>
                </select>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold text-gray-500">Dept:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white outline-none"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Computer">Computer Science &amp; Eng.</option>
                  <option value="Information">Information Technology</option>
                  <option value="Electronics">Electronics &amp; Comm.</option>
                  <option value="Mechanical">Mechanical</option>
                </select>
              </div>

              <button
                onClick={handleExportPlacementCSV}
                className="btn-white text-xs py-1.5 px-3 flex items-center gap-1 text-gray-700 font-bold"
                title="Download Placement CSV Roster"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Student Placement Roster Cards & Table */}
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <Loader2 size={24} className="animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-xs">Analyzing placement categories...</p>
            </div>
          ) : filteredPlacement.length === 0 ? (
            <div className="app-card bg-white p-12 text-center">
              <Award size={36} className="text-gray-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-gray-800">No students match filter</h3>
              <p className="text-xs text-gray-400 mt-1">Try resetting the department or category filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlacement.map((student) => {
                const isStrong = student.category === 'STRONG'
                const isModerate = student.category === 'MODERATE'
                const badgeColor = isStrong
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isModerate
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-600 border-red-200'

                return (
                  <div
                    key={student.id}
                    className={`app-card bg-white p-5 border transition-all hover:shadow-md ${
                      isStrong ? 'border-emerald-200' : 'border-gray-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 text-white font-extrabold flex items-center justify-center shrink-0">
                          {student.name?.[0] || 'S'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-gray-900 truncate">{student.name}</h3>
                          <p className="text-[11px] text-gray-400 truncate">{student.email}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase shrink-0 ${badgeColor}`}>
                        {isStrong ? '🌟 Strong' : isModerate ? '⚡ Moderate' : '⚠️ Needs Prep'}
                      </span>
                    </div>

                    {/* Score Bar */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-600">Placement Readiness</span>
                        <span className="font-black text-gray-900">{student.readinessScore}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isStrong ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.max(student.readinessScore, 5)}%` }}
                        />
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 bg-gray-50 rounded-xl text-center text-xs">
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Resume</p>
                        <p className="font-bold text-gray-800 mt-0.5">
                          {student.hasResume ? '✅ Yes' : '❌ Missing'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Tasks Done</p>
                        <p className="font-bold text-gray-800 mt-0.5">{student.tasksCompletedCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Notes</p>
                        <p className="font-bold text-gray-800 mt-0.5">{student.notesCount}</p>
                      </div>
                    </div>

                    {/* Department & Roll */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                      <span className="truncate">{student.department}</span>
                      <span className="font-mono font-semibold text-gray-700 shrink-0">{student.rollNumber}</span>
                    </div>

                    {/* Skills pills */}
                    {student.topSkills && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2.5 border-t border-gray-100">
                        {student.topSkills.map((sk) => (
                          <span key={sk} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 font-medium rounded-md">
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: STUDENT ACTIVITY & AUDIT STREAM ── */}
      {activeTab === 'activity' && (
        <div className="app-card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-extrabold text-base text-gray-900">Campus Activity Audit Stream</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Every student login, document upload, AI chat query, task completion, and notice event is securely recorded.
              </p>
            </div>
            <span className="text-xs font-semibold bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
              {activities.length} Events Captured
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">No activities captured yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activities.map((act) => {
                const actionBadge =
                  act.action === 'DOCUMENT_UPLOAD'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : act.action === 'AI_CHAT'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : act.action === 'TASK_COMPLETE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : act.action === 'NOTICE_PUBLISH'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'

                return (
                  <div key={act.id} className="py-3 px-2 flex items-center justify-between hover:bg-gray-50/60 rounded-xl transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-gray-100 text-gray-700 shrink-0">
                        <Activity size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900">{act.userName}</span>
                          <span className="text-[10px] text-gray-400 font-mono">({act.userRole})</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${actionBadge}`}>
                            {act.action}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 truncate max-w-xl">{act.details}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0 ml-4">
                      {formatDate(act.timestamp)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: NOTICE CENTRAL ── */}
      {activeTab === 'notices' && (
        <div className="app-card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-extrabold text-base text-gray-900">Campus Notice Central</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Hierarchical broadcast notices issued by College Admin, Deans, and Department HODs.
              </p>
            </div>
            <button onClick={() => setShowNoticeModal(true)} className="btn-amber text-xs py-2 px-3">
              <Megaphone size={13} /> + New Notice
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notices.map((n) => {
              const isDean = n.publishedByRole === 'DEAN'
              const isHod = n.publishedByRole === 'HOD'
              const roleBadge = isDean
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : isHod
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'

              return (
                <div key={n.id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50/40 hover:bg-white hover:shadow-sm transition-all space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${roleBadge}`}>
                      {isDean ? '🏛️ DEAN DIRECTIVE' : isHod ? '🏢 HOD CIRCULAR' : '🛡️ ADMIN NOTICE'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full uppercase">
                        {n.priority}
                      </span>
                      <button
                        onClick={() => handleDeleteNotice(n.id)}
                        className="p-1 text-gray-300 hover:text-red-600 transition-colors"
                        title="Delete Notice"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-gray-900 leading-snug">{n.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{n.content}</p>

                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-400">
                    <span>By: <strong className="text-gray-700">{n.publishedByName}</strong></span>
                    <span>Audience: <strong className="text-gray-700">{n.targetAudience}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab 4: USER & ROLE MANAGEMENT ── */}
      {activeTab === 'users' && (
        <div className="app-card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-extrabold text-base text-gray-900">User Role &amp; Permission Manager</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Assign and modify user roles (Student, HOD, Dean, Admin) with instant RBAC enforcement.
              </p>
            </div>
            <span className="text-xs font-bold text-gray-500">{usersList.length} Accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Role Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900">{u.name}</td>
                    <td className="py-3 px-4 text-gray-600">{u.email}</td>
                    <td className="py-3 px-4 text-gray-600">{u.department || 'General'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        u.role === 'COLLEGE_ADMIN' || u.role === 'ADMIN'
                          ? 'bg-amber-100 text-amber-800'
                          : u.role === 'DEAN'
                          ? 'bg-indigo-100 text-indigo-800'
                          : u.role === 'HOD'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold bg-white outline-none focus:border-amber-500"
                      >
                        <option value="STUDENT">STUDENT</option>
                        <option value="HOD">HOD (Head of Dept)</option>
                        <option value="DEAN">DEAN (Academic Dean)</option>
                        <option value="COLLEGE_ADMIN">COLLEGE_ADMIN</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 5: COLLEGE KNOWLEDGE BASE ── */}
      {activeTab === 'docs' && (
        <div className="app-card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-extrabold text-base text-gray-900">College Knowledge Base (RAG Indexed)</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Official documents available across all student AI Chat sessions.
              </p>
            </div>
            <button onClick={() => setShowUploadModal(true)} className="btn-amber text-xs py-2 px-3">
              <Upload size={13} /> + Upload Doc
            </button>
          </div>

          {collegeDocs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">No college documents uploaded yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {collegeDocs.map((doc) => (
                <div key={doc.id} className="py-3 px-2 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-red-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-gray-800">{doc.title || doc.fileName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatSize(doc.fileSize)} · Indexed in RAG</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 6: ROLE ISOLATION & PRIVACY RULES ── */}
      {activeTab === 'security' && (
        <div className="app-card bg-white p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-gray-900">Role-Based Security &amp; Isolation Architecture</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Strict boundaries prevent cross-role data leaks and protect student personal profiles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Student Profile Shield
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Students can <strong>only view and edit their own profile</strong>. Attempting to query another student's profile via direct API call triggers an enforced <code>403 FORBIDDEN</code> exception.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Department Isolation (HOD)
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                HOD dashboards only display students and performance metrics corresponding to their assigned department. HODs cannot publish cross-college directives without Dean or Admin clearance.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Dean Executive Governance
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Deans have high-level academic visibility across departments, but cannot access raw student private personal notes, tasks, or credentials.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Backend Endpoint RBAC
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Spring Security <code>@EnableMethodSecurity</code> and route-level URL interceptors ensure token validation and role matching at the HTTP layer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Publish Notice ── */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Broadcast Campus Notice</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Issued under College Admin authority</p>
              </div>
              <button onClick={() => setShowNoticeModal(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notice Title</label>
                <input
                  type="text"
                  placeholder="e.g. Campus Placement Drive 2026-27 Announced"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={noticeForm.category}
                    onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white"
                  >
                    <option value="Placement">Placement</option>
                    <option value="Exam">Exam</option>
                    <option value="Academic">Academic</option>
                    <option value="Workshop">Workshop</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Audience</label>
                  <select
                    value={noticeForm.targetAudience}
                    onChange={(e) => setNoticeForm({ ...noticeForm, targetAudience: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white"
                  >
                    <option value="ALL">All College</option>
                    <option value="Computer Science & Engineering">CSE Only</option>
                    <option value="Information Technology">IT Only</option>
                    <option value="Electronics & Comm.">ECE Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Priority</label>
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notice Content</label>
                <textarea
                  rows={4}
                  placeholder="Type official notice details..."
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNoticeModal(false)} className="btn-white text-xs py-2 px-3">
                  Cancel
                </button>
                <button type="submit" disabled={noticeSaving} className="btn-amber text-xs py-2 px-4 flex items-center gap-1.5">
                  {noticeSaving ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                  <span>Broadcast Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Upload College Doc ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Upload College Document</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Will be indexed into RAG for all students</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadCollegeDoc} className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={20} className="text-amber-500" />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-gray-800 truncate max-w-[220px]">{selectedFile.name}</p>
                      <p className="text-[11px] text-gray-400">{formatSize(selectedFile.size)}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-xs text-gray-600 font-medium">Click to select college file</p>
                    <p className="text-[11px] text-gray-400 mt-1">PDF, DOCX, TXT — up to 50MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />

              {uploadStatus && (
                <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  uploadStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {uploadStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span>{uploadStatus.msg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-white text-xs py-2 px-3">
                  Cancel
                </button>
                <button type="submit" disabled={uploading || !selectedFile} className="btn-amber text-xs py-2 px-4 flex items-center gap-1.5">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : 'Upload & Distribute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
