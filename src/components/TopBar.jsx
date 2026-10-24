import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import HealthChecker from './HealthChecker'

export default function TopBar({ onMenuToggle }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      navigate('/app/chat')
      setQuery('')
    }
  }

  return (
    <header className="h-16 flex items-center justify-between px-5 bg-white border-b border-[#e8eaed] shrink-0 z-20">

      {/* Left: Hamburger */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
          title="Toggle Navigation"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-[480px] mx-4">
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search documents, notes, or ask AI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[#f3f4f6] hover:bg-[#eceef1] focus:bg-white text-sm text-gray-800 placeholder-gray-400 rounded-full pl-10 pr-4 py-2 border border-transparent focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all"
          />
        </div>
      </div>

      {/* Right: HealthChecker + Bell + Avatar */}
      <div className="flex items-center gap-2.5">
        <HealthChecker />
        <button
          onClick={() => navigate('/app/college-hub')}
          className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors relative cursor-pointer"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="w-2 h-2 rounded-full bg-[#e07a3f] absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>

        <button
          onClick={() => navigate('/app/profile')}
          className="w-9 h-9 rounded-full bg-[#151821] text-white font-bold text-[13px] flex items-center justify-center hover:opacity-85 transition-opacity ring-2 ring-gray-100 cursor-pointer"
          title="View Profile"
        >
          {user?.name?.[0] || 'K'}
        </button>
      </div>
    </header>
  )
}
