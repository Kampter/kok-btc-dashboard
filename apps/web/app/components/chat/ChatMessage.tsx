import { memo } from 'react'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export const ChatMessage = memo(function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-muted text-foreground'
            : 'bg-card text-foreground border border-border'
        }`}
      >
        {content}
      </div>
    </div>
  )
})
