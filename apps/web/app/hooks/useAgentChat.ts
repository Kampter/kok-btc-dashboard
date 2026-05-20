import { useState, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface DashboardContext {
  activeTab: string;
  timeRange?: string;
  filters?: Record<string, unknown>;
  lastUpdated: string;
}

export function useAgentChat(context: DashboardContext) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '我是你的投资分析助手。你可以问我关于当前市场数据的问题。',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        // TODO: 后续迭代接入真实的 tRPC streaming mutation
        await new Promise((resolve) => setTimeout(resolve, 800));

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `收到问题："${content}"\n\n（此处将展示 AI 分析结果，当前为框架占位。后续迭代将接入真实的 Claude 流式响应。）`,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setError(err instanceof Error ? err.message : '发送失败');
      } finally {
        setIsLoading(false);
      }
    },
    [context],
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  };
}
