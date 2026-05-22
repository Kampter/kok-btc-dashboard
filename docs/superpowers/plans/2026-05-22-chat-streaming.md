# Chat Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通前端 ←→ 后端 ←→ Moonshot API 的完整流式对话通路，使用 tRPC SSE subscription，本期不涉及工具调用。

**Architecture:** 后端将 `chat.stream` 从 mutation 改为 subscription，通过 async generator 逐段推送文本；前端 tRPC client 启用 `splitLink`（subscription 走 `httpSubscriptionLink`），`useAgentChat` hook 用 `useSubscription` 消费流事件，组件渲染逐字打字机效果。

**Tech Stack:** NestJS, tRPC v11, OpenAI SDK, React 19, TanStack Query

---

## File Structure

### 修改文件

| 文件 | 职责 |
|------|------|
| `apps/api/src/chat/chat.router.ts` | `.mutation()` → `.subscription()` |
| `apps/api/src/chat/chat.service.ts` | 流末尾追加 `yield { type: 'done' }` |
| `apps/api/src/chat/prompts/system-prompt.ts` | 完善 system prompt 内容 |
| `apps/web/app/lib/trpc.ts` | `httpBatchLink` → `splitLink` + `httpSubscriptionLink` |
| `apps/web/app/hooks/useAgentChat.ts` | 移除 mock，接入真实的 `useSubscription` |

---

## Task 1: 后端 Chat Router — mutation 改 subscription

**Files:**
- Modify: `apps/api/src/chat/chat.router.ts`

- [ ] **Step 1: 修改 procedure 类型**

```typescript
import { Injectable } from '@nestjs/common'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { ChatService } from './chat.service'

const t = initTRPC.create()

@Injectable()
export class ChatRouter {
  constructor(private readonly chatService: ChatService) {}

  public readonly router = t.router({
    stream: t.procedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          ),
          context: z.object({
            activeTab: z.string(),
            timeRange: z.string().optional(),
            filters: z.record(z.string(), z.unknown()).optional(),
            lastUpdated: z.string(),
          }),
        }),
      )
      .subscription(async function* (this: ChatRouter, { input }) {
        yield* this.chatService.streamChat(input.messages, input.context)
      }),
  })
}
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/chat/chat.router.ts
git commit -m "feat(api): change chat.stream from mutation to subscription"
```

---

## Task 2: 后端 Chat Service — 追加 done 事件 + 完善 system prompt

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/chat/prompts/system-prompt.ts`

- [ ] **Step 1: 完善 system prompt**

```typescript
export interface DashboardContext {
  activeTab: string
  timeRange?: string
  filters?: Record<string, unknown>
  lastUpdated: string
}

export function buildSystemPrompt(context: DashboardContext): string {
  return `你是 Kok Dashboard 的投资分析助手，专注于 BTC 期权数据分析。

当前用户视图：${context.activeTab}
数据更新时间：${context.lastUpdated}

回答要求：
- 基于数据给出分析，避免泛泛而谈
- 关键指标用加粗标注
- 必要时给出风险提示`
}
```

- [ ] **Step 2: Chat Service 追加 done 事件**

```typescript
import { Injectable } from '@nestjs/common'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { buildSystemPrompt, type DashboardContext } from './prompts/system-prompt'

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

@Injectable()
export class ChatService {
  private openai: OpenAI | null = null

  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    context: DashboardContext,
  ): AsyncGenerator<StreamEvent> {
    const apiKey = process.env.MOONSHOT_API_KEY
    if (!apiKey) {
      yield { type: 'error', message: 'MOONSHOT_API_KEY environment variable is not set' }
      return
    }

    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: 'https://api.moonshot.cn/v1',
      })
    }

    const systemPrompt = buildSystemPrompt(context)

    const chatMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m): ChatCompletionMessageParam => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    try {
      const stream = await this.openai.chat.completions.create({
        model: 'kimi-k2.6',
        messages: chatMessages,
        stream: true,
        max_tokens: 4096,
      })

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content
        if (text) {
          yield { type: 'text', text }
        }
      }

      yield { type: 'done' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      yield { type: 'error', message }
    }
  }
}
```

- [ ] **Step 3: 更新集成测试中的类型**

检查 `chat.service.integration.test.ts` 是否需要更新以适配新的 `StreamEvent` 类型。

- [ ] **Step 4: 类型检查 + 测试**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

Run: `cd apps/api && pnpm test -- chat`
Expected: 所有 chat 相关测试通过

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/chat/
git commit -m "feat(api): add StreamEvent type and done signal, improve system prompt"
```

---

## Task 3: 前端 tRPC Client — 启用 httpSubscriptionLink

**Files:**
- Modify: `apps/web/app/lib/trpc.ts`

- [ ] **Step 1: 修改 tRPC client 配置**

```typescript
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { QueryClient } from '@tanstack/react-query'
import type { AppRouter } from '@kok/shared-types'

const API_URL = typeof window !== 'undefined'
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3000/trpc')
  : 'http://localhost:3000/trpc'

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: API_URL,
      }),
      false: httpBatchLink({
        url: API_URL,
      }),
    }),
  ],
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: true,
      retry: 3,
    },
  },
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/lib/trpc.ts
git commit -m "feat(web): enable httpSubscriptionLink for tRPC SSE streaming"
```

---

## Task 4: 前端 useAgentChat Hook — 接入真实 subscription

**Files:**
- Modify: `apps/web/app/hooks/useAgentChat.ts`

- [ ] **Step 1: 重写 useAgentChat hook**

```typescript
import { useState, useCallback, useRef } from 'react'
import { trpcClient } from '../lib/trpc.js'

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
  const currentStreamRef = useRef('')

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
      }

      const allMessages = [...messages, userMsg]
      setMessages(allMessages)
      setIsLoading(true)
      setError(null)
      currentStreamRef.current = ''

      // 创建 assistant 占位消息
      const assistantId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '' },
      ])

      try {
        const subscription = trpcClient.chat.stream.subscribe(
          {
            messages: allMessages.map(({ id, ...m }) => m),
            context,
          },
          {
            onData(event) {
              if (event.type === 'text') {
                currentStreamRef.current += event.text
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: currentStreamRef.current }
                      : msg,
                  ),
                )
              } else if (event.type === 'error') {
                setError(event.message)
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: `错误：${event.message}` }
                      : msg,
                  ),
                )
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

        // 返回 unsubscribe 函数供外部使用
        return () => subscription.unsubscribe()
      } catch (err) {
        setError(err instanceof Error ? err.message : '发送失败')
        setIsLoading(false)
      }
    },
    [messages, context],
  )

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/hooks/useAgentChat.ts
git commit -m "feat(web): wire useAgentChat to real tRPC SSE subscription"
```

---

## Task 5: 端到端验证

**Files:**
- 无新增/修改文件

- [ ] **Step 1: 启动后端**

```bash
cd apps/api
pnpm dev
```
Expected: NestJS 启动成功，端口 3000

- [ ] **Step 2: 启动前端（新终端）**

```bash
cd apps/web
pnpm dev
```
Expected: Vite 启动成功，端口 5173

- [ ] **Step 3: 打开浏览器验证**

访问 `http://localhost:5173`

Expected:
- 页面正常加载，左右分栏布局
- 在左侧 Chat Panel 输入问题（如"BTC 当前价格是多少"）
- 点击发送，看到逐字出现的 AI 回复（不是 mock 占位文本）
- 回复内容与 Moonshot API 返回一致

- [ ] **Step 4: 运行测试**

```bash
# 后端测试
cd apps/api && pnpm test

# 前端测试
cd apps/web && pnpm test
```
Expected: 所有测试通过

- [ ] **Step 5: 运行类型检查**

```bash
pnpm typecheck
```
Expected: 全量无类型错误

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete chat streaming with tRPC SSE subscription"
```

---

## Self-Review

### Spec Coverage

| Spec 要求 | 对应 Task |
|---|---|
| tRPC SSE subscription 后端 | Task 1, 2 |
| StreamEvent 类型约定 | Task 2 |
| httpSubscriptionLink 前端 | Task 3 |
| useAgentChat 接入真实 subscription | Task 4 |
| 端到端流式对话 | Task 5 |

### Placeholder Scan

- 无 "TBD"、"TODO"、"implement later"
- 所有步骤包含实际代码或命令
- 无 "Similar to Task N" 引用

### Type Consistency

- `StreamEvent` 类型在后端 `chat.service.ts` 定义，通过 tRPC 类型推导传递到前端
- `DashboardContext` 前后端定义一致
- `httpSubscriptionLink` 条件判断使用 `op.type === 'subscription'`，与 tRPC v11 API 一致
