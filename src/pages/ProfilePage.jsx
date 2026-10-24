import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit3, Check, ShieldCheck, Lock, Award, Loader2, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileApi } from '../api/client'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: user?.name || 'Kaif Khan',
    email: user?.email || 'kaif@test.com',
    college: user?.college || 'Babu Banarasi Das University',
    department: 'Computer Science & Engineering',
    rollNumber: 'CS2026-001',
    role: user?.role || 'STUDENT',
    cgpa: 8.5,
    placementScore: null,
    placementCategory: null,
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await profileApi.getMe()
      if (data) {
        setForm((prev) => ({
          ...prev,
          name: data.name || prev.name,
          email: data.email || prev.email,
          college: data.college || prev.college,
          department: data.department || prev.department,
          rollNumber: data.rollNumber || prev.rollNumber,
          role: data.role || prev.role,
          cgpa: data.cgpa || prev.cgpa,
          placementScore: data.placementScore,
          placementCategory: data.placementCategory,
        }))
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await profileApi.updateMe({
        name: form.name,
        department: form.department,
        rollNumber: form.rollNumber,
      })
      setEditing(false)
    } catch (err) {
      alert('Failed to save profile: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'name', label: 'Full Name', editable: true },
    { key: 'email', label: 'College Email', editable: false },
    { key: 'rollNumber', label: 'Roll Number', editable: true },
    { key: 'department', label: 'Department / Branch', editable: true },
    { key: 'college', label: 'College / Institute', editable: false },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 dark:text-white tracking-tight">Account &amp; Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Manage your credentials, view placement standing, and session security.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
            <ShieldCheck size={14} />
            <span>Profile Shield Active</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Log out of current session"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Security Privacy Notice */}
      <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-start gap-3">
        <Lock size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
          <strong>Privacy Enforced:</strong> Your profile is strictly isolated. Other students cannot search, inspect, or modify your personal records or study notes. Only your aggregated placement score is visible to the Placement Cell and HOD.
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="app-card bg-white dark:bg-[#1a1b22] dark:border-[#2a2b36] overflow-hidden shadow-sm">

        {/* Avatar + Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-100 dark:border-[#2a2b36] gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#151821] dark:bg-[#252836] text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-md">
              {form.name?.[0] || 'U'}
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">{form.name}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{form.email}</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (editing) handleSave()
              else setEditing(true)
            }}
            disabled={saving}
            className="btn-amber self-start sm:self-auto text-xs py-2 px-4 flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : editing ? <Check size={13} /> : <Edit3 size={13} />}
            <span>{editing ? 'Save Changes' : 'Edit Profile'}</span>
          </button>
        </div>

        {/* Placement Status (Student only) */}
        {form.placementScore !== null && form.placementScore !== undefined && (
          <div className="p-4 bg-gray-50/70 dark:bg-[#15161c] border-b border-gray-100 dark:border-[#2a2b36] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Placement Category Standing</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Calculated from verified resumes, completed tasks &amp; technical notes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                form.placementCategory === 'STRONG'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {form.placementCategory === 'STRONG' ? '🌟 Strong Category' : '⚡ Moderate'}
              </span>
              <span className="text-xs font-black text-gray-900 dark:text-white bg-white dark:bg-[#20212b] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
                {form.placementScore}%
              </span>
            </div>
          </div>
        )}

        {/* Fields */}
        <div className="divide-y divide-gray-50 dark:divide-[#252632]">
          {fields.map(({ key, label, editable }) => (
            <div key={key} className="py-4 px-6 grid grid-cols-3 gap-4 items-center">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
              <div className="col-span-2">
                {editing && editable ? (
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#121318] text-gray-900 dark:text-white rounded-xl p-2.5 outline-none focus:border-amber-500"
                  />
                ) : (
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-200">{form[key] || '—'}</span>
                )}
              </div>
            </div>
          ))}

          <div className="py-4 px-6 grid grid-cols-3 gap-4 items-center">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Security Role</span>
            <div className="col-span-2">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {form.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Session Logout Action Card */}
      <div className="app-card p-6 bg-white dark:bg-[#1a1b22] dark:border-[#2a2b36] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <LogOut size={16} className="text-red-500" />
            <span>Sign Out of AI Workspace</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            End your authenticated session on this browser. You can log back in at any time.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

    </div>
  )
}

