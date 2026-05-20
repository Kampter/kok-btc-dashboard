# BTC 期权持仓 OI 分布分析 — 设计文档

## 背景与目标

Kok Dashboard 已集成 Deribit API，提供市场概览、持仓结构、到期分析等模块。本功能新增"期权 OI 分布"分析，让用户选择任意未来到期日，查看该到期日下 Call/Put 在行权价（strike）上的持仓分布，并从中识别关键价位：

- **阻力位置（Resistance）**：Call 持仓最集中区域 → 价格上涨至此面临行权抛压
- **支撑位置（Support）**：Put 持仓最集中区域 → 价格下跌至此有行权买入支撑
- **Max Pain（最大痛苦点）**：使买方总损失最大（卖方总收益最大）的到期价格

## 需求确认

### 已确认决策

| 决策项 | 选择 | 说明 |
|---|---|---|
| 支撑/阻力计算 | **加权中心** | 以 OI 为权重对 strike 做加权平均，更稳健 |
| 到期日筛选 | **自动筛选** | 只显示 OI 总量 > 阈值（如 $100M）的到期日，按剩余天数排序，取前 10 个 |
| 可视化方案 | **方案 A：金字塔/蝴蝶图** | Call 在左、Put 在右的水平对称条形图 |
| 是否含 Max Pain | **是** | 作为补充指标展示 |
| 实现方案 | **后端聚合，前端纯展示** | 新增 tRPC endpoint，前端调用并渲染 |

## 数据流

```
Deribit API ──→ DeribitService ──→ TrpcService ──→ tRPC Client ──→ React 组件
(get_book_summary_by_currency)    (后端聚合)       (oiDistribution)     (蝴蝶图)
```

### 后端聚合逻辑

```
输入：currency='BTC', kind='option'

1. 获取全部 BTC option 的 book summary（含所有到期日、所有 strike）
2. 按 (expiry, strike, option_type) 分组，求和 open_interest_usd
3. 计算每个到期日的总 OI，筛选 >= THRESHOLD 的到期日
4. 对每个筛选出的到期日：
   a. 按 strike 分组，分别聚合 Call OI 和 Put OI
   b. 计算 Call 加权中心 = sum(strike * call_OI) / sum(call_OI)
   c. 计算 Put 加权中心 = sum(strike * put_OI) / sum(put_OI)
   d. 计算 Max Pain（见下方算法）
5. 返回结构化数据
```

### Max Pain 算法

对选定的到期日，遍历所有 strike 价格 S：

```
总损失(S) = sum( Call_OI_i * max(0, S - strike_i) )
          + sum( Put_OI_i  * max(0, strike_i - S) )

Max Pain = argmin(总损失(S))
```

即：找到使买方总内在价值损失最大的价格。该价格处 Call 和 Put 的虚值部分总和最大。

## API 设计

### 新增 Schema（packages/shared-types）

```typescript
// src/schemas/oi-distribution.ts
export const OIStrikeItemSchema = z.object({
  strike: z.number(),
  call_oi: z.number(),
  put_oi: z.number(),
  call_oi_usd: z.number(),
  put_oi_usd: z.number(),
});

export const OIDistributionSchema = z.object({
  expiry: z.string().datetime(),
  days_to_expiry: z.number(),
  total_call_oi: z.number(),
  total_put_oi: z.number(),
  total_call_oi_usd: z.number(),
  total_put_oi_usd: z.number(),
  resistance: z.number(),
  support: z.number(),
  max_pain: z.number(),
  spot_price: z.number(),
  strike_distribution: z.array(OIStrikeItemSchema),
});

export const OIDistributionListSchema = z.object({
  expiries: z.array(z.object({
    expiry: z.string().datetime(),
    days_to_expiry: z.number(),
    total_oi_usd: z.number(),
  })),
  selected: OIDistributionSchema,
});
```

### 新增 tRPC Endpoint

```typescript
// apps/api/src/trpc/trpc.service.ts
oiDistribution: t.procedure
  .input(z.object({
    currency: z.string().default('BTC'),
    expiry: z.string().datetime().optional(), // 不传则返回最近到期日
  }))
  .query(async ({ input }) => {
    // 1. 获取全部数据
    // 2. 筛选有效到期日
    // 3. 计算所选到期日的分布
    // 4. 返回 OIDistributionListSchema
  })
```

## 前端设计

### 新增组件

```
app/components/modules/
├── OIDistribution.tsx      # 主组件（蝴蝶图 + 到期日选择）
└── OIDistribution.test.tsx # 测试
```

### UI 布局

```
┌─────────────────────────────────────────────────────┐
│ [模块标题: BTC 期权 OI 分布]                          │
│                                                      │
│  到期日选择: [2025-05-30 ▼]   距到期: 7天             │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │   阻力: $85,000   支撑: $75,000   Max Pain: $81,000  │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  [        Call OI         │ Strike │         Put OI         ] │
│  [████████                │  $65K  │                ▓▓▓▓    ] │
│  [████████████            │  $70K  │            ▓▓▓▓▓▓▓▓    ] │
│  [██████████████████      │  $75K  │      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ] │ ← 支撑
│  [████████████████████████│  $80K  │            ▓▓▓▓▓▓▓▓    ] │
│  [██████████████████████████████│  $85K  │          ▓▓▓▓▓▓      ] │ ← 阻力
│  [████████████████        │  $90K  │              ▓▓▓▓        ] │
│  [██████████              │  $95K  │                ▓▓        ] │
│                                                      │
│  Call: 绿色(#4ade80)  Put: 红色(#e94560)               │
└─────────────────────────────────────────────────────┘
```

### 图表实现（Recharts BarChart）

```typescript
// 数据准备：Call OI 取负值用于左侧渲染
const chartData = strike_distribution.map(item => ({
  strike: formatStrike(item.strike),
  call_oi: -item.call_oi_usd,  // 负值 → 左侧条形
  put_oi: item.put_oi_usd,      // 正值 → 右侧条形
}));

// 图表配置
<BarChart data={chartData} layout="vertical">
  <XAxis type="number" tickFormatter={v => formatUSD(Math.abs(v))} />
  <YAxis type="category" dataKey="strike" />
  <Tooltip formatter={(v: number) => formatUSD(Math.abs(v))} />
  <Bar dataKey="call_oi" fill="#4ade80" />
  <Bar dataKey="put_oi" fill="#e94560" />
</BarChart>
```

### 新增 Hook

```typescript
// app/hooks/useDashboardData.ts
export function useOIDistribution(currency: string, expiry?: string) {
  return trpc.deribit.oiDistribution.useQuery({ currency, expiry });
}
```

## 错误处理

| 场景 | 行为 |
|---|---|
| Deribit API 不可用 | 返回 L2 缓存中的过期数据（已有机制）；若无缓存则返回空列表 |
| 无符合条件的到期日 | 返回空列表，前端显示"暂无足够持仓数据的到期日" |
| 单到期日无数据 | 排除该到期日，从剩余候选中选择最近的一个 |
| 前端图表渲染失败 | ErrorFallback 组件兜底，支持重试 |

## 测试策略

### 后端测试

```typescript
// apps/api/src/trpc/trpc.service.test.ts
- OIDistribution 端点：给定 mock book summary，验证聚合逻辑
- 支撑/阻力加权中心计算正确性
- Max Pain 算法正确性（用已知结果验证）
- 到期日筛选阈值逻辑
```

### 前端测试

```typescript
// apps/web/app/components/modules/OIDistribution.test.tsx
- 组件渲染：加载态、数据态、错误态
- 到期日切换触发重新查询
- 蝴蝶图渲染（BarChart 配置验证）
- 支撑/阻力/Max Pain 数值正确显示
```

### 集成测试

```typescript
// apps/api/src/deribit/deribit.api.integration.test.ts
- 端到端：Deribit API → 后端聚合 → tRPC 响应
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `packages/shared-types/src/schemas/oi-distribution.ts` | 新增 | OI 分布相关 Schema |
| `packages/shared-types/src/schemas/index.ts` | 修改 | 导出新 Schema |
| `packages/shared-types/src/trpc/router.ts` | 修改 | 添加 oiDistribution endpoint 类型 |
| `apps/api/src/trpc/trpc.service.ts` | 修改 | 实现 oiDistribution endpoint |
| `apps/api/src/trpc/trpc.service.test.ts` | 修改 | 添加后端测试 |
| `apps/web/app/components/modules/OIDistribution.tsx` | 新增 | 蝴蝶图组件 |
| `apps/web/app/components/modules/OIDistribution.test.tsx` | 新增 | 组件测试 |
| `apps/web/app/hooks/useDashboardData.ts` | 修改 | 添加 useOIDistribution hook |
| `apps/web/app/components/DashboardLayout.tsx` | 修改 | 注册新模块 |

## 性能考量

- **后端聚合**：每次调用处理 ~1000 条 book summary 记录，Node.js 单次聚合耗时 < 50ms
- **缓存**：tRPC endpoint 可复用 DeribitService 的 30 秒内存缓存（底层 bookSummary 数据已缓存）
- **前端**：只传输单个到期日的 ~50-100 条 strike 记录，数据量 < 10KB
- **渲染**：Recharts 处理 100 条以内的 BarChart 数据非常流畅

## 后续扩展（不在本范围）

- 支持 ETH 期权
- 展示 OI 变化趋势（历史快照对比）
- 添加 IV Smile 曲线叠加
- 支持多日对比（并排显示两个到期日的蝴蝶图）
