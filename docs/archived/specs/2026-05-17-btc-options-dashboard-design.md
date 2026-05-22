# BTC 期权数据看板 — 设计规格书

**日期**: 2026-05-17  
**状态**: 已确认，待实施  
**数据源**: Deribit（单一来源）

---

## 1. 项目概述

构建一个本地运行的 BTC 期权数据看板，通过 Deribit 公开 API 获取实时市场数据，提供市场概况、波动率分析、持仓结构、资金情绪、到期分析五个核心维度的可视化展示。

**目标用户**: 个人交易者/分析师，需要快速获取 BTC 期权市场全貌以辅助交易决策和策略研究。

**成功标准**:
- 页面加载后 3 秒内展示核心 KPI
- 数据自动刷新，延迟控制在 30 秒以内
- 各模块图表渲染流畅，交互响应在 100ms 以内

---

## 2. 市场背景

全球 BTC 期权市场呈现高度集中的双寡头格局：

| 平台 | 市场份额 | 特点 |
|------|---------|------|
| Deribit | ~80% | 加密原生期权龙头，API 最完整 |
| CME | ~6% | 机构对冲为主，需申请 API |
| OKX/Binance 等 | ~7% | 期权业务占比小 |

**决策**: 仅接入 Deribit，已覆盖 80% 的市场数据，API 公开且无需认证即可获取大部分市场数据。

---

## 3. 架构设计

### 3.1 技术栈

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| 前端框架 | TanStack Start | latest | Vite 全栈框架，文件路由 + SSR/CSR 灵活切换 |
| UI 组件 | shadcn/ui v4 | latest | 基于 Radix UI，暗色主题内置 |
| 数据可视化 | Tremor + Recharts | latest | Tremor 提供数据组件（MetricCard、图表等），Recharts 底层渲染 |
| 类型验证 | Zod | latest | 前后端共享 schema，运行时类型安全 |
| 类型桥梁 | tRPC | latest | 端到端类型安全 API，集成 TanStack Query |
| 数据获取 | TanStack Query | latest | tRPC 客户端自动集成，缓存/刷新/重试 |
| 后端框架 | NestJS | latest | 企业级 Node.js，模块化、依赖注入 |
| 样式 | Tailwind CSS | latest | 暗色金融主题 |
| 语言 | TypeScript | latest | 全栈类型安全 |

### 3.2 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                    TanStack Start (Frontend)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  pages/                                               │  │
│  │    ├── index.tsx    ← Dashboard 页面                  │  │
│  │    └── ...                                            │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  components/                                          │  │
│  │    ├── ui/         ← shadcn/ui (Button, Card, Tabs)   │  │
│  │    ├── charts/     ← Tremor + Recharts 封装           │  │
│  │    └── modules/    ← 5 个业务模块                     │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  lib/trpc.ts     ← tRPC client (TanStack Query hook)  │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / tRPC protocol
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      NestJS (Backend)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  DeribitModule                                        │  │
│  │    ├── deribit.service.ts    ← Deribit HTTP API 调用  │  │
│  │    ├── deribit.controller.ts ← tRPC router 暴露        │  │
│  │    └── deribit.cache.ts      ← 内存缓存 (TTL 30s)     │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  tRPCModule                                           │  │
│  │    └── app.router.ts         ← 聚合所有 tRPC routers   │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
                        ▼
                  Deribit API (www.deribit.com)
```

### 3.3 数据流

```
浏览器 (TanStack Start)
  └── tRPC Client (TanStack Query auto-integration)
         │
         │ tRPC HTTP request
         ▼
    NestJS tRPC Router
         │
         ├── cache hit? → 直接返回缓存数据
         │
         └── cache miss → DeribitService
                              │
                              │ HTTP request
                              ▼
                         Deribit API
                              │
                              ▼
                         NestJS (transform + cache + Zod validate)
                              │
                              ▼
                         浏览器 (Tremor/Recharts 渲染)
```

**NestJS 后端职责**:
- Deribit API 代理：转发请求，处理 CORS、限流、认证
- 服务端缓存：内存缓存（TTL 15-30 秒），降低 Deribit 限流风险
- 数据聚合：将原始 Deribit 数据聚合为前端需要的格式
- 类型安全：Zod schema 验证输入输出，与前端共享
- 错误处理：统一错误码，前端友好降级

**tRPC 优势**:
- 前后端共享 Zod schema，API 类型自动同步
- TanStack Query 集成：自动缓存、重试、刷新、乐观更新
- 无需手动维护 API 类型定义文件

---

## 4. 模块设计

### 4.1 导航与布局

**顶部导航栏**:
- 5 个 Tab：市场概况 | 波动率分析 | 持仓结构 | 资金情绪 | 到期分析
- 右侧状态区：Deribit 连接状态（绿/红点）、自动刷新间隔（默认 30s）、最后更新时间

**内容区**:
- Tab 切换时无页面跳转，仅内容区重新渲染
- 每个模块包含 2-4 个图表/卡片区域
- 支持响应式布局（桌面端为主，移动端适配为可选）

---

### 4.2 模块 A：市场概况

**用途**: 一眼获取市场核心指标

**KPI 卡片（顶部一排）**:
| 指标 | 来源 API | 说明 |
|------|---------|------|
| 总持仓量 (OI) | `get_book_summary_by_currency` | 所有 BTC 期权合约的 USD 名义价值总和 |
| 24h 交易量 | `get_book_summary_by_currency` | 近 24 小时累计交易名义价值 |
| ATM 隐含波动率 | `get_book_summary_by_currency` | 最接近平值的期权 IV，取各到期日加权平均 |
| BTC 现货价格 | `get_index` | Deribit BTC 现货价格指数 |

**图表 1：OI 趋势图**
- 类型：面积图
- X 轴：时间（30 天）
- Y 轴：持仓量（USD）
- 来源：`get_historical_volatility` 或自定义聚合（如有历史 OI API）
- 替代方案：如 Deribit 无历史 OI API，展示当前快照 + 近 7 天变化百分比

**图表 2：24h 交易量分布**
- 类型：柱状图
- X 轴：到期日
- Y 轴：交易量（USD）
- 分组：Call（绿色）/ Put（红色）

---

### 4.3 模块 B：波动率分析

> **已更新**：2026-05-21 升级为 Delta-based 方法，详见 [[25d-skew-design]]

**用途**: 分析市场对未来波动的定价

**图表 1：ATM IV 期限结构（Term Structure）** ✅ 已更新
- 类型：折线图
- X 轴：标准期限（1M / 3M / 6M）
- Y 轴：ATM IV（%）
- 单条线（历史对比待后续实现）
- 来源：通过 Black-Scholes Delta 找最接近 ±0.50 Delta 的期权

**图表 2：25Δ Skew** ✅ 已更新
- 类型：柱状图
- X 轴：标准期限（1M / 3M / 6M）
- Y 轴：Skew（%）= IV(Put) − IV(Call)，取 ±0.25 Delta
- 来源：通过 Black-Scholes Delta 找最接近 ±0.25 Delta 的期权

**图表 3：历史波动率 (HV)** ✅ 保留
- 类型：折线图
- X 轴：时间（90 天）
- Y 轴：波动率（%）
- 来源：`get_historical_volatility`

---

### 4.4 模块 C：持仓结构

**用途**: 了解市场参与者的持仓分布和潜在压力点

**图表 1：行权价-到期日热力图**
- 类型：热力图（自定义实现或 Recharts 变通）
- X 轴：行权价（$80K ~ $130K，根据当前价格动态调整范围）
- Y 轴：到期日
- 颜色深浅：Call OI（绿色系）和 Put OI（红色系）叠加或并排显示
- 交互：hover 显示具体 OI 数值

**图表 2：Max Pain 价格**
- 类型：指标卡片 + 辅助条形图
- 计算：Max Pain = 使总期权价值损失最大的 BTC 价格
- 公式：对所有行权价，计算该价格下所有 ITM 期权的内在价值总和，取最小值对应的行权价
- 条形图：展示当前价格 vs Max Pain 价格，以及附近行权价的 OI 分布

**图表 3：Call/Put OI 比例**
- 类型：环形图（Donut Chart）
- 展示：Call OI 占比 vs Put OI 占比
- 附注：当 Call 比例 > 60% 时显示"偏看涨"提示，< 40% 时显示"偏看跌"

---

### 4.5 模块 D：资金情绪

**用途**: 捕捉市场情绪和资金流向

**图表 1：Put/Call 交易量比例趋势**
- 类型：折线图 + 50% 参考线
- X 轴：时间（30 天）
- Y 轴：Put/Call 交易量比例（0% ~ 100%）
- 来源：从 `get_last_trades_by_currency` 按天聚合
- 附注：比例 > 50% 表示市场偏看跌（Put 交易量多于 Call），< 50% 表示偏看涨

**图表 2：大宗交易列表**
- 类型：数据表格
- 列：时间、方向（Buy/Sell）、类型（Call/Put）、数量、名义价值、行权价、到期日
- 过滤：只显示名义价值 > $1M 的大宗交易（可配置阈值）
- 来源：`get_last_trades_by_currency`
- 更新：实时或近实时（每次刷新获取最新 50 条）

**图表 3：Options Flow 趋势（简化版）**
- 类型：堆叠柱状图
- X 轴：时间（按小时或天）
- Y 轴：名义交易量（USD）
- 分组：Call Buy / Call Sell / Put Buy / Put Sell
- 来源：从交易数据按方向和类型聚合
- 计算方式：buy = taker 为买方，sell = taker 为卖方

---

### 4.6 模块 E：到期分析

**用途**: 监控到期日带来的市场影响

**图表 1：到期日历（Expiry Calendar）**
- 类型：横向条形图
- X 轴：各到期日的 OI 总量（USD）
- Y 轴：到期日（从近到远）
- 分组：Call（绿色）/ Put（红色）
- 高亮：最近 3 个到期日用特殊标记

**图表 2：到期日行权价分布（可交互选择到期日）**
- 类型：分组柱状图
- X 轴：行权价
- Y 轴：OI（USD）
- 分组：Call / Put
- 交互：下拉选择不同到期日，图表动态更新

**图表 3：历史到期波动统计**
- 类型：表格或简图
- 内容：过去 6 个到期日前后的 BTC 价格波动统计（如到期前 7 天、到期当天、到期后 1 天的涨跌幅）
- 来源：需结合历史价格数据和到期日列表计算
- 注意：此功能依赖历史数据，MVP 阶段可标记为 v2 功能

---

## 5. Deribit API 映射

### 5.1 使用的 API 端点

| API 方法 | 用途 | 调用频率 |
|---------|------|---------|
| `public/get_book_summary_by_currency` | OI、交易量、IV、行权价分布 | 每 30 秒 |
| `public/get_index` | BTC 现货价格 | 每 30 秒 |
| `public/get_historical_volatility` | 历史波动率 | 每 5 分钟 |
| `public/get_last_trades_by_currency` | 近期交易（含大宗） | 每 30 秒 |

### 5.2 请求参数示例

```typescript
// get_book_summary_by_currency
{
  currency: "BTC",
  kind: "option"
}

// get_last_trades_by_currency
{
  currency: "BTC",
  kind: "option",
  count: 100,
  sorting: "desc"
}
```

### 5.3 限流与缓存策略

**Deribit API 限流**：约 20 请求/秒（IP 级别）

**NestJS 服务端缓存**（`@nestjs/cache-manager`）:
- 所有 Deribit API 响应缓存 TTL：30 秒
- 缓存键按 API 方法 + 参数组合生成
- 内存存储（MVP 阶段），可替换为 Redis

**客户端缓存**（tRPC + TanStack Query）:
- `staleTime: 30000`（30 秒），与服务端缓存对齐
- 窗口重新聚焦时自动刷新
- 错误重试：指数退避，最多 3 次

**降级策略**:
- API 不可用时返回上次缓存数据 + "数据可能延迟"提示
- 服务端缓存失效时触发后台刷新，不影响当前请求

---

## 6. 数据模型

### 6.1 共享 Schema（packages/shared-types）

前后端共享 Zod schema，tRPC 自动推导 TypeScript 类型。

```typescript
// packages/shared-types/src/schemas/option.ts
import { z } from 'zod';

export const OptionSummarySchema = z.object({
  instrument_name: z.string(),
  strike: z.number(),
  expiry: z.string().datetime(),
  option_type: z.enum(['C', 'P']),
  open_interest: z.number(),
  open_interest_usd: z.number(),
  volume_24h: z.number(),
  mark_iv: z.number(),
  bid_iv: z.number(),
  ask_iv: z.number(),
  underlying_price: z.number(),
});

export const MarketOverviewSchema = z.object({
  totalOI: z.number(),
  totalVolume24h: z.number(),
  atmIV: z.number(),
  btcPrice: z.number(),
  timestamp: z.string().datetime(),
});

export const ExpirySummarySchema = z.object({
  expiry: z.string().datetime(),
  totalOI: z.number(),
  callOI: z.number(),
  putOI: z.number(),
  atmIV: z.number(),
});

export const OptionTradeSchema = z.object({
  trade_id: z.string(),
  timestamp: z.number(),
  instrument_name: z.string(),
  direction: z.enum(['buy', 'sell']),
  amount: z.number(),
  price: z.number(),
  index_price: z.number(),
});

// 自动推导 TypeScript 类型
export type OptionSummary = z.infer<typeof OptionSummarySchema>;
export type MarketOverview = z.infer<typeof MarketOverviewSchema>;
export type ExpirySummary = z.infer<typeof ExpirySummarySchema>;
export type OptionTrade = z.infer<typeof OptionTradeSchema>;
```

### 6.2 tRPC Router 定义

```typescript
// packages/shared-types/src/trpc/router.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import {
  MarketOverviewSchema,
  OptionSummarySchema,
  OptionTradeSchema,
} from '../schemas';

const t = initTRPC.create();

export const appRouter = t.router({
  deribit: t.router({
    marketOverview: t.procedure
      .query(async () => {
        // 返回 MarketOverview
        return MarketOverviewSchema.parse(result);
      }),

    bookSummary: t.procedure
      .input(z.object({ currency: z.string(), kind: z.string() }))
      .query(async ({ input }) => {
        // 返回 OptionSummary[]
        return OptionSummarySchema.array().parse(result);
      }),

    trades: t.procedure
      .input(z.object({
        currency: z.string(),
        count: z.number().default(100),
      }))
      .query(async ({ input }) => {
        // 返回 OptionTrade[]
        return OptionTradeSchema.array().parse(result);
      }),

    historicalVolatility: t.procedure
      .input(z.object({ currency: z.string() }))
      .query(async ({ input }) => {
        // 返回 { timestamp, volatility }[]
        return z.array(z.object({
          timestamp: z.number(),
          volatility: z.number(),
        })).parse(result);
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

---

## 7. UI/UX 设计

### 7.1 视觉风格

- **主题**: 暗色金融主题（Dark Mode），shadcn/ui v4 暗色变量
- **主色调**: 深蓝底色 (#0f172a) + 红色强调 (#e94560 用于 Put/下跌) + 绿色强调 (#4ade80 用于 Call/上涨)
- **字体**: 系统默认等宽数字字体，确保价格/数字对齐
- **组件库**: shadcn/ui 提供基础交互组件（Tabs、Button、Table、Card），Tremor 提供数据展示组件（MetricCard、AreaChart、BarChart 等）
- **卡片**: shadcn/ui Card 组件 + 自定义暗色样式

### 7.2 响应式断点

| 断点 | 布局 |
|------|------|
| >= 1280px | 4 列 KPI + 2 列图表网格 |
| >= 1024px | 4 列 KPI + 1-2 列图表网格 |
| >= 768px | 2 列 KPI + 1 列图表 |
| < 768px | 1 列堆叠（移动端适配为可选） |

### 7.3 交互设计

- **Tab 切换**: 点击顶部 Tab 切换模块，当前 Tab 下划线高亮
- **图表交互**: hover 显示 tooltip（具体数值），点击图例可隐藏/显示数据系列
- **时间范围**: 图表支持 7D / 30D / 90D 切换（如数据允许）
- **刷新控制**: 右上角显示最后更新时间，点击可手动刷新，支持暂停自动刷新

---

## 8. 错误处理

### 8.1 错误场景

| 场景 | 处理方式 |
|------|---------|
| Deribit API 限流 (429) | 服务端返回缓存数据，客户端显示"数据可能延迟"提示 |
| Deribit API 不可用 | 显示上次成功数据 + 红色"连接中断"状态指示器 |
| 数据解析错误 | 显示"数据异常"占位卡片，记录错误日志 |
| 网络断开 | 客户端检测网络恢复后自动重试 |

### 8.2 加载状态

- KPI 卡片：骨架屏 shimmer 动画
- 图表："加载中..." 文字 + 浅灰色占位区域
- 表格：表头固定，行显示骨架行

---

## 9. 性能目标

| 指标 | 目标 |
|------|------|
| 首屏骨架渲染 | < 1s |
| 首屏数据展示 | < 3s |
| Tab 切换 | < 200ms |
| 图表交互响应 | < 100ms |
| 自动刷新间隔 | 30s（可配置） |

---

## 10. 项目范围与阶段

### MVP（第一阶段）

- [ ] 模块 A：市场概况（KPI + OI 趋势 + 交易量分布）
- [ ] 模块 B：波动率分析（IV 期限结构 + Skew）
- [ ] 模块 C：持仓结构（Call/Put 比例 + 行权价分布）
- [ ] 模块 D：资金情绪（P/C 交易量比例 + 大宗交易列表 + Options Flow）
- [ ] 模块 E：到期分析（到期日历）
- [ ] 基础布局 + Tab 导航（shadcn/ui Tabs）
- [ ] NestJS tRPC 后端（Deribit API 代理 + 缓存）
- [ ] tRPC 前后端联调

### v2（可选扩展）

- [ ] Max Pain 计算与展示
- [ ] 历史到期波动统计
- [ ] 自定义刷新间隔
- [ ] 数据导出（CSV）
- [ ] 预警功能（价格/IV 阈值提醒）

---

## 11. 文件结构

```
apps/web/                          # TanStack Start 前端
├── app/
│   ├── routes/
│   │   └── __root.tsx             # 根布局（暗色主题 + 全局样式）
│   ├── router.tsx                 # TanStack Router 配置
│   └── client.tsx                 # 客户端入口
├── pages/
│   └── index.tsx                  # Dashboard 主页面
├── components/
│   ├── ui/                        # shadcn/ui (Button, Card, Tabs, Table 等)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   ├── charts/                    # Tremor + Recharts 封装组件
│   │   ├── AreaChart.tsx
│   │   ├── BarChart.tsx
│   │   ├── LineChart.tsx
│   │   ├── DonutChart.tsx
│   │   └── Heatmap.tsx
│   ├── metrics/                   # Tremor MetricCard 封装
│   │   └── KPICard.tsx
│   └── modules/                   # 5 个业务模块
│       ├── MarketOverview.tsx
│       ├── VolatilityAnalysis.tsx
│       ├── PositionStructure.tsx
│       ├── FundingSentiment.tsx
│       └── ExpiryAnalysis.tsx
├── lib/
│   ├── trpc.ts                    # tRPC client 配置（TanStack Query hook）
│   ├── utils.ts                   # 工具函数
│   └── tremor-utils.ts            # Tremor 主题/颜色配置
├── hooks/
│   └── useDashboardData.ts        # tRPC hooks 封装
└── globals.css                    # Tailwind 导入 + shadcn/ui 变量

apps/api/                          # NestJS 后端
├── src/
│   ├── main.ts                    # 应用入口
│   ├── app.module.ts              # 根模块
│   ├── trpc/
│   │   ├── trpc.module.ts
│   │   └── trpc.router.ts         # tRPC app router 聚合
│   └── deribit/
│       ├── deribit.module.ts
│       ├── deribit.service.ts     # Deribit HTTP API 调用 + 缓存
│       ├── deribit.controller.ts  # tRPC router 定义
│       └── deribit.cache.ts       # 内存缓存管理
├── package.json
└── tsconfig.json

packages/shared-types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── schemas/
    │   ├── option.ts              # Zod schema: OptionSummary, MarketOverview
    │   └── trade.ts               # Zod schema: OptionTrade
    └── trpc/
        └── router.ts              # tRPC router 类型定义（前后端共享）
```

---

## 12. 依赖清单

### apps/web (TanStack Start 前端)

```bash
# 框架
pnpm add @tanstack/react-start @tanstack/react-router

# UI
pnpm add tailwindcss @radix-ui/react-tabs @radix-ui/react-select
npx shadcn@latest init        # shadcn/ui v4
npx shadcn@latest add card tabs table button select

# 数据可视化
pnpm add @tremor/react recharts

# tRPC + TanStack Query (tRPC 已集成 TanStack Query)
pnpm add @trpc/client @trpc/server @trpc/tanstack-react-query @tanstack/react-query

# 共享包
pnpm add @kok/shared-types
```

### apps/api (NestJS 后端)

```bash
# NestJS 核心
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express

# tRPC + NestJS 集成
pnpm add trpc-nestjs @trpc/server

# HTTP 客户端
pnpm add axios

# 缓存
pnpm add @nestjs/cache-manager cache-manager

# 共享包
pnpm add @kok/shared-types
```

### packages/shared-types

```bash
pnpm add zod @trpc/server
```

---

## 13. 风险与假设

| 风险 | 缓解措施 |
|------|---------|
| Deribit API 变更或限流收紧 | NestJS 服务层封装，统一处理变更点；服务端缓存降低请求频率 |
| 历史 OI 数据 API 不可用 | OI 趋势图改用当前快照 + 客户端本地缓存时间序列 |
| 热力图性能（大量行权价 × 到期日） | 限制显示范围（如只显示 ±30% ATM 的行权价） |
| Max Pain 计算量大 | NestJS 服务端计算，前端只展示结果 |
| tRPC 类型同步延迟 | 前后端共享 packages/shared-types，monorepo 保证同步 |
| NestJS 与 TanStack Start 端口冲突 | 前端默认 5173，后端默认 3000，CORS 白名单配置 |

---

*本规格书经设计评审确认，作为后续实施计划的输入。*
