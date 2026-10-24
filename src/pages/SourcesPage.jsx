import { useState } from 'react'
import { FileText, ExternalLink, Hash, Check, Copy } from 'lucide-react'

const citationSources = [
  {
    id: 1,
    title: 'Java_Notes.pdf',
    location: 'Page 12',
    relevance: 92,
    snippet: 'The Java Virtual Machine (JVM) contains three main components: ClassLoader subsystem, Runtime Data Area, and Execution Engine. Bytecode is loaded and executed in managed memory.',
  },
  {
    id: 2,
    title: 'Official Oracle Documentation',
    location: 'Section: JVM Architecture',
    relevance: 85,
    snippet: 'The JVM provides platform independence through execution of standardized class file format. Memory management utilizes generational garbage collection across Heap spaces.',
  },
  {
    id: 3,
    title: 'Interview_Questions.pdf',
    location: 'Page 8',
    relevance: 76,
    snippet: 'Key distinctions between JDK, JRE and JVM. JDK contains development tools, JRE contains runtime libraries, JVM handles execution.',
  },
]

export default function SourcesPage() {
  const [copiedId, setCopiedId] = useState(null)

  const handleCopy = (snippet, id) => {
    navigator.clipboard.writeText(snippet)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header matching Screen 13 */}
      <div>
        <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">AI Sources / Citations</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          These are the documents used to generate the response.
        </p>
      </div>

      {/* Sources Cards matching Screen 13 */}
      <div className="space-y-3.5">
        {citationSources.map((source) => (
          <div
            key={source.id}
            className="app-card bg-white p-5 hover:border-gray-300 transition-all shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <FileText size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">
                    {source.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Hash size={11} /> {source.location}
                  </p>
                </div>
              </div>

              {/* Relevance Bar & Score from Screen 13 */}
              <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-700">
                    Relevance: {source.relevance}%
                  </span>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${source.relevance}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-gray-400">
                  <button
                    onClick={() => handleCopy(source.snippet, source.id)}
                    className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors text-xs flex items-center gap-1"
                    title="Copy excerpt"
                  >
                    {copiedId === source.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => alert(`Opening source: ${source.title}`)}
                    className="p-1.5 hover:text-amber-600 hover:bg-gray-100 rounded transition-colors"
                    title="Open document"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Snippet box */}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed border border-gray-100">
              "{source.snippet}"
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
