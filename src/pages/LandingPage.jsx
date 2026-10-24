import { useNavigate } from 'react-router-dom'
import {
  Building2, FileText, MessageSquare, CheckSquare, Calendar,
  CircleDot, Landmark, ClipboardList, Bot, LayoutGrid, BookOpen, ArrowRight, User
} from 'lucide-react'
import bgImage from '../assets/landing-bg.jpg'
import { useAuth } from '../context/AuthContext'
import { tokenManager } from '../api/client'

/* ── Navigation (exact 4 links from design) ───────── */
const navLinks = ['Features', 'For College', 'Pricing', 'About']

/* ── 4 Feature Icons (exact 4 from bottom of design) ── */
const bottomFeatures = [
  {
    Icon: Landmark,
    title: 'College Knowledge',
    desc: 'Notices, syllabus, placements',
    route: '/app/college-hub'
  },
  {
    Icon: ClipboardList,
    title: 'Personal Workspace',
    desc: 'Notes, documents, tasks',
    route: '/app/documents'
  },
  {
    Icon: Bot,
    title: 'AI Assistant',
    desc: 'Source-grounded answers',
    route: '/app/chat'
  },
  {
    Icon: LayoutGrid,
    title: 'Productivity Tools',
    desc: 'Stay organized',
    route: '/app/tasks'
  },
]

/* ── Stats Bar ───────────────────────────────────── */
const stats = [
  { label: 'All Your Knowledge', value: '1 Workspace' },
  { label: '24/7 Assistance',    value: 'AI Powered'  },
  { label: 'Keep It Organized',  value: 'Stay Productive' },
  { label: 'Built for Students', value: 'College Focused' },
]

/* ── Features Section Cards ──────────────────────── */
const features = [
  {
    Icon: Building2,
    title: 'College Hub',
    desc: 'Access notices, syllabus, placements, internships and important academic information.',
    cta: 'Explore College Hub →',
    route: '/app/college-hub',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
  {
    Icon: FileText,
    title: 'Document Management',
    desc: 'Upload, organize and search your PDFs, notes and study material with AI.',
    cta: 'Manage Documents →',
    route: '/app/documents',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
  },
  {
    Icon: MessageSquare,
    title: 'Chat with AI',
    desc: 'Get accurate answers from your documents with proper citations and sources.',
    cta: 'Start Chatting →',
    route: '/app/chat',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
  },
  {
    Icon: CheckSquare,
    title: 'Notes & Tasks',
    desc: 'Create notes, manage tasks and stay organized throughout your academic journey.',
    cta: 'Organize Now →',
    route: '/app/tasks',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-700',
  },
  {
    Icon: Calendar,
    title: 'Calendar & Schedule',
    desc: 'Manage your classes, deadlines, exams and important dates in one place.',
    cta: 'View Calendar →',
    route: '/app/calendar',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isLoggedIn = !!tokenManager.get()

  const getDashboardRoute = () => {
    const role = (user?.role || 'STUDENT').toUpperCase()
    if (role === 'ADMIN' || role === 'COLLEGE_ADMIN') return '/app/admin'
    if (role === 'DEAN') return '/app/dean'
    if (role === 'HOD') return '/app/hod'
    return '/app/dashboard'
  }

  const dashboardRoute = getDashboardRoute()

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-gray-900 font-sans selection:bg-amber-100 flex flex-col p-1 sm:p-4 md:p-6">

      {/* ══════════ EXACT HERO SHOWCASE CARD CONTAINER ══════════ */}
      <div className="relative w-full max-w-[1360px] mx-auto bg-[#faf8f5] rounded-xl sm:rounded-2xl md:rounded-[28px] border border-gray-200/90 shadow-2xl overflow-hidden flex flex-col justify-between min-h-[660px] lg:min-h-[720px]">

        {/* ── Full Size Background Image (Desk + Laptop) ── */}
        <img
          src={bgImage}
          alt="AI Workspace on Laptop Desk"
          className="absolute inset-0 w-full h-full object-cover object-right md:object-center select-none"
        />

        {/* ── Soft Seamless Gradient: Text readability on left, pristine laptop on right ── */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#faf8f5] via-[#faf8f5]/90 sm:via-[#faf8f5]/85 md:via-[#faf8f5]/65 to-[#faf8f5]/20 md:to-transparent pointer-events-none" />

        {/* ══════════ EXACT NAVBAR ══════════ */}
        <nav className="relative z-50 w-full bg-transparent transition-all">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-10 py-4 sm:py-5 flex items-center justify-between">

            {/* Brand Logo & Name — Click to go to Home/Landing */}
            <div
              className="flex items-center gap-2.5 cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
              onClick={() => {
                navigate('/')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              title="Go to Home / Landing Page"
            >
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shadow-xs">
                <BookOpen size={16} className="text-white stroke-[2.2]" />
              </div>
              <span className="font-extrabold text-gray-950 text-[17px] tracking-tight">AI Workspace</span>
            </div>

            {/* Center Nav Links */}
            <div className="hidden md:flex items-center gap-8 text-[14px] font-semibold text-gray-700">
              {navLinks.map(link => (
                <a key={link} href="#features" className="hover:text-black transition-colors">
                  {link}
                </a>
              ))}
            </div>

            {/* Right Buttons: Hide Sign In when logged in */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isLoggedIn ? (
                <button
                  onClick={() => navigate(dashboardRoute)}
                  className="bg-[#181c22] hover:bg-black text-white text-[12px] sm:text-[13px] font-semibold px-4 sm:px-5 py-2.5 rounded-xl border border-gray-700/60 shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center">
                    {user?.name?.[0] || 'U'}
                  </span>
                  <span>Go to Workspace</span>
                  <ArrowRight size={14} className="text-amber-400" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="bg-[#181c22] hover:bg-black text-white text-[12px] sm:text-[13px] font-semibold px-3.5 sm:px-5 py-2 rounded-lg border border-gray-700/60 shadow-xs transition-all cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="bg-[#df9f4f] hover:bg-[#d09141] text-[#2c1a08] font-bold text-[12px] sm:text-[13px] px-3.5 sm:px-5 py-2 rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* ══════════ HERO CONTENT (OVERLAID ON LEFT SIDE) ══════════ */}
        <div className="relative z-20 flex-1 flex items-center">
          <div className="w-full max-w-[1280px] mx-auto px-5 sm:px-6 md:px-10 py-6 sm:py-8 lg:py-14">
            <div className="max-w-[620px] text-left">

              {/* Exact 3-line Headline from reference */}
              <div className="space-y-0.5 mb-4">
                <h1 className="text-[30px] sm:text-[40px] md:text-[48px] lg:text-[54px] font-black text-gray-950 tracking-tight leading-[1.08]">
                  Your Knowledge.
                </h1>
                <h1 className="text-[30px] sm:text-[40px] md:text-[48px] lg:text-[54px] font-black text-gray-950 tracking-tight leading-[1.08]">
                  Your College.
                </h1>
                <h1 className="text-[26px] sm:text-[38px] md:text-[46px] lg:text-[52px] font-black text-[#b8752e] tracking-tight leading-[1.08] sm:whitespace-nowrap">
                  Your Personal Workspace.
                </h1>
              </div>

              {/* Subtitle */}
              <p className="text-[14px] sm:text-[15px] md:text-[16px] text-gray-600 leading-relaxed mb-7 max-w-[480px]">
                Organize your college knowledge, personal documents, notes, tasks and get AI-powered answers with real sources.
              </p>

              {/* Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5">
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={() => navigate(dashboardRoute)}
                      className="bg-[#b8752e] hover:bg-[#a66725] text-white font-bold text-sm py-3 px-8 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>Resume Workspace</span>
                      <ArrowRight size={16} />
                    </button>
                    <button
                      onClick={() => navigate('/app/chat')}
                      className="bg-white hover:bg-gray-50 text-gray-950 border border-gray-200/90 font-bold text-sm py-3 px-6 rounded-xl transition-all flex items-center gap-2 shadow-xs hover:shadow-sm cursor-pointer"
                    >
                      <Bot size={16} className="text-[#b8752e]" />
                      <span>Ask AI Tutor</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => navigate('/register')}
                      className="bg-[#b8752e] hover:bg-[#a66725] text-white font-bold text-sm py-3 px-8 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                      Get Started
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="bg-white hover:bg-gray-50 text-gray-950 border border-gray-200/90 font-bold text-sm py-3 px-6 rounded-xl transition-all flex items-center gap-2 shadow-xs hover:shadow-sm cursor-pointer"
                    >
                      <CircleDot size={16} className="text-gray-950" />
                      <span>Watch Demo</span>
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── 4 Feature Items at Bottom of Screen (Clean 4-column divider layout) ── */}
        <div className="relative z-20 w-full border-t border-gray-200/70 bg-[#faf8f5]/90 backdrop-blur-sm">
          <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-200/60">
              {bottomFeatures.map(({ Icon, title, desc, route }, idx) => (
                <div
                  key={title}
                  onClick={() => navigate(route)}
                  className={`flex flex-col items-start cursor-pointer group pt-3 md:pt-0 ${idx !== 0 ? 'md:pl-6' : ''}`}
                >
                  <Icon size={20} className="text-gray-900 stroke-[2.2] group-hover:scale-110 transition-transform mb-2" />
                  <h3 className="font-bold text-[14px] text-gray-950 leading-snug group-hover:text-[#b8752e] transition-colors">{title}</h3>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-normal">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ══════════ STATS BAR ══════════ */}
      <section className="w-full my-6">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {stats.map(({ label, value }) => (
                <div key={value} className="py-6 px-5 text-center">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-[20px] font-black text-gray-900 mt-1 tracking-tight">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES SECTION ══════════ */}
      <section className="w-full max-w-[1240px] mx-auto px-6 md:px-10 py-14" id="features">

        {/* Section Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold px-3.5 py-1.5 rounded-full mb-3 shadow-xs">
            Built for Real Student Workflows
          </div>
          <h2 className="text-[30px] md:text-[36px] font-black text-gray-950 tracking-tight">
            Everything You Need, In One Workspace
          </h2>
          <p className="text-[14px] text-gray-600 mt-2.5 max-w-md mx-auto">
            A complete workspace to manage your college and personal knowledge with AI assistance.
          </p>
        </div>

        {/* Feature Cards — 5 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {features.map(({ Icon, title, desc, cta, route, iconBg, iconColor }) => (
            <div
              key={title}
              onClick={() => navigate(route)}
              className="bg-white border border-gray-200/80 rounded-2xl p-5 hover:border-gray-300 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col shadow-xs"
            >
              <div className={`w-10 h-10 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center mb-4 shadow-xs`}>
                <Icon size={18} />
              </div>
              <h3 className="font-bold text-[14px] text-gray-900 mb-2">{title}</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed flex-1">{desc}</p>
              <span className="text-[12px] font-bold text-[#2d5a27] mt-4 flex items-center transition-all group-hover:underline">
                {cta}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="mt-auto w-full bg-white border-t border-gray-200">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div
              className="flex items-center gap-2 text-[13px] font-bold text-gray-800 cursor-pointer hover:text-black transition-colors"
              onClick={() => {
                navigate('/')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              title="Go to Home / Landing Page"
            >
              <div className="w-6 h-6 rounded-md bg-[#161a22] flex items-center justify-center">
                <BookOpen size={13} className="text-white" />
              </div>
              AI Workspace
            </div>
            <p className="text-[12px] text-gray-500">
              © 2026 AI Workspace · Multi-College Knowledge Architecture · Built for Students
            </p>
            <div className="flex items-center gap-5 text-[12px] font-semibold text-gray-500">
              <a href="#" className="hover:text-gray-800 transition-colors">Privacy</a>
              <a href="#" className="hover:text-gray-800 transition-colors">Terms</a>
              <a href="#" className="hover:text-gray-800 transition-colors">Contact</a>
            </div>
          </div>
      </footer>
    </div>
  )
}
