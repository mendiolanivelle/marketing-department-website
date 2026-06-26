import { useState, useEffect, useRef, useCallback } from 'react'

interface WorkspaceCard {
  id: string
  type: 'note' | 'link' | 'todo' | 'column' | 'image'
  x: number
  y: number
  content: string
  todos?: { id: string; text: string; done: boolean }[]
  imageUrl?: string
  width?: number
  height?: number
}

const STORAGE_KEY = 'exodia-workspace-cards'

export default function Workspace() {
  const [cards, setCards] = useState<WorkspaceCard[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [editingTodo, setEditingTodo] = useState<{ cardId: string; todoId: string } | null>(null)
  const [newTodoText, setNewTodoText] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)
  const nextZRef = useRef(1)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  }, [cards])

  const addCard = useCallback((type: WorkspaceCard['type']) => {
    const id = `card-${Date.now()}`
    const base: WorkspaceCard = {
      id,
      type,
      x: 60 + Math.random() * 300,
      y: 60 + Math.random() * 300,
      content: type === 'note' ? 'New note...' : type === 'link' ? 'https://' : type === 'column' ? 'Column' : '',
      width: type === 'column' ? 260 : type === 'image' ? 280 : 220,
      height: type === 'column' ? 320 : type === 'note' ? 160 : 200,
    }
    if (type === 'todo') {
      base.todos = []
      base.height = 180
    }
    if (type === 'image') {
      base.imageUrl = ''
      base.content = 'Paste image URL or click to upload'
    }
    setCards(prev => [...prev, base])
    setActiveTool(null)
  }, [])

  const handleMouseDown = (e: React.MouseEvent, card: WorkspaceCard) => {
    e.preventDefault()
    setDragState({ id: card.id, startX: e.clientX, startY: e.clientY, origX: card.x, origY: card.y })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return
    const dx = e.clientX - dragState.startX
    const dy = e.clientY - dragState.startY
    setCards(prev => prev.map(c => c.id === dragState.id ? { ...c, x: dragState.origX + dx, y: dragState.origY + dy } : c))
  }, [dragState])

  const handleMouseUp = useCallback(() => {
    setDragState(null)
  }, [])

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState, handleMouseMove, handleMouseUp])

  const updateContent = (id: string, content: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, content } : c))
  }

  const updateImageUrl = (id: string, url: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, imageUrl: url, content: url || 'Paste image URL' } : c))
  }

  const deleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
  }

  const bringToFront = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, zIndex: nextZRef.current++ } : c))
  }

  const addTodo = (cardId: string) => {
    if (!newTodoText.trim()) return
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, todos: [...(c.todos || []), { id: `todo-${Date.now()}`, text: newTodoText.trim(), done: false }] } : c))
    setNewTodoText('')
  }

  const toggleTodo = (cardId: string, todoId: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, todos: c.todos?.map(t => t.id === todoId ? { ...t, done: !t.done } : t) } : c))
  }

  const deleteTodo = (cardId: string, todoId: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, todos: c.todos?.filter(t => t.id !== todoId) } : c))
  }

  const tools = [
    { key: 'note', label: 'Note', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { key: 'link', label: 'Link', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { key: 'todo', label: 'To-Do', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { key: 'column', label: 'Column', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7' },
    { key: 'image', label: 'Image', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ]

  return (
    <div className="flex-1 relative" style={{ backgroundColor: '#CACDD7' }}>
      {/* Floating bottom toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-2 rounded-2xl border shadow-lg" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}>
        {tools.map(tool => (
          <button
            key={tool.key}
            onClick={() => addCard(tool.key as WorkspaceCard['type'])}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
            style={{
              backgroundColor: activeTool === tool.key ? 'rgba(255,89,0,0.1)' : 'transparent',
              color: activeTool === tool.key ? '#FF5900' : '#3E4048',
            }}
            onMouseEnter={e => { if (activeTool !== tool.key) { e.currentTarget.style.backgroundColor = 'rgba(202,205,215,0.3)' } }}
            onMouseLeave={e => { if (activeTool !== tool.key) { e.currentTarget.style.backgroundColor = 'transparent' } }}
            title={tool.label}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} /></svg>
            <span className="text-[9px] font-medium">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="absolute inset-0 overflow-hidden">
        {/* Grid dots background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(62,64,72,0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        {cards.map(card => (
          <div
            key={card.id}
            className="absolute rounded-xl border shadow-md theme-transition"
            style={{
              left: card.x,
              top: card.y,
              width: card.width,
              height: card.height,
              backgroundColor: '#FFFFFF',
              borderColor: '#CACDD7',
              cursor: dragState?.id === card.id ? 'grabbing' : 'grab',
              zIndex: card.zIndex || 1,
            }}
            onMouseDown={e => {
              bringToFront(card.id)
              handleMouseDown(e, card)
            }}
          >
            {/* Delete button */}
            <button
              onClick={(e) => { e.stopPropagation(); deleteCard(card.id) }}
              className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}
              title="Delete"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Note Card */}
            {card.type === 'note' && (
              <div className="p-3 h-full flex flex-col">
                <textarea
                  value={card.content}
                  onChange={e => updateContent(card.id, e.target.value)}
                  className="flex-1 w-full resize-none outline-none text-sm"
                  style={{ color: '#1B1A1C', backgroundColor: 'transparent' }}
                  onMouseDown={e => e.stopPropagation()}
                />
              </div>
            )}

            {/* Link Card */}
            {card.type === 'link' && (
              <div className="p-3 h-full flex flex-col">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: 'rgba(255,89,0,0.1)' }}>
                  <svg className="w-4 h-4" style={{ color: '#FF5900' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <input
                  type="text"
                  value={card.content}
                  onChange={e => updateContent(card.id, e.target.value)}
                  className="w-full text-sm outline-none border-b pb-1 mb-2"
                  style={{ color: '#1B1A1C', borderColor: '#CACDD7', backgroundColor: 'transparent' }}
                  placeholder="https://..."
                  onMouseDown={e => e.stopPropagation()}
                />
                {card.content && card.content !== 'https://' && (
                  <a href={card.content} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: '#FF5900' }} onClick={e => e.stopPropagation()}>
                    Open link &rarr;
                  </a>
                )}
              </div>
            )}

            {/* To-Do Card */}
            {card.type === 'todo' && (
              <div className="p-3 h-full flex flex-col">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTodoText}
                    onChange={e => setNewTodoText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addTodo(card.id) } }}
                    className="flex-1 px-2 py-1 text-sm border rounded-lg outline-none"
                    style={{ borderColor: '#CACDD7', color: '#1B1A1C' }}
                    placeholder="Add a task..."
                    onMouseDown={e => e.stopPropagation()}
                  />
                  <button onClick={(e) => { e.stopPropagation(); addTodo(card.id) }} className="px-2 py-1 rounded-lg text-white text-sm" style={{ backgroundColor: '#FF5900' }} onMouseDown={e => e.stopPropagation()}>Add</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {card.todos?.map(todo => (
                    <div key={todo.id} className="flex items-center gap-2 group" onMouseDown={e => e.stopPropagation()}>
                      <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(card.id, todo.id)} className="w-3.5 h-3.5 rounded cursor-pointer" style={{ accentColor: '#FF5900' }} />
                      <span className={`flex-1 text-sm truncate ${todo.done ? 'line-through' : ''}`} style={{ color: todo.done ? '#CACDD7' : '#1B1A1C' }}>{todo.text}</span>
                      <button onClick={() => deleteTodo(card.id, todo.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50">
                        <svg className="w-3 h-3" style={{ color: '#EF4444' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {(!card.todos || card.todos.length === 0) && (
                    <p className="text-xs" style={{ color: '#CACDD7' }}>No tasks yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Column Card */}
            {card.type === 'column' && (
              <div className="p-3 h-full flex flex-col">
                <input
                  type="text"
                  value={card.content}
                  onChange={e => updateContent(card.id, e.target.value)}
                  className="w-full text-sm font-semibold outline-none border-b pb-2 mb-2"
                  style={{ color: '#1B1A1C', borderColor: '#CACDD7', backgroundColor: 'transparent' }}
                  onMouseDown={e => e.stopPropagation()}
                />
                <div className="flex-1 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(202,205,215,0.15)' }}>
                  <p className="text-xs" style={{ color: '#CACDD7' }}>Drag items here</p>
                </div>
              </div>
            )}

            {/* Image Card */}
            {card.type === 'image' && (
              <div className="p-3 h-full flex flex-col">
                {card.imageUrl ? (
                  <div className="flex-1 relative rounded-lg overflow-hidden mb-2" style={{ backgroundColor: 'rgba(202,205,215,0.1)' }}>
                    <img src={card.imageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                ) : null}
                <input
                  type="text"
                  value={card.imageUrl || ''}
                  onChange={e => updateImageUrl(card.id, e.target.value)}
                  className="w-full text-xs outline-none border rounded-lg px-2 py-1"
                  style={{ color: '#1B1A1C', borderColor: '#CACDD7', backgroundColor: 'rgba(202,205,215,0.08)' }}
                  placeholder="Paste image URL..."
                  onMouseDown={e => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}