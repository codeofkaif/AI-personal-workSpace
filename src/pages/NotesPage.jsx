import { useState } from 'react'
import {
  Plus, Search, Bold, Italic, Underline,
  List, ListOrdered, Code, Pin, Trash2, Check
} from 'lucide-react'

const initialNotes = [
  {
    id: 1, title: 'Java Notes', date: 'Sep 25, 2026', savedAgo: 'Last saved: 2 min ago',
    content: `Java - Important Topics\n\n1. OOP Concepts\n2. JVM, JRE, JDK\n3. Exception Handling\n4. Collections Framework\n5. Multithreading\n6. JDBC\n7. AWT and Swing`
  },
  {
    id: 2, title: 'DBMS Important Topics', date: 'Sep 23, 2026', savedAgo: 'Last saved: 2 days ago',
    content: `DBMS - Core Concepts\n\n• Normalization (1NF, 2NF, 3NF, BCNF)\n• ACID properties and concurrency control\n• SQL joins and complex subqueries\n• Indexing algorithms (B-Tree, B+ Tree)`
  },
  {
    id: 3, title: 'OS Summary', date: 'Sep 20, 2026', savedAgo: 'Last saved: 5 days ago',
    content: `Operating Systems Summary\n\n1. Process vs Thread\n2. CPU Scheduling (FCFS, SJF, Round Robin)\n3. Deadlock prevention and avoidance\n4. Virtual memory & Paging`
  },
  {
    id: 4, title: 'System Design', date: 'Sep 18, 2026', savedAgo: 'Last saved: 1 week ago',
    content: `System Design Foundations\n\n• Horizontal vs Vertical Scaling\n• Caching with Redis & CDN\n• Load balancing algorithms\n• CAP Theorem trade-offs`
  },
  {
    id: 5, title: 'Interview Questions', date: 'Sep 15, 2026', savedAgo: 'Last saved: 2 weeks ago',
    content: `Coding Interview Preparation\n\n• Two Pointer & Sliding Window\n• Binary Tree Traversals\n• Graph BFS / DFS\n• Dynamic Programming patterns`
  },
]

export default function NotesPage() {
  const [notes, setNotes] = useState(initialNotes)
  const [selectedNote, setSelectedNote] = useState(initialNotes[0])
  const [search, setSearch] = useState('')
  const [noteContent, setNoteContent] = useState(initialNotes[0].content)
  const [noteTitle, setNoteTitle] = useState(initialNotes[0].title)

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectNote = (note) => {
    setSelectedNote(note)
    setNoteTitle(note.title)
    setNoteContent(note.content)
  }

  const handleAddNewNote = () => {
    const newNote = { id: Date.now(), title: 'Untitled Note', date: 'Today', savedAgo: 'Last saved: Just now', content: '' }
    setNotes([newNote, ...notes])
    handleSelectNote(newNote)
  }

  const handleDelete = () => {
    const updated = notes.filter(n => n.id !== selectedNote.id)
    setNotes(updated)
    if (updated.length > 0) handleSelectNote(updated[0])
  }

  const toolbarBtns = [
    { Icon: Bold, title: 'Bold' }, { Icon: Italic, title: 'Italic' }, { Icon: Underline, title: 'Underline' },
    null, // separator
    { label: 'H1', title: 'Heading 1' }, { label: 'H2', title: 'Heading 2' },
    null,
    { Icon: List, title: 'Bullet List' }, { Icon: ListOrdered, title: 'Numbered List' }, { Icon: Code, title: 'Code' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Notes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Create and organize your study notes.</p>
        </div>
        <button onClick={handleAddNewNote} className="btn-dark">
          <Plus size={14} />
          <span>+ New Note</span>
        </button>
      </div>

      {/* Two Column Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5" style={{ height: 'calc(100vh - 13rem)' }}>

        {/* Left: Notes List */}
        <div className="md:col-span-4 app-card flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {filteredNotes.map((note) => {
              const isSelected = selectedNote?.id === note.id
              return (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-amber-50 border-amber-200 shadow-sm'
                      : 'border-transparent hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <p className={`font-semibold text-xs truncate ${isSelected ? 'text-amber-900' : 'text-gray-800'}`}>
                    {note.title}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">{note.date}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Editor */}
        <div className="md:col-span-8 app-card flex flex-col overflow-hidden">

          {/* Editor Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 gap-3">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => {
                setNoteTitle(e.target.value)
                setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, title: e.target.value } : n))
              }}
              className="text-[17px] font-bold text-gray-900 border-none outline-none focus:ring-0 p-0 bg-transparent flex-1 min-w-0"
            />
            <span className="text-[11px] text-gray-400 shrink-0">{selectedNote?.savedAgo}</span>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-4 py-2 border-b border-gray-100 text-gray-400 overflow-x-auto no-scrollbar">
            {toolbarBtns.map((btn, i) => {
              if (btn === null) return <div key={i} className="h-4 w-px bg-gray-200 mx-1.5 shrink-0" />
              if (btn.label) return (
                <button key={i} className="px-2 py-1 rounded hover:bg-gray-100 hover:text-gray-800 transition-colors text-xs font-bold shrink-0" title={btn.title}>
                  {btn.label}
                </button>
              )
              return (
                <button key={i} className="p-1.5 rounded hover:bg-gray-100 hover:text-gray-800 transition-colors shrink-0" title={btn.title}>
                  <btn.Icon size={14} />
                </button>
              )
            })}
            <div className="flex-1" />
            <button className="p-1.5 rounded hover:bg-gray-100 hover:text-amber-600 transition-colors shrink-0" title="Pin Note">
              <Pin size={14} />
            </button>
            <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-50 hover:text-red-500 transition-colors shrink-0" title="Delete Note">
              <Trash2 size={14} />
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={noteContent}
            onChange={(e) => {
              setNoteContent(e.target.value)
              setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, content: e.target.value } : n))
            }}
            placeholder="Start typing your study notes..."
            className="flex-1 w-full px-5 py-4 bg-transparent text-[14px] text-gray-800 leading-relaxed outline-none resize-none font-sans"
          />
        </div>
      </div>
    </div>
  )
}
