import { useRef, useState, useCallback, useEffect } from 'react'
import { useAgentChat } from '../../hooks/useAgentChat.js'
import { useResizablePanel } from '../../hooks/useResizablePanel.js'
import { ChatMessage } from './ChatMessage.js'
import { ChatInput } from './ChatInput.js'
import { ResizableHandle } from './ResizableHandle.js'

export function AgentChatPanel() {
  const { messages, isLoading, sendMessage } = useAgentChat({
    activeTab: 'overview',
    lastUpdated: new Date().toISOString(),
  })
  const { width, isCollapsed, setWidth, toggleCollapse } = useResizablePanel()
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      // Capture initial mouse position on first mousemove to avoid needing mousedown event
      if (startX.current === 0) {
        startX.current = e.clientX
        return
      }
      const delta = e.clientX - startX.current
      setWidth(startWidth.current + delta)
    },
    [isDragging, setWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const onMouseDown = useCallback(() => {
    if (isCollapsed) return
    setIsDragging(true)
    startX.current = 0
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp, { once: true })
  }, [isCollapsed, width, handleMouseMove, handleMouseUp])

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [handleMouseMove, handleMouseUp])

  if (isCollapsed) {
    return (
      <div data-testid="chat-panel" className="flex flex-col h-screen w-10 bg-card border-r border-border relative">
        {/* Primary accent line on left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
        <button
          onClick={toggleCollapse}
          aria-label="展开面板"
          className="flex-1 flex items-center justify-center hover:bg-muted transition-colors duration-150"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      // setWidth clamps to [280, 600] in useResizablePanel
      data-testid="chat-panel"
      className="flex flex-col h-screen bg-card border-r border-border relative"
      style={{ width: `${width}px`, transition: isDragging ? 'none' : 'width 0.2s ease-out' }}
    >
      {/* Primary accent line on left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />

      <div className="flex items-center justify-between px-4 py-3 border-b border-border ml-[2px]">
        <h2 className="text-sm font-semibold">AI Copilot</h2>
        <button
          onClick={toggleCollapse}
          aria-label="收起面板"
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 ml-[2px]" style={{ backgroundColor: '#0a0a0c' }}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-card border border-border rounded-xl px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ml-[2px]">
        <ChatInput onSubmit={sendMessage} isLoading={isLoading} />
      </div>

      <ResizableHandle onResizeStart={onMouseDown} />
    </div>
  )
}
