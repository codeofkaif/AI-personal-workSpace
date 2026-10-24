import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi, tokenManager } from '../api/client'
import loginBg from '../assets/login-workspace.jpg'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already logged-in? Redirect immediately to their dashboard
  const existingToken = tokenManager.get()
  if (existingToken) {
    const role = (user?.role || 'STUDENT').toUpperCase()
    if (role === 'ADMIN' || role === 'COLLEGE_ADMIN') return <Navigate to="/app/admin" replace />
    if (role === 'DEAN') return <Navigate to="/app/dean" replace />
    if (role === 'HOD') return <Navigate to="/app/hod" replace />
    return <Navigate to="/app/dashboard" replace />
  }

  const routeByRole = (role) => {
    const r = (role || 'STUDENT').toUpperCase()
    if (r === 'ADMIN' || r === 'COLLEGE_ADMIN') return '/app/admin'
    if (r === 'DEAN') return '/app/dean'
    if (r === 'HOD') return '/app/hod'
    return '/app/dashboard'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await authApi.login({ email, password })
      tokenManager.set(data.token)
      login({
        id: data.userId,
        name: data.name,
        email: data.email,
        college: data.collegeName || '',
        role: data.role,
        isAuthenticated: true,
        avatar: data.name?.charAt(0)?.toUpperCase() || 'U',
      })
      navigate(routeByRole(data.role))
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* ── Left Form Panel ── */}
      <div className="w-full lg:w-[46%] xl:w-[42%] flex flex-col justify-between p-8 md:p-12 lg:p-16 bg-white">

        {/* Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-[#161a22] flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-gray-950 text-[15px] tracking-tight">AI Workspace</span>
        </div>

        {/* Form */}
        <div className="max-w-[360px] w-full mx-auto my-auto">
          <h1 className="text-[28px] font-extrabold text-gray-950 tracking-tight leading-tight">Welcome Back</h1>
          <p className="text-gray-400 text-sm mt-1.5">Login to your account to continue</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-xl p-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all placeholder-gray-300 text-gray-800"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">Password</label>
                <a href="#" className="text-xs text-[#c8793b] hover:underline font-medium">
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-xl p-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all placeholder-gray-300 text-gray-800"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 font-medium select-none cursor-pointer">
                Remember me
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1b2a22] hover:bg-[#122019] text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-60 mt-2 cursor-pointer"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium text-center">
                {error}
              </div>
            )}
          </form>



          <p className="text-center text-sm text-gray-500 mt-7">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#c8793b] hover:underline font-semibold">
              Create new account
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-400">
          © 2026 AI Personal Workspace · Multi-College
        </div>
      </div>

      {/* ── Right Photo Panel ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Photo */}
        <img
          src={loginBg}
          alt="Study Workspace"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

        {/* Text on top */}
        <div className="relative z-10 flex flex-col justify-end p-14 pb-16 w-full h-full">
          <div className="space-y-0.5 mb-5">
            {['Learn', 'Organize', 'Build', 'With AI'].map((word) => (
              <div key={word} className="text-[52px] font-black text-white leading-tight tracking-tight">
                {word}
              </div>
            ))}
          </div>
          <p className="text-gray-300 text-base font-medium leading-relaxed">
            Your second brain<br />for college and beyond.
          </p>
        </div>
      </div>
    </div>
  )
}
