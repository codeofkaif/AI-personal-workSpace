import { useState, useEffect } from 'react'
import {
  User, Lock, Shield, Bell, Moon, Sun, Monitor,
  Database, Check, Palette, Globe, Save, RefreshCw, Download, Trash2, CheckCircle2
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

const sections = [
  { id: 'General', icon: Globe },
  { id: 'Appearance', icon: Palette },
  { id: 'Account', icon: User },
  { id: 'Security', icon: Lock },
  { id: 'Privacy', icon: Shield },
  { id: 'Notifications', icon: Bell },
  { id: 'Data & Storage', icon: Database },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('General')
  const [savedMsg, setSavedMsg] = useState('')

  // Persistent settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('workspace_settings')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      language: 'English (US)',
      timezone: 'Asia/Kolkata (IST)',
      autoRefreshInterval: '5 minutes',
      emailNotif: true,
      noticeAlerts: true,
      taskDeadlines: true,
      soundAlerts: false,
      aiSources: true,
      autoSave: true,
      compactDensity: false,
      accentColor: 'amber',
      strictIsolation: true,
      telemetry: false,
      twoFactorAuth: false,
    }
  })

  useEffect(() => {
    localStorage.setItem('workspace_settings', JSON.stringify(settings))
  }, [settings])

  const notifySave = (msg = 'Settings saved') => {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value }
      return updated
    })
    notifySave()
  }

  const handleExportData = () => {
    const exportObj = {
      user: user?.name,
      email: user?.email,
      exportedAt: new Date().toISOString(),
      settings,
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-workspace-settings-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    notifySave('Workspace config exported')
  }

  const handleClearCache = () => {
    if (confirm('Clear local app cache? (This will not delete your saved database notes)')) {
      sessionStorage.clear()
      notifySave('Local cache cleared')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Manage preferences, appearance, security, and storage.</p>
        </div>
        {savedMsg && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 size={13} />
            <span>{savedMsg}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        {/* Left Sub-nav */}
        <div className="md:col-span-4 app-card p-3 bg-white dark:bg-[#181920] dark:border-[#272834] space-y-1">
          {sections.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                activeSection === id
                  ? 'bg-[#1b1c24] text-white dark:bg-[#282a36] shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21222c]'
              }`}
            >
              <Icon size={15} className={activeSection === id ? 'text-amber-400' : 'text-gray-400'} />
              <span>{id}</span>
            </button>
          ))}
        </div>

        {/* Right Settings Panel */}
        <div className="md:col-span-8 app-card p-6 bg-white dark:bg-[#181920] dark:border-[#272834] space-y-6">

          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#272834]">
            <h2 className="font-bold text-sm text-gray-900 dark:text-white">
              {activeSection} Preferences
            </h2>
            <span className="text-[11px] text-gray-400">Auto-saved to storage</span>
          </div>

          {/* ══════════ APPEARANCE ══════════ */}
          {(activeSection === 'Appearance' || activeSection === 'General') && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Theme Mode</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { name: 'dark', label: 'Dark (Equa)', icon: Moon },
                    { name: 'light', label: 'Light', icon: Sun },
                    { name: 'system', label: 'System', icon: Monitor },
                  ].map(({ name, label, icon: Icon }) => {
                    const isSelected = theme === name
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          setTheme(name)
                          notifySave(`Theme changed to ${label}`)
                        }}
                        className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#14151b] text-white border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                            : 'bg-gray-50 dark:bg-[#20212b] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#2f303e] hover:bg-gray-100'
                        }`}
                      >
                        <Icon size={18} className={isSelected ? 'text-amber-400' : 'text-gray-500'} />
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {activeSection === 'Appearance' && (
                <>
                  <div className="pt-2 border-t border-gray-100 dark:border-[#272834]">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Accent Highlight</label>
                    <div className="flex items-center gap-3">
                      {[
                        { id: 'amber', color: 'bg-amber-500' },
                        { id: 'purple', color: 'bg-indigo-500' },
                        { id: 'emerald', color: 'bg-emerald-500' },
                        { id: 'rose', color: 'bg-rose-500' },
                      ].map(({ id, color }) => (
                        <button
                          key={id}
                          onClick={() => updateSetting('accentColor', id)}
                          className={`w-7 h-7 rounded-full ${color} flex items-center justify-center transition-all ${
                            settings.accentColor === id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#181920] scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          {settings.accentColor === id && <Check size={14} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Compact Density</p>
                      <p className="text-[11px] text-gray-400">Reduce spacing for high resolution screens</p>
                    </div>
                    <button
                      onClick={() => updateSetting('compactDensity', !settings.compactDensity)}
                      className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                        settings.compactDensity ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════ GENERAL ══════════ */}
          {activeSection === 'General' && (
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-[#272834]">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSetting('language', e.target.value)}
                  className="w-full max-w-xs text-xs border border-gray-300 dark:border-gray-600 rounded-xl p-2.5 bg-white dark:bg-[#20212b] text-gray-800 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="English (US)">English (US)</option>
                  <option value="English (UK)">English (UK)</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">System Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => updateSetting('timezone', e.target.value)}
                  className="w-full max-w-xs text-xs border border-gray-300 dark:border-gray-600 rounded-xl p-2.5 bg-white dark:bg-[#20212b] text-gray-800 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST - UTC+5:30)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York (EST)">America/New_York (EST)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Health Check Interval</label>
                <select
                  value={settings.autoRefreshInterval}
                  onChange={(e) => updateSetting('autoRefreshInterval', e.target.value)}
                  className="w-full max-w-xs text-xs border border-gray-300 dark:border-gray-600 rounded-xl p-2.5 bg-white dark:bg-[#20212b] text-gray-800 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="5 minutes">5 minutes (Optimized)</option>
                  <option value="10 minutes">10 minutes</option>
                  <option value="15 minutes">15 minutes</option>
                </select>
              </div>
            </div>
          )}

          {/* ══════════ NOTIFICATIONS ══════════ */}
          {activeSection === 'Notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Email Notifications</p>
                  <p className="text-[11px] text-gray-400">Receive summaries of new college announcements</p>
                </div>
                <button
                  onClick={() => updateSetting('emailNotif', !settings.emailNotif)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                    settings.emailNotif ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Dean &amp; HOD Directives</p>
                  <p className="text-[11px] text-gray-400">Instant in-app alerts for urgent campus circulars</p>
                </div>
                <button
                  onClick={() => updateSetting('noticeAlerts', !settings.noticeAlerts)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                    settings.noticeAlerts ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Task Deadline Reminders</p>
                  <p className="text-[11px] text-gray-400">Notify 24 hours before assignment due dates</p>
                </div>
                <button
                  onClick={() => updateSetting('taskDeadlines', !settings.taskDeadlines)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                    settings.taskDeadlines ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>
            </div>
          )}

          {/* ══════════ PRIVACY & SECURITY ══════════ */}
          {(activeSection === 'Privacy' || activeSection === 'Security') && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <Shield size={16} className="shrink-0" />
                <span>Student data isolation is active. Other users cannot access your private knowledge.</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Strict Profile Isolation</p>
                  <p className="text-[11px] text-gray-400">Block public queries from indexing your notes</p>
                </div>
                <button
                  onClick={() => updateSetting('strictIsolation', !settings.strictIsolation)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                    settings.strictIsolation ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Two-Factor Authentication (2FA)</p>
                  <p className="text-[11px] text-gray-400">Require one-time email OTP during new sign-ins</p>
                </div>
                <button
                  onClick={() => updateSetting('twoFactorAuth', !settings.twoFactorAuth)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                    settings.twoFactorAuth ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>
            </div>
          )}

          {/* ══════════ ACCOUNT ══════════ */}
          {activeSection === 'Account' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#20212b] border border-gray-100 dark:border-[#2f303e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Account Name</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{user?.name || 'Kaif Khan'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Email Address</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{user?.email || 'kaif@test.com'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Security Clearance</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded uppercase bg-amber-500/20 text-amber-400">
                    {user?.role || 'STUDENT'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ DATA & STORAGE ══════════ */}
          {activeSection === 'Data & Storage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Auto-save Notes</p>
                  <p className="text-[11px] text-gray-400">Automatically save revisions while editing</p>
                </div>
                <button
                  onClick={() => updateSetting('autoSave', !settings.autoSave)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                    settings.autoSave ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">AI Response with Sources</p>
                  <p className="text-[11px] text-gray-400">Always embed source citations in tutor responses</p>
                </div>
                <button
                  onClick={() => updateSetting('aiSources', !settings.aiSources)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer ${
                    settings.aiSources ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-[#272834] flex flex-wrap gap-3">
                <button
                  onClick={handleExportData}
                  className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-[#20212b] hover:bg-gray-200 dark:hover:bg-[#282a36] text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>Export Settings JSON</span>
                </button>
                <button
                  onClick={handleClearCache}
                  className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Clear Cache</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
