import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bot, FileText, BookOpen, CheckSquare,
  Building2, Calendar, BookMarked, ShieldCheck, Settings, User,
  Building, GraduationCap, LogOut
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ open, onToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const role = (user?.role || 'STUDENT').toUpperCase()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Dynamic Navigation Items tailored by RBAC Role
  let navItems = []
  if (role === 'ADMIN' || role === 'COLLEGE_ADMIN') {
    navItems = [
      { to: '/app/admin', icon: ShieldCheck, label: 'Super Admin Portal' },
      { to: '/app/college-hub', icon: Building2, label: 'Campus Notices' },
      { to: '/app/documents', icon: FileText, label: 'College Knowledge' },
      { to: '/app/chat', icon: Bot, label: 'AI Assistant' },
    ]
  } else if (role === 'DEAN') {
    navItems = [
      { to: '/app/dean', icon: Building, label: 'Dean Academic Portal' },
      { to: '/app/college-hub', icon: Building2, label: 'Directives & Notices' },
      { to: '/app/documents', icon: FileText, label: 'College Documents' },
      { to: '/app/chat', icon: Bot, label: 'AI Assistant' },
    ]
  } else if (role === 'HOD') {
    navItems = [
      { to: '/app/hod', icon: GraduationCap, label: 'HOD Dept Portal' },
      { to: '/app/college-hub', icon: Building2, label: 'Dept Circulars' },
      { to: '/app/documents', icon: FileText, label: 'Department Vault' },
      { to: '/app/chat', icon: Bot, label: 'AI Assistant' },
    ]
  } else {
    // STUDENT
    navItems = [
      { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/app/chat', icon: Bot, label: 'Chat with AI' },
      { to: '/app/documents', icon: FileText, label: 'My Documents' },
      { to: '/app/notes', icon: BookOpen, label: 'Notes' },
      { to: '/app/tasks', icon: CheckSquare, label: 'Tasks' },
      { to: '/app/college-hub', icon: Building2, label: 'College Hub' },
      { to: '/app/calendar', icon: Calendar, label: 'Calendar' },
      { to: '/app/sources', icon: BookMarked, label: 'AI Sources' },
    ]
  }

  return (
    <aside
      style={{ width: open ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed)' }}
      className="flex flex-col h-full bg-[#151821] border-r border-[#1e2130] transition-all duration-200 ease-in-out shrink-0 z-30 select-none overflow-hidden"
    >
      {/* Brand Header */}
      <div
        onClick={() => navigate('/')}
        title="Go to Home / Landing Page"
        className={`flex items-center gap-3 border-b border-[#1e2130] h-16 shrink-0 cursor-pointer hover:bg-white/5 transition-colors ${open ? 'px-5' : 'px-0 justify-center'}`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-sm">
          <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-white w-[18px] h-[18px]">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        {open && (
          <span className="font-bold text-white text-[15px] tracking-tight whitespace-nowrap hover:text-amber-400 transition-colors">
            AI Workspace
          </span>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={!open ? label : undefined}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${!open ? 'justify-center !px-0' : ''}`
            }
          >
            <Icon size={17} className="shrink-0" />
            {open && <span className="text-[13px] truncate">{label}</span>}
          </NavLink>
        ))}

        {/* Divider */}
        <div className="my-2 border-t border-[#1e2130]" />

        <NavLink
          to="/app/settings"
          title={!open ? 'Settings' : undefined}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''} ${!open ? 'justify-center !px-0' : ''}`
          }
        >
          <Settings size={17} className="shrink-0" />
          {open && <span className="text-[13px] truncate">Settings</span>}
        </NavLink>

        <NavLink
          to="/app/profile"
          title={!open ? 'Profile' : undefined}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''} ${!open ? 'justify-center !px-0' : ''}`
          }
        >
          <User size={17} className="shrink-0" />
          {open && <span className="text-[13px] truncate">Profile</span>}
        </NavLink>
      </nav>

      {/* User Footer with Role Badge & Logout */}
      <div className="border-t border-[#1e2130] p-3 bg-[#10131c] shrink-0">
        <div className={`flex items-center gap-2.5 ${!open ? 'justify-center' : 'px-1'}`}>
          <div className="w-8 h-8 rounded-full bg-[#2a3248] border border-[#3a4560] flex items-center justify-center font-bold text-white text-xs shrink-0">
            {user?.name?.[0] || 'U'}
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white truncate leading-tight">
                {user?.name || 'User'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  role === 'ADMIN' || role === 'COLLEGE_ADMIN'
                    ? 'bg-amber-500/20 text-amber-400'
                    : role === 'DEAN'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : role === 'HOD'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {role}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
