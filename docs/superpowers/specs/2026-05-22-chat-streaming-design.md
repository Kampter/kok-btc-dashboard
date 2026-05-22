# Chat Streaming 设计文档

## 目标

实现前端与 Moonshot API（kimi-k2.6）之间的完整流式对话通路，**本期不涉及工具调用（ReAct）**。

成功标准：用户在左侧 Chat Panel 输入问题，逐字看到 AI 回复，无 mock 响应。

---

## 非目标

- 工具调用（ReAct 循环）
- 对话历史持久化
- 多会话管理
- 用户认证
- 思考过程展示（reasoning）

---

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│  前端 (React)                                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ AgentChatPanel                                            │ │
│  │  └─ useAgentChat (useSubscription)                        │ │
│  │      └─ trpc.chat.stream.useSubscription({...})           │ │
│  │          ┌─ onData(chunk)  → 拼接消息                     │ │
│  │          ┌─ onError(err)   → 显示错误                     │ │
│  │          └─ onComplete()   → 停止 loading 状态            │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │ SSE (text/event-stream)
┌──────────────────────────────▼──────────────────────────────────┐
│  后端 (NestJS + tRPC v11)                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ /trpc/chat.stream (subscription)                          │ │
│  │  └─ ChatRouter                                            │ │
│  │      └─ ChatService.streamChat()                          │ │
│  │          ┌─ buildSystemPrompt(context)                    │ │
│  │          └─ openai.chat.completions.create({stream:true}) │ │
│  │              └─ async generator → yield chunk             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 流事件类型（前后端约定）

```typescript
type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' }
```

| 事件 | 含义 | 触发时机 |
|------|------|----------|
| `text` | 文本片段 | Moonshot 返回每个 chunk 的 delta.content |
| `error` | 错误信息 | API Key 缺失、网络超时、API 调用失败 |
| `done` | 流结束 | 所有 chunk 消费完毕，正常结束 |

---

## 后端改动

### 1. Chat Router：`mutation` → `subscription`

```typescript
// apps/api/src/chat/chat.router.ts
stream: t.procedure
  .input(z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })),
    context: z.object({
      activeTab: z.string(),
      timeRange: z.string().optional(),
      filters: z.record(z.unknown()).optional(),
      lastUpdated: z.string(),
    }),
  }))
  .subscription(async function* (this: ChatRouter, { input }) {
    yield* this.chatService.streamChat(input.messages, input.context)
  })
```

### 2. Chat Service：追加 `done` 事件

```typescript
// apps/api/src/chat/chat.service.ts
async *streamChat(...) {
  // ... 现有逻辑
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) {
      yield { type: 'text' as const, text }
    }
  }

  yield { type: 'done' as const }
}
```

### 3. System Prompt：精简但可用

```typescript
// apps/api/src/chat/prompts/system-prompt.ts
export function buildSystemPrompt(context: DashboardContext): string {
  return `你是 Kok Dashboard 的投资分析助手，专注于 BTC 期权数据分析。

当前用户视图：${context.activeTab}
数据更新时间：${context.lastUpdated}

回答要求：
- 基于数据给出分析，避免泛泛而谈
- 关键指标用加粗标注
- 必要时给出风险提示`;
}
```

---

## 前端改动

### 1. tRPC Client：启用 `httpSubscriptionLink`

```typescript
// apps/web/app/lib/trpc.ts
import { splitLink, httpSubscriptionLink } from '@trpc/client'

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
```

### 2. useAgentChat Hook：接入真实 subscription

```typescript
// apps/web/app/hooks/useAgentChat.ts
export function useAgentChat(context: DashboardContext) {
  const [messages, setMessages] = useState<Message[]>([...])
  const [isLoading, setIsLoading] = useState(false)
  const [currentStream, setCurrentStream] = useState('')

  const subscription = trpc.chat.stream.useSubscription(
    { messages: [...], context },
    {
      enabled: false, // 手动触发
      onData(event) {
        if (event.type === 'text') {
          setCurrentStream((prev) => prev + event.text)
        } else if (event.type === 'error') {
          // 追加错误消息
        } else if (event.type === 'done') {
          setIsLoading(false)
        }
      },
      onError(err) {
        setIsLoading(false)
      },
    },
  )

  const sendMessage = useCallback((content: string) => {
    // 追加用户消息，重置流状态，启用 subscription
  }, [])

  return { messages, isLoading, sendMessage }
}
```

**注意**：tRPC v11 的 `useSubscription` 不支持动态参数。用户发送新消息后需要**重新订阅**。处理方式：用一个 `chatId`（基于时间戳）作为 subscription 的依赖，每次发送消息时更新 `chatId`。

### 3. 输入参数设计

subscription 的参数需要在创建时就确定，不能像 mutation 那样 `mutate(input)`。解决方案：

```typescript
// 将消息和上下文作为 subscription 的 input
// 每次 sendMessage 时通过状态变更触发新的 subscription
const [chatInput, setChatInput] = useState<ChatInput | null>(null)

const subscription = trpc.chat.stream.useSubscription(
  chatInput ?? { messages: [], context: defaultContext },
  { enabled: chatInput !== null, ... }
)

const sendMessage = (content: string) => {
  // 更新 chatInput，触发新的 subscription
  setChatInput({ messages: [...allMessages], context })
}
```

---

## 错误处理

| 场景 | 后端行为 | 前端行为 |
|------|----------|----------|
| API Key 缺失 | yield `{ type: 'error', message: '...' }` | 显示错误消息，停止 loading |
| Moonshot API 超时/失败 | catch → yield error 事件 | 显示错误消息，停止 loading |
| SSE 连接中断 | tRPC 自动重连 | 显示"连接中..."，重连后恢复 |
| 用户主动中断 | 前端 unsubscribe() | 立即停止，保留已收到的内容 |

---

## 测试策略

| 层级 | 测试内容 |
|------|----------|
| 单元 | ChatService `streamChat` — 验证 API Key 缺失时 yield error |
| 集成 | tRPC subscription endpoint — 验证 SSE 流格式正确 |
| E2E | Chat Panel — 输入消息，验证逐字显示 |

---

## 依赖变更

无需新增依赖。tRPC v11.17.0 已包含所有需要的功能：
- `@trpc/server` — 支持 `subscription` procedure
- `@trpc/client` — 支持 `splitLink` + `httpSubscriptionLink`

---

## 风险

1. **tRPC `useSubscription` 参数不可变**：每次发送消息都需要重新建立 SSE 连接（HTTP/2 多路复用可缓解开销）
2. **NestJS SSE 连接保持**：Express adapter 默认支持 SSE，无需额外配置
3. **CORS 对 SSE 的影响**：当前 CORS 配置已包含 `credentials: true`，SSE 连接会携带 cookie
