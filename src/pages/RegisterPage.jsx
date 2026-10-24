import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi, tokenManager } from '../api/client'
import loginBg from '../assets/login-workspace.jpg'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    college: 'Babu Banarasi Das University',
    branch: 'Computer Science & Engineering',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await authApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
        collegeCode: form.collegeCode || 'BBDU',
        department: form.branch || 'Computer Science & Engineering',
        role: 'STUDENT',
      })
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
      navigate('/app/dashboard')
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
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
          <h1 className="text-[28px] font-extrabold text-gray-950 tracking-tight leading-tight">Create Account</h1>
          <p className="text-gray-400 text-sm mt-1.5">Connect your college knowledge base with AI</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text" placeholder="Kaif Khan" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-xl p-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all placeholder-gray-300 text-gray-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">College Email</label>
              <input
                type="email" placeholder="you@student.bbd.edu.in" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-xl p-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all placeholder-gray-300 text-gray-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">College</label>
              <select
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-xl p-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all bg-white text-gray-800"
              >
                <option value="Babu Banarasi Das University">Babu Banarasi Das University</option>
                <option value="Indian Institute of Technology">Indian Institute of Technology</option>
                <option value="National Institute of Technology">National Institute of Technology</option>
                <option value="Delhi University">Delhi University</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Department / Branch</label>
              <select
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-xl p-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all bg-white text-gray-800"
              >
                <option value="Computer Science & Engineering">Computer Science &amp; Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics & Comm.">Electronics &amp; Comm.</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password" placeholder="Create a strong password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-xl p-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all placeholder-gray-300 text-gray-800"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1b2a22] hover:bg-[#122019] text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-60 mt-2"
            >
              {loading ? 'Creating workspace...' : 'Get Started'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-7">
            Already have an account?{' '}
            <Link to="/login" className="text-[#c8793b] hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>

        <div className="text-xs text-gray-400">
          © 2026 AI Personal Workspace · Multi-College
        </div>
      </div>

      {/* ── Right Photo Panel ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img src={loginBg} alt="Study Workspace" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        <div className="relative z-10 flex flex-col justify-end p-14 pb-16 w-full h-full">
          <div className="space-y-0.5 mb-5">
            {['Learn', 'Organize', 'Build', 'With AI'].map((word) => (
              <div key={word} className="text-[52px] font-black text-white leading-tight tracking-tight">{word}</div>
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
