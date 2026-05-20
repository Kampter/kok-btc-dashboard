# Agent Chat Panel 设计文档

## 背景

Kok Dashboard 当前是一个 BTC 期权数据可视化看板，包含 5 个分析模块（市场概况、波动率分析、持仓结构、资金情绪、到期分析）。用户希望在浏览看板的同时，能够通过对话与 AI 助手交互，让 AI 基于当前可见的实时数据回答投资分析问题。

## 目标

在看板页面新增固定分栏对话面板，用户可输入自然语言问题，后端 AI Agent 调用实时数据工具，返回专业投资分析。

## 非目标

- 不实现多资产支持（黄金、美股、美债等仅预留扩展接口，本期不开发）
- 不实现 Claude Code Skill / MCP Server 替代方案
- 不实现前端直接操作 DOM 的 agent 能力
- 不实现用户认证、对话历史持久化、多会话管理

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    前端 (TanStack Start + React 19)              │
│  ┌────────────────────┬─────────────────────────────────────┐  │
│  │  🤖 AI Copilot     │      DashboardLayout (现有看板)      │  │
│  │  (固定分栏 380px)   │                                     │  │
│  │                    │  ┌─────────────────────────────┐    │  │
│  │  useChat hook      │  │    市场概况 / 波动率分析      │    │  │
│  │  - messages[]      │  │    (5 个 Tab 模块)           │    │  │
│  │  - handleSubmit    │  └─────────────────────────────┘    │  │
│  │  - isLoading       │                                     │  │
│  └────────────────────┴─────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ tRPC streaming mutation
┌──────────────────────────▼──────────────────────────────────────┐
│                    后端 (NestJS)                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ChatModule                                               │ │
│  │  ├─ chat.controller.ts  (tRPC router: chat.stream)        │ │
│  │  ├─ chat.service.ts     (Anthropic SDK 核心调用)          │ │
│  │  ├─ tools/              (Tool 定义 + Handler)             │ │
│  │  │   ├─ tool-definitions.ts                              │ │
│  │  │   ├─ market-overview.tool.ts                          │ │
│  │  │   ├─ book-summary.tool.ts                             │ │
│  │  │   ├─ trades.tool.ts                                   │ │
│  │  │   ├─ historical-volatility.tool.ts                    │ │
│  │  │   └─ expiry-analysis.tool.ts                         │ │
│  │  └─ prompts/                                              │ │
│  │      └─ system-prompt.ts                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  DeribitService (现有，Tool Handlers 直接复用)            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 核心交互流程

1. 用户在左侧对话面板输入问题
2. 前端 `useChat` 收集对话历史 + 当前 DashboardContext → 通过 tRPC streaming mutation 发送到后端
3. 后端 `chat.service` 使用原生 **Anthropic SDK** (`@anthropic-ai/sdk`) 调用 Claude
4. Claude 决定是否需要调用工具（如"当前市场概况"→调用 `getMarketOverview`）
5. Tool handler 直接复用现有的 `DeribitService` 获取数据
6. 工具结果返回给 Claude，Claude 生成最终分析回答
7. 流式响应通过 SSE 传回前端，`useChat` 自动处理流式 UI 渲染

---

## UI 设计

### 布局

固定分栏布局，左侧 380px 对话面板，右侧看板内容自适应。

```
┌─────────────────────────────────────────────────────────────────┐
│  Kok Options Dashboard                                    [用户] │
├────────────────────┬────────────────────────────────────────────┤
│  🤖 AI Copilot     │      ┌────────────────────────────────┐   │
│                    │      │      市场概况 (当前 Tab)         │   │
│  👤 当前波动率曲    │      │                                │   │
│     面有什么特点？   │      │   [图表区域]                    │   │
│                    │      │                                │   │
│  🤖 正在分析...    │      │   总持仓: $1.2B  24h成交: $180M │   │
│     [思考动画]      │      │   ATM IV: 45.2%                │   │
│                    │      │                                │   │
│  ┌──────────────┐  │      └────────────────────────────────┘   │
│  │ 🔧 getMarket │  │                                           │
│  │   Overview   │  │      ┌────────────────────────────────┐   │
│  │   [展开 ▼]   │  │      │      波动率分析                  │   │
│  └──────────────┘  │      │                                │   │
│                    │      │   [IV 曲面图]                   │   │
│  🤖 当前 BTC 期权  │      │                                │   │
│     市场概况...     │      │   各期限 IV: 7d 42% | 30d 45%  │   │
│                    │      │                                │   │
│                    │      └────────────────────────────────┘   │
│                    │                                           │
├────────────────────┤                                           │
│ 💬 [输入问题...]    │                                           │
│      [发送]         │                                           │
└────────────────────┴───────────────────────────────────────────┘
```

### 面板规格

| 属性 | 值 |
|---|---|
| 宽度 | 380px，固定 |
| 背景色 | `bg-slate-50`，与右侧 `bg-white` 形成视觉分隔 |
| 消息气泡 | Agent 左对齐灰色，用户右对齐蓝色 |
| 输入框 | 底部固定，textarea 支持 Shift+Enter 换行 |
| 工具卡片 | 可折叠展开，显示工具名、参数、执行结果摘要 |
| 思考过程 | 可选展示 Claude 的 reasoning 文本 |

### 与看板的上下文联动

- **当前激活 Tab**：每次请求自动附加到 `DashboardContext.activeTab`
- **数据时间范围**：当前筛选条件一并传递
- **被动引用**：用户说"这张图"时，Agent 知道指当前可见图表

---

## 后端服务设计

### Chat Service 核心逻辑

```typescript
// chat.service.ts — 核心交互循环（使用原生 Anthropic SDK）

async *streamChat(
  messages: AnthropicMessage[],
  context: DashboardContext
): AsyncGenerator<StreamEvent> {
  const systemPrompt = buildSystemPrompt(context);

  const stream = await this.anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    system: systemPrompt,
    messages,
    tools: this.toolDefinitions,
    max_tokens: 4096,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'text', text: event.delta.text };
    }
  }

  const finalMessage = await stream.finalMessage();
  const toolUses = extractToolUses(finalMessage);

  if (toolUses.length > 0) {
    yield { type: 'tool-call', tools: toolUses };
    const toolResults = await this.executeTools(toolUses);
    yield { type: 'tool-result', results: toolResults };

    // ReAct 循环：将工具结果追加到对话，重新调用 Claude
    const updatedMessages: AnthropicMessage[] = [
      ...messages,
      { role: 'assistant', content: finalMessage.content },
      {
        role: 'user',
        content: toolResults.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.toolUseId,
          content: JSON.stringify(r.result),
        })),
      },
    ];

    yield* this.streamChat(updatedMessages, context);
  }
}
```

### tRPC Router

```typescript
// chat.controller.ts
export const chatRouter = t.router({
  stream: t.procedure
    .input(
      z.object({
        messages: z.array(anthropicMessageSchema),
        context: dashboardContextSchema,
      })
    )
    .mutation(async function* ({ input }) {
      const stream = chatService.streamChat(input.messages, input.context);
      for await (const event of stream) {
        yield event;
      }
    }),
});
```

### Stream Event 类型

```typescript
type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; tools: ToolUse[] }
  | { type: 'tool-result'; results: ToolResult[] }
  | { type: 'error'; message: string };
```

---

## Tool 设计

### Tool 清单

| Tool Name | 数据来源 | 用途 |
|---|---|---|
| `getMarketOverview` | `DeribitService.getBookSummaryByCurrency` + `getIndexPrice` | 市场概况：总持仓、成交量、ATM IV、BTC 价格 |
| `getBookSummary` | `DeribitService.getBookSummaryByCurrency` | 期权簿摘要：各行权价持仓/成交量/IV |
| `getTrades` | `DeribitService.getLastTradesByCurrency` | 近期交易流 |
| `getHistoricalVolatility` | `DeribitService.getHistoricalVolatility` | 历史波动率数据 |
| `analyzeVolatilitySurface` | 组合 `getBookSummary` + 计算逻辑 | 波动率曲面分析（期限结构、skew） |

### Tool Definition 示例

```typescript
{
  name: 'getMarketOverview',
  description: '获取当前 BTC 期权市场概况：总持仓量、24h成交量、ATM隐含波动率、BTC现货价格',
  input_schema: {
    type: 'object',
    properties: {},
  },
}
```

### 重要：数据粒度约定

- 所有 Tool **不暴露币种选择参数**，当前固定聚焦 BTC
- 未来扩展黄金/美股/美债等大类资产时，通过新增独立 Tool 或增加 `assetClass` 参数实现
- 本期不实现 ETH 或其他小币种支持

---

## System Prompt 设计

```
你是 Kok Dashboard 的 AI 投资分析助手，专注于大类资产的投资数据分析与解读。

## 角色定位
- 你用中文回答用户问题
- 你擅长从专业投资视角解读市场数据
- 你会关注宏观趋势、市场情绪、风险指标和潜在机会
- 你的分析风格专业但易懂，适合有投资经验的用户

## 当前数据范围
- 当前聚焦资产：BTC（比特币期权市场数据）
- 数据来源：Deribit 交易所
- 数据刷新时间：{{lastUpdated}}

## 当前用户视图
- 用户正在查看：{{activeTab}}
- 时间范围：{{timeRange}}

## 回答规范
1. 数据驱动：所有结论必须基于工具返回的数据
2. 结构化：复杂分析使用 bullet point 组织
3. 关键指标：重要数字用 **粗体** 标出
4. 风险提示：发现异常波动或极端数据时主动提示风险
5. 投资视角：从持仓结构、情绪指标、期限结构等专业角度解读
```

---

## 上下文传递

```typescript
interface DashboardContext {
  activeTab: 'overview' | 'volatility' | 'positions' | 'sentiment' | 'expiry';
  timeRange?: string;
  filters?: Record<string, unknown>;
  lastUpdated: string;
  // 预留：未来大类资产扩展
  // assetClass?: 'crypto' | 'commodity' | 'equity' | 'bond';
}
```

---

## 扩展性设计

### 未来大类资产支持

```
当前:                    未来扩展:
┌──────────┐           ┌──────────────────────────────┐
│  BTC     │    →      │  BTC  │  黄金  │  美股  │  美债 │
│  crypto  │           │  crypto模块 │ commodity模块 │ ... │
└──────────┘           └──────────────────────────────┘
                              ↑
                         按 assetClass 路由分发
```

扩展时只需：
1. 新增数据模块（如 `gold/`、`equity/`）
2. Tool 定义增加 `assetClass` 参数
3. System prompt 更新当前数据范围

---

## 依赖清单

### 新增依赖

| 包名 | 用途 | 安装位置 |
|---|---|---|
| `@anthropic-ai/sdk` | 原生 Anthropic SDK | `apps/api` |
| `ai` | Vercel AI SDK（前端 `useChat`） | `apps/web` |
| `@ai-sdk/anthropic` | Vercel AI SDK Anthropic provider（预留） | `apps/web` |

### 复用现有依赖

- `DeribitService` → Tool handlers 直接调用
- `tRPC` → 前后端通信
- `zod` → 输入校验
- `shadcn/ui` → 对话面板 UI 组件

---

## 风险与限制

1. **Anthropic API 成本**：每次对话调用均计费，tool use 循环会增加 token 消耗
2. **流式协议自定义**：前后端需要自行约定 SSE 事件格式，调试成本高于标准 OpenAI 流
3. **ReAct 循环深度**：复杂问题可能导致多次 tool call 往返，需要设置最大循环次数防止无限循环
4. **错误处理**：Deribit API 超时/失败时需要优雅降级，向用户说明数据不可用
