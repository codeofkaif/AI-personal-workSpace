import { useState, useEffect, useRef } from 'react'
import { Upload, FolderPlus, Search, FileText, Download, Trash2, MessageSquare, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { documentsApi } from '../api/client'

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return d.toLocaleDateString()
}

export default function DocumentsPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null) // { type: 'success'|'error', msg }

  const tabs = ['All', 'PDF', 'Docs', 'College']

  // ── Fetch documents on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetchDocs()
  }, [])

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const [personal, college] = await Promise.all([
        documentsApi.getAll().catch(() => []),
        documentsApi.getCollegeDocs().catch(() => []),
      ])
      const personalDocs = (personal || []).map(d => ({ ...d, source: 'Personal' }))
      const collegeDocs  = (college  || []).map(d => ({ ...d, source: 'College'  }))
      // Merge, deduplicate by id
      const merged = [...collegeDocs, ...personalDocs.filter(p => !collegeDocs.find(c => c.id === p.id))]
      setDocs(merged)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredDocs = docs.filter(doc => {
    const matchesSearch = (doc.title || doc.fileName || '').toLowerCase().includes(search.toLowerCase())
    if (activeTab === 'PDF')     return matchesSearch && (doc.fileType || '').includes('pdf')
    if (activeTab === 'Docs')    return matchesSearch && ((doc.fileType || '').includes('word') || (doc.title || '').endsWith('.docx'))
    if (activeTab === 'College') return matchesSearch && doc.source === 'College'
    return matchesSearch
  })

  const toggleSelect    = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleSelectAll = ()   => setSelectedIds(selectedIds.length === filteredDocs.length ? [] : filteredDocs.map(d => d.id))

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await documentsApi.delete(id)
      setDocs(prev => prev.filter(d => d.id !== id))
      setSelectedIds(prev => prev.filter(x => x !== id))
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setUploadStatus({ type: 'error', msg: 'Please select a file first.' })
      return
    }
    setUploading(true)
    setUploadStatus(null)
    try {
      const result = await documentsApi.upload(selectedFile)
      setUploadStatus({ type: 'success', msg: `✅ "${result.title || selectedFile.name}" uploaded & indexed into RAG successfully!` })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchDocs() // Refresh list from backend
      setTimeout(() => {
        setShowUploadModal(false)
        setUploadStatus(null)
      }, 2000)
    } catch (err) {
      setUploadStatus({ type: 'error', msg: 'Upload failed: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  const closeModal = () => {
    setShowUploadModal(false)
    setSelectedFile(null)
    setUploadStatus(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Documents</h1>
          <p className="text-gray-500 text-sm mt-0.5">Upload, manage and chat with your files.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setShowUploadModal(true)} className="btn-dark">
            <Upload size={14} />
            <span>+ Upload</span>
          </button>
          <button className="btn-white">
            <FolderPlus size={14} />
            <span>New Folder</span>
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-60">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="app-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin text-amber-500" />
            <span className="text-sm">Loading documents...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <FileText size={32} className="text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">No documents found</p>
            <p className="text-xs text-gray-400">Upload a PDF or DOCX to get started</p>
            <button onClick={() => setShowUploadModal(true)} className="btn-dark text-xs mt-1">
              <Upload size={13} /> Upload Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredDocs.length > 0 && selectedIds.length === filteredDocs.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                    />
                  </th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[13px]">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedIds.includes(doc.id)
                  const name = doc.title || doc.fileName || 'Untitled'
                  const ext  = name.split('.').pop()?.toUpperCase() || '—'
                  return (
                    <tr key={doc.id} className={`transition-colors ${isSelected ? 'bg-amber-50/40' : 'hover:bg-gray-50/60'}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(doc.id)}
                          className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <FileText size={16} className={ext === 'PDF' ? 'text-red-500 shrink-0' : 'text-blue-500 shrink-0'} />
                          <span className="font-semibold text-gray-800 truncate max-w-[220px]">{name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium">{ext}</td>
                      <td className="py-3 px-4 text-gray-400">{formatSize(doc.fileSize)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          doc.source === 'College'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          {doc.source}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{formatDate(doc.uploadedAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1 text-gray-400">
                          <button
                            onClick={() => navigate('/app/chat')}
                            className="p-1.5 hover:text-[#e07a3f] hover:bg-amber-50 rounded-lg transition-colors"
                            title="Chat with Document"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="font-bold text-gray-900 text-sm">Upload Document</h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select File</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText size={20} className="text-amber-500" />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-gray-800 truncate max-w-[200px]">{selectedFile.name}</p>
                        <p className="text-[11px] text-gray-400">{formatSize(selectedFile.size)}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload size={22} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-xs text-gray-600 font-semibold">Click to browse files</p>
                      <p className="text-[11px] text-gray-400 mt-1">Supports PDF, DOCX up to 50MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.pptx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Status Message */}
              {uploadStatus && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-xs font-medium ${
                  uploadStatus.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {uploadStatus.type === 'success'
                    ? <CheckCircle size={14} className="shrink-0 mt-0.5" />
                    : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                  <span>{uploadStatus.msg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className="btn-white text-xs py-2 px-3">Cancel</button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="btn-dark text-xs py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {uploading ? <><Loader2 size={12} className="animate-spin" /> Uploading & Indexing...</> : 'Upload & Index'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
