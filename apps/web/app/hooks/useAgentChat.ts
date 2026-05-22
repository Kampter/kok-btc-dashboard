import { useState, useCallback, useRef, useEffect } from 'react'
import { trpcClient } from '../lib/trpc.js'
import type { StreamEvent } from '@kok/shared-types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface DashboardContext {
  activeTab: string
  timeRange?: string
  filters?: Record<string, unknown>
  lastUpdated: string
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function useAgentChat(context: DashboardContext) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '我是你的投资分析助手。你可以问我关于当前市场数据的问题。',
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef(messages)
  const subscriptionRef = useRef<{
    unsubscribe: () => void
  } | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe()
    }
  }, [])

  const sendMessage = useCallback(
    (content: string) => {
      // Cleanup previous subscription before creating a new one
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null

      const userMsgId = generateId()
      const assistantId = generateId()

      const userMsg: Message = {
        id: userMsgId,
        role: 'user',
        content,
      }

      const allMessages = [...messagesRef.current, userMsg]
      setMessages(allMessages)
      setIsLoading(true)
      setError(null)

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '' },
      ])

      const historyForApi = allMessages.map(({ id, ...m }) => m)

      subscriptionRef.current = trpcClient.chat.stream.subscribe(
        {
          messages: historyForApi,
          context,
        },
        {
          onData(event: StreamEvent) {
            if (event.type === 'text') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content + event.text }
                    : msg,
                ),
              )
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: `错误：${event.message}` }
                    : msg,
                ),
              )
              setError(event.message)
              setIsLoading(false)
            } else if (event.type === 'done') {
              setIsLoading(false)
            }
          },
          onError(err) {
            setError(err.message)
            setIsLoading(false)
          },
          onComplete() {
            setIsLoading(false)
          },
        },
      )
    },
    [context],
  )

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  }
}
