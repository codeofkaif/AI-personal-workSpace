import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import AIChatPage from './pages/AIChatPage'
import DocumentsPage from './pages/DocumentsPage'
import NotesPage from './pages/NotesPage'
import TasksPage from './pages/TasksPage'
import CollegeHubPage from './pages/CollegeHubPage'
import CalendarPage from './pages/CalendarPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import DeanPage from './pages/DeanPage'
import HodPage from './pages/HodPage'
import SourcesPage from './pages/SourcesPage'
import RoleRoute from './components/RoleRoute'
import { AuthContext, useAuth } from './context/AuthContext'
import { tokenManager } from './api/client'

function RoleRedirect() {
  const { user } = useAuth()
  const role = (user?.role || 'STUDENT').toUpperCase()
  if (role === 'ADMIN' || role === 'COLLEGE_ADMIN') {
    return <Navigate to="/app/admin" replace />
  }
  if (role === 'DEAN') {
    return <Navigate to="/app/dean" replace />
  }
  if (role === 'HOD') {
    return <Navigate to="/app/hod" replace />
  }
  return <Navigate to="/app/dashboard" replace />
}

import { ThemeProvider } from './context/ThemeContext'

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const token = tokenManager.get()
      const saved = localStorage.getItem('user_profile')
      if (token && saved) {
        return JSON.parse(saved)
      }
    } catch {
      // ignore
    }
    return null
  })

  const login = (userData) => {
    const fullUser = { ...userData, isAuthenticated: true }
    localStorage.setItem('user_profile', JSON.stringify(fullUser))
    setUser(fullUser)
  }

  const logout = () => {
    tokenManager.clear()
    localStorage.removeItem('user_profile')
    setUser(null)
  }

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ user, login, logout }}>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<RoleRedirect />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="chat" element={<AIChatPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="college-hub" element={<CollegeHubPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Role Protected Dashboards */}
            <Route
              path="admin"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'COLLEGE_ADMIN']}>
                  <AdminPage />
                </RoleRoute>
              }
            />
            <Route
              path="dean"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'COLLEGE_ADMIN', 'DEAN']}>
                  <DeanPage />
                </RoleRoute>
              }
            />
            <Route
              path="hod"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'COLLEGE_ADMIN', 'DEAN', 'HOD']}>
                  <HodPage />
                </RoleRoute>
              }
            />

            <Route path="sources" element={<SourcesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
    </ThemeProvider>
  )
}
