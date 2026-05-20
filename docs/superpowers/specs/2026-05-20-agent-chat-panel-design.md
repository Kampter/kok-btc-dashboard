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
│  │  ├─ chat.service.ts     (OpenAI SDK 调用 Anthropic 兼容端点) │ │
│  │  ├─ tools/              (Tool 定义 + Handler)             │ │
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
3. 后端 `chat.service` 使用 **OpenAI SDK** 调用 Anthropic 兼容端点（`baseURL: https://api.anthropic.com/v1/`）
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

### 新增模块结构

```
apps/api/src/
├── chat/
│   ├── chat.module.ts          # NestJS 模块声明
│   ├── chat.service.ts         # 核心：Anthropic SDK 调用 + Tool 编排
│   ├── chat.controller.ts      # tRPC router（stream endpoint）
│   ├── tools/
│   │   ├── tool-definitions.ts     # Claude tool 定义（JSON Schema）
│   │   └── *.tool.ts               # 各 tool handler
│   └── prompts/
│       └── system-prompt.ts    # 角色定义 + 数据上下文模板
└── deribit/                    # 现有（复用）
```

### Chat Service 职责

- 接收对话消息 + DashboardContext
- 构建 system prompt（角色 + 当前看板上下文）
- 调用 OpenAI SDK (`openai.chat.completions.create` with `baseURL: https://api.anthropic.com/v1/`)
- 处理 tool_use 事件，执行对应 tool handler
- 将 tool 结果回传给 Claude，完成 ReAct 循环
- 流式输出响应事件

### tRPC Streaming Endpoint

- 前端通过 tRPC streaming mutation 调用
- 后端返回 SSE 格式的流事件
- 前后端需约定统一的流事件数据结构

### Stream Event 类型（需前后端对齐）

前后端需约定以下流事件类型：
- 正常文本片段
- 工具调用开始
- 工具执行结果
- 错误信息

### Tool 清单（本期实现）

| Tool Name | 数据来源 | 用途 |
|---|---|---|
| `getMarketOverview` | `DeribitService` | 市场概况：总持仓、成交量、ATM IV、BTC 价格 |
| `getBookSummary` | `DeribitService` | 期权簿摘要：各行权价持仓/成交量/IV |
| `getTrades` | `DeribitService` | 近期交易流 |
| `getHistoricalVolatility` | `DeribitService` | 历史波动率数据 |
| `analyzeVolatilitySurface` | `DeribitService` + 计算 | 波动率曲面分析 |

### 数据粒度约定

- 所有 Tool 当前固定聚焦 BTC，不暴露币种选择参数
- 未来扩展黄金/美股/美债等大类资产时，通过新增独立 Tool 或增加 `assetClass` 参数实现
- 本期不实现 ETH 或其他小币种支持

---

## System Prompt 设计

System prompt 需包含以下要素：
- 角色定位：AI 投资分析助手，专注大类资产投资数据分析
- 当前数据范围：BTC 期权（Deribit 数据源）
- 当前用户视图：激活 tab、时间范围
- 回答规范：数据驱动、结构化、关键指标高亮、风险提示、投资视角

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

当前仅实现 BTC 期权模块。未来扩展黄金/美股/美债等大类资产时：
1. 新增对应数据模块（如 `gold/`、`equity/`）
2. Tool 定义增加 `assetClass` 参数
3. System prompt 更新当前数据范围

---

## 依赖清单

### 新增依赖

| 包名 | 用途 | 安装位置 |
|---|---|---|
| `openai` | OpenAI SDK 调用 Anthropic 兼容端点 | `apps/api` |
| `ai` | Vercel AI SDK（前端 `useChat`） | `apps/web` |

### 复用现有依赖

- `DeribitService` → Tool handlers 直接调用
- `tRPC` → 前后端通信
- `zod` → 输入校验
- `shadcn/ui` → 对话面板 UI 组件

---

## 风险与限制

1. **Anthropic API 成本**：每次对话调用均计费，tool use 循环会增加 token 消耗
2. **流式协议自定义**：前后端需要自行约定 SSE 事件格式
3. **ReAct 循环深度**：复杂问题可能导致多次 tool call 往返，需要设置最大循环次数
4. **错误处理**：Deribit API 超时/失败时需要优雅降级
