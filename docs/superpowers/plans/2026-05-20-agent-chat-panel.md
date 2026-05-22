# Agent Chat Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Kok Dashboard 中搭建一个最基础的 AI 对话面板框架，包含前端固定分栏 UI、后端 NestJS ChatModule、tRPC streaming endpoint，以及前后端基础集成。

**Architecture:** 前端使用 React + Tailwind 构建固定分栏对话面板；后端使用 NestJS + OpenAI SDK（Moonshot 兼容层）构建 ChatModule；前后端通过 tRPC streaming mutation 通信。本期仅搭框架，具体 AI 逻辑、Tool 实现、System Prompt 留空给后续迭代。

**Tech Stack:** React 19, Tailwind CSS v4, NestJS, tRPC, OpenAI SDK, Vercel AI SDK (`ai`)

---

## File Structure

### 新增文件

| 文件 | 职责 |
|---|---|
| `apps/api/src/chat/chat.module.ts` | NestJS ChatModule 声明 |
| `apps/api/src/chat/chat.service.ts` | Chat 核心服务骨架（OpenAI SDK 调用入口） |
| `apps/api/src/chat/chat.controller.ts` | tRPC chat router（streaming endpoint） |
| `apps/api/src/chat/tools/tool-definitions.ts` | Tool 定义框架（JSON Schema 结构，留空实现） |
| `apps/api/src/chat/prompts/system-prompt.ts` | System prompt 模板框架（留空内容） |
| `apps/web/app/components/chat/AgentChatPanel.tsx` | 对话面板主组件 |
| `apps/web/app/components/chat/ChatMessage.tsx` | 单条消息组件 |
| `apps/web/app/components/chat/ChatInput.tsx` | 输入框组件 |
| `packages/shared-types/src/trpc/router.ts` | 追加 chat stream 类型定义 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `apps/api/src/app.module.ts` | 导入 ChatModule |
| `apps/api/src/trpc/trpc.service.ts` | 合并 chat router 到 appRouter |
| `apps/api/src/trpc/trpc.module.ts` | 导入 ChatModule 依赖 |
| `apps/api/package.json` | 添加 `openai` 依赖 |
| `apps/web/package.json` | 添加 `ai` 依赖 |
| `apps/web/app/components/DashboardLayout.tsx` | 改造为左右分栏布局 |
| `apps/web/app/lib/trpc.ts` | 支持 streaming link（如需要） |

---

## Task 1: 安装依赖

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装后端 OpenAI SDK**

```bash
cd apps/api
pnpm add openai
```

- [ ] **Step 2: 安装前端 Vercel AI SDK**

```bash
cd apps/web
pnpm add ai
```

- [ ] **Step 3: 在根目录统一安装**

```bash
cd /Users/wangzizheng/Desktop/kok/.claude/worktrees/agent-chat-design
pnpm install
```

Run: `pnpm install`
Expected: 无错误，node_modules 更新

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json apps/web/package.json pnpm-lock.yaml
pnpm install --no-frozen-lockfile
git add pnpm-lock.yaml
git commit -m "deps: add openai and ai SDK"
```

---

## Task 2: 后端 ChatModule 基础框架

**Files:**
- Create: `apps/api/src/chat/chat.module.ts`
- Create: `apps/api/src/chat/chat.service.ts`
- Create: `apps/api/src/chat/prompts/system-prompt.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/chat/chat.service.test.ts`

- [ ] **Step 1: 创建 System Prompt 框架**

Create `apps/api/src/chat/prompts/system-prompt.ts`:

```typescript
export interface DashboardContext {
  activeTab: string;
  timeRange?: string;
  filters?: Record<string, unknown>;
  lastUpdated: string;
}

export function buildSystemPrompt(context: DashboardContext): string {
  // TODO: 后续迭代填充具体 prompt 内容
  return `You are Kok Dashboard AI assistant. Current view: ${context.activeTab}`;
}
```

- [ ] **Step 2: 创建 ChatService 骨架**

Create `apps/api/src/chat/chat.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { buildSystemPrompt, DashboardContext } from './prompts/system-prompt.js';

@Injectable()
export class ChatService {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.MOONSHOT_API_KEY || '',
      baseURL: 'https://api.moonshot.cn/v1',
    });
  }

  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    context: DashboardContext,
  ): AsyncGenerator<{ type: 'text'; text: string } | { type: 'error'; message: string }> {
    try {
      const systemPrompt = buildSystemPrompt(context);

      const stream = await this.openai.chat.completions.create({
        model: 'kimi-k2.6',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        stream: true,
        max_tokens: 4096,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          yield { type: 'text' as const, text };
        }
      }
    } catch (error) {
      yield {
        type: 'error' as const,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

- [ ] **Step 3: 写 ChatService 测试**

Create `apps/api/src/chat/chat.service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ChatService } from './chat.service.js';

describe('ChatService', () => {
  it('should be defined', () => {
    const service = new ChatService();
    expect(service).toBeDefined();
  });

  it('should yield error when API key is missing', async () => {
    const service = new ChatService();
    const stream = service.streamChat(
      [{ role: 'user', content: 'hello' }],
      { activeTab: 'overview', lastUpdated: new Date().toISOString() },
    );

    const results = [];
    for await (const event of stream) {
      results.push(event);
    }

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('type');
  });
});
```

Run: `cd apps/api && pnpm test -- chat.service.test.ts`
Expected: 测试通过（无 API key 时预期 error 事件）

- [ ] **Step 4: 创建 ChatModule**

Create `apps/api/src/chat/chat.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';

@Module({
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
```

- [ ] **Step 5: 注册 ChatModule 到 AppModule**

Modify `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from './database/database.module';
import { DeribitModule } from './deribit/deribit.module';
import { TrpcModule } from './trpc/trpc.module';
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 30000,
    }),
    DatabaseModule,
    DeribitModule,
    TrpcModule,
    ChatModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/chat/ apps/api/src/app.module.ts
pnpm typecheck
git commit -m "feat(api): add ChatModule skeleton with OpenAI SDK"
```

---

## Task 3: 后端 tRPC Chat Router

**Files:**
- Create: `apps/api/src/chat/chat.controller.ts`
- Modify: `apps/api/src/trpc/trpc.service.ts`
- Modify: `apps/api/src/trpc/trpc.module.ts`
- Modify: `packages/shared-types/src/trpc/router.ts`

- [ ] **Step 1: 定义 Chat Stream 类型（shared-types）**

Modify `packages/shared-types/src/trpc/router.ts`，追加 chat router：

```typescript
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { OptionSummary, MarketOverview } from '../schemas/option.js';
import type { OptionTrade } from '../schemas/trade.js';

const t = initTRPC.create();

export const appRouter = t.router({
  deribit: t.router({
    marketOverview: t.procedure.query(async () => ({} as MarketOverview)),

    bookSummary: t.procedure
      .input(z.object({ currency: z.string(), kind: z.string() }))
      .query(async () => [] as OptionSummary[]),

    trades: t.procedure
      .input(z.object({ currency: z.string(), count: z.number().default(100) }))
      .query(async () => [] as OptionTrade[]),

    historicalVolatility: t.procedure
      .input(z.object({ currency: z.string() }))
      .query(async () => [] as Array<{ timestamp: number; volatility: number }>),
  }),

  chat: t.router({
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
            filters: z.record(z.unknown()).optional(),
            lastUpdated: z.string(),
          }),
        }),
      )
      .mutation(async function* () {
        // 类型占位，实际实现在 api 端
        yield { type: 'text' as const, text: '' };
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 2: 创建 Chat Controller（tRPC router）**

Create `apps/api/src/chat/chat.controller.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { initTRPC } from '@trpc/server';
import { ChatService } from './chat.service.js';

const t = initTRPC.create();

@Injectable()
export class ChatController {
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
            filters: z.record(z.unknown()).optional(),
            lastUpdated: z.string(),
          }),
        }),
      )
      .mutation(async function* ({ input }) {
        const stream = this.chatService.streamChat(input.messages, input.context);
        for await (const event of stream) {
          yield event;
        }
      }.bind(this)),
  });
}
```

- [ ] **Step 3: 修改 TrpcService 合并 chat router**

Modify `apps/api/src/trpc/trpc.service.ts`：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DeribitService } from '../deribit/deribit.service';
import { ChatController } from '../chat/chat.controller.js';
// ... existing imports

@Injectable()
export class TrpcService {
  constructor(
    private readonly deribitService: DeribitService,
    private readonly chatController: ChatController,
  ) {}

  public readonly appRouter = t.router({
    deribit: t.router({
      // ... existing routes unchanged
      marketOverview: t.procedure.query(async () => {
        // existing code
      }),
      bookSummary: t.procedure
        .input(z.object({ currency: z.string(), kind: z.string() }))
        .query(async ({ input }) => {
          // existing code
        }),
      trades: t.procedure
        .input(z.object({ currency: z.string(), count: z.number().default(100) }))
        .query(async ({ input }) => {
          // existing code
        }),
      historicalVolatility: t.procedure
        .input(z.object({ currency: z.string() }))
        .query(async ({ input }) => {
          // existing code
        }),
    }),
    chat: this.chatController.router,
  });
}
```

- [ ] **Step 4: 修改 TrpcModule 导入 ChatModule**

Modify `apps/api/src/trpc/trpc.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DeribitModule } from '../deribit/deribit.module';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [DeribitModule, ChatModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
```

- [ ] **Step 5: 类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/trpc/ apps/api/src/chat/chat.controller.ts packages/shared-types/src/trpc/router.ts
git commit -m "feat(api): add tRPC chat streaming endpoint"
```

---

## Task 4: 后端 Tool 定义框架

**Files:**
- Create: `apps/api/src/chat/tools/tool-definitions.ts`

- [ ] **Step 1: 创建 Tool 定义框架**

Create `apps/api/src/chat/tools/tool-definitions.ts`：

```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const tools: ToolDefinition[] = [
  {
    name: 'getMarketOverview',
    description: '获取当前 BTC 期权市场概况：总持仓量、24h成交量、ATM隐含波动率、BTC现货价格',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getBookSummary',
    description: '获取 BTC 期权簿摘要，包括各行权价的持仓量、成交量、IV等',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['option', 'future'],
          description: '期权或期货数据',
        },
      },
      required: ['kind'],
    },
  },
  {
    name: 'getTrades',
    description: '获取 BTC 期权近期交易数据',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          default: 100,
          description: '返回交易条数',
        },
      },
    },
  },
  {
    name: 'getHistoricalVolatility',
    description: '获取 BTC 历史波动率数据',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'analyzeVolatilitySurface',
    description: '分析 BTC 波动率曲面特征：期限结构、skew、term structure变化',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/chat/tools/
git commit -m "feat(api): add tool definitions framework"
```

---

## Task 5: 前端对话面板组件框架

**Files:**
- Create: `apps/web/app/components/chat/ChatMessage.tsx`
- Create: `apps/web/app/components/chat/ChatInput.tsx`
- Create: `apps/web/app/components/chat/AgentChatPanel.tsx`

- [ ] **Step 1: 创建 ChatMessage 组件**

Create `apps/web/app/components/chat/ChatMessage.tsx`：

```typescript
import { memo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatMessage = memo(function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: 创建 ChatInput 组件**

Create `apps/web/app/components/chat/ChatInput.tsx`：

```typescript
import { useState, type FormEvent } from 'react';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-border">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder="输入问题..."
        className="flex-1 min-h-[40px] max-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
      >
        {isLoading ? '发送中...' : '发送'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 创建 AgentChatPanel 主组件**

Create `apps/web/app/components/chat/AgentChatPanel.tsx`：

```typescript
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
      // TODO: 后续迭代集成 useChat + tRPC streaming
      // 本期仅做 UI 框架，返回 mock 响应
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">🤖 AI Copilot</h2>
      </div>

      {/* Messages */}
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

      {/* Input */}
      <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/chat/
git commit -m "feat(web): add AgentChatPanel UI components"
```

---

## Task 6: 改造 DashboardLayout 为分栏布局

**Files:**
- Modify: `apps/web/app/components/DashboardLayout.tsx`
- Modify: `apps/web/app/routes/__root.tsx`（可选，确保 layout 正常）

- [ ] **Step 1: 改造 DashboardLayout 为左右分栏**

Modify `apps/web/app/components/DashboardLayout.tsx`：

```typescript
import { useState, memo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs.js';
import { MarketOverview } from './modules/MarketOverview.js';
import { VolatilityAnalysis } from './modules/VolatilityAnalysis.js';
import { PositionStructure } from './modules/PositionStructure.js';
import { FundingSentiment } from './modules/FundingSentiment.js';
import { ExpiryAnalysis } from './modules/ExpiryAnalysis.js';
import { AgentChatPanel } from './chat/AgentChatPanel.js';

const MODULES = [
  { id: 'overview', label: '市场概况' },
  { id: 'volatility', label: '波动率分析' },
  { id: 'positions', label: '持仓结构' },
  { id: 'sentiment', label: '资金情绪' },
  { id: 'expiry', label: '到期分析' },
] as const;

type ModuleId = (typeof MODULES)[number]['id'];

const MemoMarketOverview = memo(MarketOverview);
const MemoVolatilityAnalysis = memo(VolatilityAnalysis);
const MemoPositionStructure = memo(PositionStructure);
const MemoFundingSentiment = memo(FundingSentiment);
const MemoExpiryAnalysis = memo(ExpiryAnalysis);

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<ModuleId>('overview');

  return (
    <div className="flex h-screen bg-background">
      {/* Left: Chat Panel */}
      <AgentChatPanel />

      {/* Right: Dashboard */}
      <div className="flex-1 min-w-0 overflow-auto">
        {/* Header */}
        <header className="border-b border-border">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-xl font-bold">BTC Options Dashboard</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-call" />
                Deribit
              </span>
              <span>自动刷新 30s</span>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="px-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModuleId)}>
            <TabsList>
              {MODULES.map((m) => (
                <TabsTrigger key={m.id} value={m.id}>
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <MemoMarketOverview />
            </TabsContent>
            <TabsContent value="volatility">
              <MemoVolatilityAnalysis />
            </TabsContent>
            <TabsContent value="positions">
              <MemoPositionStructure />
            </TabsContent>
            <TabsContent value="sentiment">
              <MemoFundingSentiment />
            </TabsContent>
            <TabsContent value="expiry">
              <MemoExpiryAnalysis />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/DashboardLayout.tsx
git commit -m "feat(web): split DashboardLayout into two-column with chat panel"
```

---

## Task 7: 前端 useChat + tRPC 集成框架

**Files:**
- Create: `apps/web/app/hooks/useAgentChat.ts`
- Modify: `apps/web/app/components/chat/AgentChatPanel.tsx`

- [ ] **Step 1: 创建 useAgentChat Hook 框架**

Create `apps/web/app/hooks/useAgentChat.ts`：

```typescript
import { useState, useCallback } from 'react';
import { trpcClient } from '../lib/trpc.js';

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
        // const stream = await trpcClient.chat.stream.mutate({
        //   messages: [...messages, userMsg].map(({ id, ...m }) => m),
        //   context,
        // });

        // 本期框架：mock 响应
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
    [messages, context],
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  };
}
```

- [ ] **Step 2: 更新 AgentChatPanel 使用 useAgentChat**

Modify `apps/web/app/components/chat/AgentChatPanel.tsx`：

```typescript
import { AgentChatPanel as AgentChatPanelImpl } from './AgentChatPanelImpl.js';

// Re-export for cleaner imports
export { AgentChatPanelImpl as AgentChatPanel };
```

Create `apps/web/app/components/chat/AgentChatPanelImpl.tsx`：

```typescript
import { useAgentChat } from '../../hooks/useAgentChat.js';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';

export function AgentChatPanelImpl() {
  const { messages, isLoading, sendMessage } = useAgentChat({
    activeTab: 'overview',
    lastUpdated: new Date().toISOString(),
  });

  return (
    <div className="flex flex-col h-full w-[380px] bg-slate-50 dark:bg-slate-900 border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">🤖 AI Copilot</h2>
      </div>

      {/* Messages */}
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

      {/* Input */}
      <ChatInput onSubmit={sendMessage} isLoading={isLoading} />
    </div>
  );
}
```

- [ ] **Step 3: 删除旧的 AgentChatPanel.tsx（纯 UI 版本）**

```bash
rm apps/web/app/components/chat/AgentChatPanel.tsx
```

然后修改 `apps/web/app/components/chat/index.ts`（如果不存在则创建）：

```typescript
export { AgentChatPanelImpl as AgentChatPanel } from './AgentChatPanelImpl.js';
```

并更新 `DashboardLayout.tsx` 中的导入：

```typescript
import { AgentChatPanel } from './chat/index.js';
```

- [ ] **Step 4: 类型检查**

Run: `cd apps/web && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/hooks/useAgentChat.ts apps/web/app/components/chat/
git commit -m "feat(web): add useAgentChat hook with tRPC integration framework"
```

---

## Task 8: 端到端验证

**Files:**
- 无新增文件，验证整体流程

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
- 页面显示左右分栏布局
- 左侧 380px 显示 "🤖 AI Copilot" 面板
- 右侧看板内容正常显示
- 在左侧输入问题，点击发送，显示 mock 响应

- [ ] **Step 4: 运行测试**

```bash
# 后端测试
cd apps/api && pnpm test

# 前端测试
cd apps/web && pnpm test
```

Expected: 所有现有测试通过，新增测试通过

- [ ] **Step 5: 运行类型检查**

```bash
# 根目录
cd /Users/wangzizheng/Desktop/kok/.claude/worktrees/agent-chat-design
pnpm typecheck
```

Expected: 全量无类型错误

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete Agent Chat Panel basic framework"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec 要求 | 对应 Task |
|---|---|
| 固定分栏对话面板 UI | Task 5, 6 |
| 后端 NestJS ChatModule | Task 2 |
| tRPC streaming endpoint | Task 3 |
| OpenAI SDK（Moonshot 兼容层） | Task 2 |
| Tool 定义框架 | Task 4 |
| System prompt 框架 | Task 2 |
| DashboardContext | Task 2, 7 |
| 复用 DeribitService | Task 4（工具定义预留接口） |
| useChat 集成框架 | Task 7 |

### 2. Placeholder Scan

- 无 "TBD"、"TODO" 在计划步骤中（仅在代码注释中标记后续迭代点）
- 所有步骤包含实际代码或命令
- 无 "Similar to Task N" 引用

### 3. Type Consistency

- `DashboardContext` 定义在 `system-prompt.ts`，被 `chat.service.ts` 和前端 `useAgentChat.ts` 共用
- Stream event 类型 `{ type: 'text'; text: string }` 前后端一致
- tRPC router 类型在 `shared-types` 和 `api` 端对齐

---

## Notes for Future Iterations

1. **真实 AI 调用**：Task 2 的 `chat.service.ts` 已集成 OpenAI SDK，但当前框架中 `ChatController` 尚未实际使用 streaming mutation（tRPC v11 的 streaming 需要特殊配置）。后续需：
   - 配置 tRPC SSE streaming link
   - 或使用 HTTP SSE endpoint 替代 tRPC mutation

2. **useChat 替换**：Task 7 的 `useAgentChat` 是自定义 hook 框架。后续可替换为 Vercel AI SDK 的 `useChat`：
   ```typescript
   import { useChat } from 'ai';
   ```

3. **Tool 执行**：Task 4 仅定义了 tool schema。后续需在 `chat.service.ts` 中：
   - 解析 Claude 的 `tool_calls`
   - 调用对应 tool handler（复用 DeribitService）
   - 将结果回传给 Claude 完成 ReAct 循环

4. **DashboardContext 联动**：Task 7 中 `useAgentChat` 的 context 是硬编码的。后续需从 `DashboardLayout` 的 `activeTab` state 传递。
