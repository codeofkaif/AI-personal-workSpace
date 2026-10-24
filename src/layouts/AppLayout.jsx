import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { tokenManager } from '../api/client'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  if (!tokenManager.get()) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6f8] text-gray-900 font-sans">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f5f6f8]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
