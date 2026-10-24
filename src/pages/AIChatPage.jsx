import { useState, useRef, useEffect } from 'react'
import {
  Send, FileText, ChevronDown, Paperclip,
  ExternalLink, Loader2, Check, Bot, AlertCircle, RefreshCw,
  Copy, CheckCheck, Sparkles
} from 'lucide-react'
import { aiApi, documentsApi } from '../api/client'

export default function AIChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState('College + Personal')
  const [showScopeDropdown, setShowScopeDropdown] = useState(false)
  const [ragStatus, setRagStatus] = useState('checking') // checking | online | offline
  const [sources, setSources] = useState([])           // last answer's sources
  const [allDocs, setAllDocs] = useState([])           // user's uploaded docs list
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const scopes = ['College + Personal', 'College Only', 'Personal Only']

  // ── On mount: check RAG health + fetch doc list ───────────────────────────
  useEffect(() => {
    checkRagStatus()
    fetchDocList()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const checkRagStatus = async () => {
    setRagStatus('checking')
    try {
      const res = await aiApi.ragHealth()
      setRagStatus(res?.status === 'healthy' ? 'online' : 'offline')
    } catch {
      setRagStatus('offline')
    }
  }

  const fetchDocList = async () => {
    try {
      const [personal, college] = await Promise.all([
        documentsApi.getAll().catch(() => []),
        documentsApi.getCollegeDocs().catch(() => []),
      ])
      const all = [...(personal || []), ...(college || [])]
      setAllDocs(all)
    } catch {}
  }

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setSources([])

    // Include recent turns for follow-ups; the current text is already sent as the question.
    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'ai')
      .slice(-8)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
        clarification_needed: m.role === 'ai' && Boolean(m.clarificationNeeded),
      }))

    try {
      const res = await aiApi.chat(text, 5, scope, conversationHistory)
      const aiMsg = {
        id: Date.now() + 1,
        role: 'ai',
        content: res?.answer || 'No answer received from AI.',
        clarificationNeeded: Boolean(res?.clarificationNeeded),
        sourcesRaw: res?.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, aiMsg])
      setSources(res?.sources || [])
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'error',
        content: 'Failed to get response: ' + (err.message || 'Unknown error. Make sure the RAG service is running.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // ── Quick question from doc tag ───────────────────────────────────────────
  const askAboutDoc = (docName) => {
    setInput(`Summarize the document: ${docName}`)
    inputRef.current?.focus()
  }

  // ── Parse sources for display ─────────────────────────────────────────────
  const parseSources = (rawSources) => {
    return rawSources.map((s, i) => {
      try {
        const parsed = typeof s === 'string' ? JSON.parse(s.replace(/'/g, '"')) : s
        return { id: i, title: parsed.filename || parsed.title || `Source ${i + 1}`, type: 'Document' }
      } catch {
        return { id: i, title: String(s).substring(0, 50) || `Source ${i + 1}`, type: 'Document' }
      }
    })
  }

  const displaySources = sources.length > 0 ? parseSources(sources) : parseSources(
    messages.filter(m => m.role === 'ai' && m.sourcesRaw?.length > 0).slice(-1)[0]?.sourcesRaw || []
  )

  return (
    <div className="h-[calc(100vh-5.5rem)] flex gap-5">

      {/* ── Main Chat ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col app-card overflow-hidden min-w-0">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-bold text-gray-900">Chat with AI</h1>
              <p className="text-xs text-gray-500">
                Get answers from your uploaded documents &amp; college knowledge base.
              </p>
            </div>
            {/* RAG Status indicator */}
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              ragStatus === 'online'   ? 'bg-green-50 text-green-700 border border-green-200' :
              ragStatus === 'offline'  ? 'bg-red-50 text-red-600 border border-red-200' :
                                         'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                ragStatus === 'online' ? 'bg-green-500' :
                ragStatus === 'offline' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'
              }`}></span>
              RAG {ragStatus === 'checking' ? 'Checking...' : ragStatus === 'online' ? 'Online' : 'Offline'}
              {ragStatus === 'offline' && (
                <button onClick={checkRagStatus} className="ml-1 hover:opacity-70" title="Retry">
                  <RefreshCw size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Scope Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowScopeDropdown(!showScopeDropdown)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <span>{scope}</span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>
            {showScopeDropdown && (
              <div className="absolute right-0 top-9 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
                {scopes.map(s => (
                  <button
                    key={s}
                    onClick={() => { setScope(s); setShowScopeDropdown(false) }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-50 flex items-center justify-between ${
                      scope === s ? 'text-amber-600 font-semibold bg-amber-50/50' : 'text-gray-700'
                    }`}
                  >
                    <span>{s}</span>
                    {scope === s && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#fcfdfe]">

          {/* Welcome state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-10">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Bot size={26} className="text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">Ask anything from your documents</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  {allDocs.length > 0
                    ? `You have ${allDocs.length} document${allDocs.length > 1 ? 's' : ''} indexed. Ask questions and get sourced answers.`
                    : 'Upload documents first to get AI-powered answers from your content.'}
                </p>
              </div>
              {allDocs.length === 0 && (
                <a href="/app/documents" className="text-xs text-amber-600 font-semibold hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> Upload Documents
                </a>
              )}
              {/* Quick suggestions */}
              {allDocs.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {['Summarize my notes', 'What is the exam schedule?', 'Explain key concepts'].map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="text-xs bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50/30 text-gray-600 font-medium rounded-lg px-3 py-1.5 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[70%]">
                    <div className="bg-[#e07a3f] text-white text-xs md:text-sm font-medium rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-xs">
                      {msg.content}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">{msg.timestamp}</p>
                  </div>
                </div>
              )
            }

            if (msg.role === 'error') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[80%] bg-red-50 border border-red-200 rounded-2xl rounded-tl-xs p-4 shadow-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{msg.content}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">{msg.timestamp}</p>
                  </div>
                </div>
              )
            }

            // AI message
            const msgSources = parseSources(msg.sourcesRaw || [])
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] bg-white border border-gray-200/90 rounded-2xl rounded-tl-xs p-5 shadow-xs text-xs md:text-sm text-gray-800">

                  {/* AI Header with Badge & Copy Action */}
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-gray-100">
                    <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs">
                      <Sparkles size={14} className="text-amber-500" />
                      <span>{msg.clarificationNeeded ? 'Clarification Needed' : 'AI Assistant'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-medium">{msg.timestamp}</span>
                      <CopyButton text={msg.content} />
                    </div>
                  </div>

                  {/* Clean, Friendly & Understandable Structured Answer */}
                  <div className="leading-relaxed text-gray-800">
                    <FormattedMessage text={msg.content} />
                  </div>

                  {/* Source citations */}
                  {msgSources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sources Referenced</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msgSources.map((src) => (
                          <span
                            key={src.id}
                            className="inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 font-medium px-2.5 py-0.5 rounded-full"
                          >
                            <FileText size={10} />
                            {src.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!msg.clarificationNeeded && msg.sourcesRaw?.length === 0 && (
                    <p className="text-[10px] text-gray-400 mt-3 italic">
                      Direct AI Workspace query response.
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-xs text-gray-500 flex items-center gap-2 shadow-xs">
                <Loader2 size={14} className="animate-spin text-amber-500" />
                <span>Searching your documents and generating answer...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-gray-200 bg-white shrink-0">
          {/* Quick doc tags */}
          {allDocs.length > 0 && (
            <div className="flex items-center gap-2 mb-2.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] text-gray-400 font-medium shrink-0">Quick:</span>
              {allDocs.slice(0, 4).map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => askAboutDoc(doc.title || doc.fileName)}
                  className="text-[11px] bg-gray-100 hover:bg-amber-100 hover:text-amber-700 text-gray-700 font-medium rounded-full px-3 py-0.5 shrink-0 transition-colors truncate max-w-[140px]"
                  title={doc.title || doc.fileName}
                >
                  {(doc.title || doc.fileName || '').substring(0, 20)}{(doc.title || doc.fileName || '').length > 20 ? '…' : ''}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-amber-500 focus-within:bg-white transition-all">
            <input
              ref={inputRef}
              type="text"
              placeholder={ragStatus === 'offline' ? 'RAG service offline — start it first…' : 'Ask anything from your documents…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
              disabled={loading}
              className="flex-1 bg-transparent text-xs md:text-sm text-gray-800 placeholder-gray-400 outline-none disabled:opacity-60"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg bg-[#e07a3f] text-white hover:bg-[#cc6c34] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
          {ragStatus === 'offline' && (
            <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} />
              RAG service is offline. Run <code className="bg-red-50 px-1 rounded">bash start-rag.sh</code> to start it.
            </p>
          )}
        </div>
      </div>

      {/* ── Sources Sidebar ──────────────────────────────────────────────── */}
      <div className="w-64 app-card p-4 flex flex-col shrink-0 hidden lg:flex bg-white">
        <h2 className="font-bold text-sm text-gray-900 pb-3 border-b border-gray-100">
          Sources
        </h2>

        <div className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar pt-3">
          {displaySources.length > 0 ? (
            displaySources.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2">
                  <FileText size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{s.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{s.type}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center pt-6">
              <FileText size={24} className="mx-auto text-gray-200 mb-2" />
              <p className="text-[11px] text-gray-400">Sources will appear here after your first query</p>
            </div>
          )}
        </div>

        {/* Indexed docs count */}
        <div className="pt-3 border-t border-gray-100 mt-3">
          <p className="text-[11px] text-gray-400 font-medium">
            {allDocs.length} document{allDocs.length !== 1 ? 's' : ''} indexed
          </p>
          <a href="/app/documents" className="text-[11px] text-amber-600 font-semibold hover:underline flex items-center gap-1 mt-1">
            <ExternalLink size={10} /> Manage Documents
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Copy Answer Button ────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-amber-700 hover:bg-amber-50 px-2 py-0.5 rounded transition-all"
      title="Copy answer"
    >
      {copied ? (
        <>
          <CheckCheck size={11} className="text-emerald-600" />
          <span className="text-emerald-600 font-semibold">Copied</span>
        </>
      ) : (
        <>
          <Copy size={11} />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

// ── Inline Markdown Renderer ──────────────────────────────────────────────────
function renderInlineFormatting(rawText) {
  if (!rawText) return null
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g
  const parts = []
  let lastIdx = 0
  let match

  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIdx) {
      parts.push(rawText.slice(lastIdx, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-gray-950">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={`c-${match.index}`} className="font-mono text-[11px] bg-amber-50 text-amber-900 border border-amber-200/60 px-1.5 py-0.5 rounded">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`i-${match.index}`} className="italic text-gray-700">
          {token.slice(1, -1)}
        </em>
      )
    }
    lastIdx = regex.lastIndex
  }

  if (lastIdx < rawText.length) {
    parts.push(rawText.slice(lastIdx))
  }

  return parts.length > 0 ? parts : rawText
}

// ── Clean & Structured Message Component ──────────────────────────────────────
function FormattedMessage({ text }) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()

    // Empty lines for spacing
    if (!line) {
      elements.push(<div key={`empty-${index}`} className="h-2" />)
      return
    }

    // Headings (### or ## or #)
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${index}`} className="text-xs font-bold text-gray-900 mt-3 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-3.5 bg-amber-500 rounded-full inline-block"></span>
          <span>{renderInlineFormatting(line.replace(/^###\s+/, ''))}</span>
        </h4>
      )
      return
    }
    if (line.startsWith('## ') || line.startsWith('# ')) {
      elements.push(
        <h3 key={`h3-${index}`} className="text-sm font-bold text-gray-900 mt-3.5 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block"></span>
          <span>{renderInlineFormatting(line.replace(/^#+\s+/, ''))}</span>
        </h3>
      )
      return
    }

    // Blockquote or Tip callout (> or starts with 💡 Tip:)
    if (line.startsWith('>') || line.toLowerCase().startsWith('💡 tip:') || line.toLowerCase().startsWith('tip:')) {
      const cleanTip = line.replace(/^>\s*/, '')
      elements.push(
        <div key={`tip-${index}`} className="bg-amber-50/70 border-l-3 border-amber-500 rounded-r-lg px-3.5 py-2 my-2 text-xs text-amber-950 font-medium">
          {renderInlineFormatting(cleanTip)}
        </div>
      )
      return
    }

    // Bullet points (•, -, *, or starting emoji bullets)
    const isStandardBullet = line.startsWith('•') || line.startsWith('- ') || line.startsWith('* ')
    const emojiBulletMatch = line.match(/^([📌💡🎯📊🛡️🎓🆔🌟📄🏆✨⚡🚀🔍])\s*(.*)/)

    if (isStandardBullet) {
      const content = line.replace(/^[•\-\*]\s*/, '')
      elements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-2.5 my-1.5 pl-1 text-xs md:text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></span>
          <div className="flex-1 leading-relaxed text-gray-800">
            {renderInlineFormatting(content)}
          </div>
        </div>
      )
      return
    }

    if (emojiBulletMatch) {
      const emoji = emojiBulletMatch[1]
      const content = emojiBulletMatch[2]
      elements.push(
        <div key={`emoji-bullet-${index}`} className="flex items-start gap-2.5 my-1.5 pl-0.5 text-xs md:text-sm">
          <span className="text-sm shrink-0 mt-0.5">{emoji}</span>
          <div className="flex-1 leading-relaxed text-gray-800">
            {renderInlineFormatting(content)}
          </div>
        </div>
      )
      return
    }

    // Numbered step (e.g. 1. 2.)
    const numMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) {
      elements.push(
        <div key={`num-${index}`} className="flex items-start gap-2.5 my-1.5 pl-0.5 text-xs md:text-sm">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
            {numMatch[1]}
          </span>
          <div className="flex-1 leading-relaxed text-gray-800">
            {renderInlineFormatting(numMatch[2])}
          </div>
        </div>
      )
      return
    }

    // Regular friendly paragraph
    elements.push(
      <p key={`p-${index}`} className="leading-relaxed text-gray-800 my-1 text-xs md:text-sm">
        {renderInlineFormatting(line)}
      </p>
    )
  })

  return <div className="space-y-0.5">{elements}</div>
}

