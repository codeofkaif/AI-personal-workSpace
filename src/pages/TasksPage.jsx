import { useState } from 'react'
import { Plus, Check, Trash2, X } from 'lucide-react'

const initialTasks = [
  { id: 1, title: 'Complete DBMS assignment', due: 'Today', priority: 'High', done: false },
  { id: 2, title: 'Prepare for Java internal', due: 'Tomorrow', priority: 'Medium', done: false },
  { id: 3, title: 'Read OS chapter 3', due: 'Oct 1', priority: 'Medium', done: false },
  { id: 4, title: 'Project presentation prep', due: 'Oct 2', priority: 'High', done: false },
  { id: 5, title: 'Revise DSA (Graphs)', due: 'Oct 3', priority: 'Low', done: false },
  { id: 6, title: 'Update resume', due: 'Oct 5', priority: 'Low', done: false },
]

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTab, setActiveTab] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('Today')
  const [newPriority, setNewPriority] = useState('Medium')

  const tabs = ['All', 'Today', 'Upcoming', 'Completed']

  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id))

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'Today') return t.due.toLowerCase() === 'today'
    if (activeTab === 'Upcoming') return t.due.toLowerCase() !== 'today' && !t.done
    if (activeTab === 'Completed') return t.done
    return true
  })

  const handleAddTask = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setTasks([...tasks, { id: Date.now(), title: newTitle.trim(), due: newDue, priority: newPriority, done: false }])
    setNewTitle('')
    setShowModal(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">Stay organized and productive.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-dark">
          <Plus size={14} />
          <span>+ Add Task</span>
        </button>
      </div>

      {/* Tabs */}
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

      {/* Tasks List */}
      <div className="app-card overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">No tasks in this view.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      task.done
                        ? 'bg-[#e07a3f] border-[#e07a3f]'
                        : 'border-gray-300 bg-white hover:border-amber-400'
                    }`}
                  >
                    {task.done && <Check size={10} strokeWidth={3} className="text-white" />}
                  </button>
                  <span className={`text-sm font-medium truncate ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-gray-400 font-medium">{task.due}</span>
                  <span className={
                    task.priority === 'High' ? 'badge-high' :
                    task.priority === 'Medium' ? 'badge-medium' : 'badge-low'
                  }>
                    {task.priority}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="font-bold text-gray-900 text-sm">Add New Task</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title</label>
                <input
                  type="text" placeholder="e.g. Study for Graph Theory" value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="form-input" required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Due Date</label>
                  <select value={newDue} onChange={(e) => setNewDue(e.target.value)} className="form-input">
                    <option>Today</option>
                    <option>Tomorrow</option>
                    <option value="Oct 1">Oct 1</option>
                    <option value="Oct 2">Oct 2</option>
                    <option value="Oct 5">Oct 5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Priority</label>
                  <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="form-input">
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-white text-xs py-1.5 px-3">Cancel</button>
                <button type="submit" className="btn-dark text-xs py-1.5 px-4">Add Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
