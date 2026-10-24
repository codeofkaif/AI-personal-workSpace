import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert } from 'lucide-react'

export default function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const userRole = (user.role || 'STUDENT').toUpperCase()
  const isAllowed = allowedRoles.some((r) => r.toUpperCase() === userRole)

  if (!isAllowed) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-red-200 rounded-2xl shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
          <ShieldAlert size={28} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-1">
            Your current role is <strong className="text-gray-800 uppercase">[{userRole}]</strong>.
            This section is strictly protected and requires: <span className="font-semibold text-red-600">{allowedRoles.join(' or ')}</span>.
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-mono text-left">
          🔒 RBAC Security Enforced: Role-isolated boundary prevents unauthorized cross-role access.
        </div>
        <div className="pt-2">
          <button
            onClick={() => {
              if (userRole === 'DEAN') window.location.href = '/app/dean'
              else if (userRole === 'HOD') window.location.href = '/app/hod'
              else if (userRole === 'ADMIN' || userRole === 'COLLEGE_ADMIN') window.location.href = '/app/admin'
              else window.location.href = '/app/dashboard'
            }}
            className="btn-amber text-xs py-2.5 px-5"
          >
            Return to My Authorized Dashboard
          </button>
        </div>
      </div>
    )
  }

  return children
}
