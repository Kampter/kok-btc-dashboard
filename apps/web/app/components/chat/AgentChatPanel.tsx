import { useState } from 'react';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function AgentChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '我是你的投资分析助手。你可以问我关于当前市场数据的问题。',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (userMessage: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '（AI 响应将在此显示，当前为框架占位）',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-[380px] bg-slate-50 dark:bg-slate-900 border-r border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">🤖 AI Copilot</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
