import { useState, useEffect } from 'react'
import { Activity, CheckCircle2, AlertCircle, RefreshCw, Database, Server, Cpu } from 'lucide-react'
import { healthApi } from '../api/client'

export default function HealthChecker() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const checkHealth = async () => {
    setLoading(true)
    try {
      const data = await healthApi.check()
      setHealth(data)
    } catch {
      setHealth({ status: 'DOWN', database: { status: 'DOWN' }, ragService: { status: 'DOWN' } })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
    const timer = setInterval(checkHealth, 300000) // check every 5 minutes
    return () => clearInterval(timer)
  }, [])

  const isHealthy = health?.status === 'UP' && health?.database?.status === 'UP'
  const isDegraded = health?.status === 'DEGRADED' || (health?.status === 'UP' && health?.ragService?.status !== 'UP')

  return (
    <div className="relative">
      {/* Trigger Badge */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs bg-white hover:bg-gray-50 border-gray-200"
        title="Click to view live system health"
      >
        <span className="relative flex h-2 w-2">
          {isHealthy ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : isDegraded ? (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          )}
        </span>
        <span className="text-gray-700 hidden sm:inline">
          {loading ? 'Checking...' : isHealthy ? 'System Online' : isDegraded ? 'Degraded' : 'Offline'}
        </span>
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-amber-600" />
                <h4 className="font-bold text-sm text-gray-900">System Health</h4>
              </div>
              <button
                onClick={checkHealth}
                disabled={loading}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh Health Status"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              {/* Backend */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Server size={14} className="text-blue-500" />
                  <span>Spring Backend (8080)</span>
                </div>
                {health?.status === 'UP' || health?.status === 'DEGRADED' ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <CheckCircle2 size={13} /> UP
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold">
                    <AlertCircle size={13} /> DOWN
                  </span>
                )}
              </div>

              {/* PostgreSQL */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Database size={14} className="text-purple-500" />
                  <span>PostgreSQL (5432)</span>
                </div>
                {health?.database?.status === 'UP' ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <CheckCircle2 size={13} /> UP
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold">
                    <AlertCircle size={13} /> DOWN
                  </span>
                )}
              </div>

              {/* FastAPI RAG */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Cpu size={14} className="text-emerald-500" />
                  <span>RAG AI Service (8000)</span>
                </div>
                {health?.ragService?.status === 'UP' ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <CheckCircle2 size={13} /> UP
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500 font-bold">
                    <AlertCircle size={13} /> OFFLINE
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <span>Auto-refresh: 5 min</span>
              <span>{health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '—'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
