import { useAgentChat } from '../../hooks/useAgentChat.js';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';

export function AgentChatPanel() {
  const { messages, isLoading, sendMessage } = useAgentChat({
    activeTab: 'overview',
    lastUpdated: new Date().toISOString(),
  });

  return (
    <div className="flex flex-col h-full w-[380px] bg-slate-50 dark:bg-slate-900 border-r border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">AI Copilot</h2>
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

      <ChatInput onSubmit={sendMessage} isLoading={isLoading} />
    </div>
  );
}
