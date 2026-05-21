# Greeks 风险暴露 Dashboard 模块设计

## 背景与目标

在 Kok Dashboard 中新增一个 **Greeks 风险暴露分析模块**，帮助用户从期权 Greeks 的细微变化中获取交易信号。Greeks 是衡量期权价格对各因素敏感度的重要指标，通过聚合分析可以揭示做市商对冲行为对市场价格的影响。

## 核心概念

### Gamma Exposure (GEX)

GEX = Σ (Gamma × Open Interest × Underlying Price × Contract Multiplier)

| GEX 状态 | 做市商头寸 | 市场效应 | 交易启示 |
|---------|----------|---------|---------|
| **GEX > 0** | 做空 gamma（卖出期权）| 稳定市场，压制波动 | 适合卖权策略（iron condors、credit spreads） |
| **GEX < 0** | 做多 gamma（买入期权）| 放大波动，加速趋势 | 适合买权策略（straddles、strangles） |

### 关键指标

| 指标 | 定义 | 交易意义 |
|------|------|---------|
| **零 Gamma 行权价** | 净 GEX 由正转负的临界点 | 突破此点后波动率制度改变 |
| **Call Wall** | 最大正 gamma 行权价 | 阻力位，价格上行到此被压制 |
| **Put Wall** | 最大负 gamma 行权价 | 支撑位，价格下行到此被托住 |
| **DEX** | Delta Exposure，方向性暴露总量 | 衡量市场整体方向性偏好 |

### 数据来源

Deribit API 验证结果：
- `get_book_summary_by_currency`：返回期权摘要，**不含 Greeks**
- `ticker`（按单个合约）：返回 `greeks: { delta, gamma, vega, theta, rho }`

因此需要逐个合约调 `ticker` 获取 Greeks，再结合 OI 计算暴露指标。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │     GreeksDashboard 模块                               │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────┐  │  │
│  │  │ 总GEX   │ │Call Wall│ │Put Wall │ │零Gamma行权价│  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │        GEX by Strike（蝴蝶图）                    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │        DEX by Strike（蝴蝶图）                    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │ tRPC query: greeks.exposure
┌─────────────────────────────┴───────────────────────────────┐
│                    后端 (NestJS)                             │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │  GreeksService       │    │  GreeksSchedulerService  │  │
│  │  - computeExposure() │◄───│  - 每5分钟定时触发        │  │
│  │  - getExposure()     │    │  - 渐进式分批计算         │  │
│  └──────────┬───────────┘    └──────────────────────────┘  │
│             │                                               │
│  ┌──────────┴───────────┐    ┌──────────────────────────┐  │
│  │  DeribitService      │    │  Cache (30s memory)      │  │
│  │  - getInstruments()  │───►│  - 聚合GEX结果           │  │
│  │  - getTicker()       │    │  - 计算进度标记          │  │
│  └──────────────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**模块层级**：新建 `GreeksModule`（独立 NestJS 模块），依赖 `DeribitModule`。

## 数据模型

### packages/shared-types

```typescript
// src/schemas/greeks.ts

export const GreekValuesSchema = z.object({
  delta: z.number(),
  gamma: z.number(),
  vega: z.number(),
  theta: z.number(),
  rho: z.number(),
});

export const StrikeGreeksSchema = z.object({
  strike: z.number(),
  call_oi: z.number(),
  put_oi: z.number(),
  call_gex: z.number(),  // Call Gamma × OI × Spot
  put_gex: z.number(),   // Put Gamma × OI × Spot
  net_gex: z.number(),   // call_gex + put_gex
  call_delta: z.number(),
  put_delta: z.number(),
  net_delta: z.number(),
});

export const GreeksProgressSchema = z.object({
  total: z.number(),
  completed: z.number(),
  is_complete: z.boolean(),
});

export const GreeksExposureSchema = z.object({
  currency: z.string(),
  total_gex: z.number(),
  total_dex: z.number(),
  zero_gamma_strike: z.number().nullable(),
  call_wall: z.number().nullable(),
  put_wall: z.number().nullable(),
  by_strike: z.array(StrikeGreeksSchema),
  progress: GreeksProgressSchema,
  timestamp: z.string().datetime(),
});
```

### tRPC Router 扩展

```typescript
// shared-types/src/trpc/router.ts
greeks: t.router({
  exposure: t.procedure
    .input(z.object({ currency: z.string().default('BTC') }))
    .query(async () => ({} as GreeksExposure)),
}),
```

## 后端渐进式计算逻辑

### 计算流程

1. 获取 BTC 所有活跃期权列表（`get_instruments`）
2. 获取现货价格（`get_index_price`）
3. 按优先级排序：
   ```
   优先级分数 = |days_to_expiry| + |moneyness - 1| × 10
   ```
   分数越低优先级越高（近期 + ATM 附近优先）
4. 分批逐个调 `ticker`（每批 **5 个合约**，间隔 **200ms** = 5 req/s）
5. 每批计算后**立即更新缓存中的聚合结果**
6. 整轮完成后标记 `is_complete = true`

### 伪代码

```typescript
async computeExposure(currency: string): Promise<GreeksExposure> {
  const instruments = await this.deribitService.getInstruments(currency, 'option');
  const { index_price: spot } = await this.deribitService.getIndexPrice(currency);

  const sorted = instruments
    .map(i => ({
      ...parseInstrument(i.instrument_name),
      priority: Math.abs(i.daysToExpiry) + Math.abs(i.strike / spot - 1) * 10,
    }))
    .sort((a, b) => a.priority - b.priority);

  const BATCH_SIZE = 5;
  const results: Array<{ strike: number; greeks: GreekValues; oi: number; type: 'C'|'P' }> = [];

  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    const batch = sorted.slice(i, i + BATCH_SIZE);
    const tickers = await Promise.all(
      batch.map(i => this.deribitService.getTicker(i.instrument_name))
    );

    for (const ticker of tickers) {
      results.push({
        strike: ticker.strike,
        greeks: ticker.greeks,
        oi: ticker.open_interest,
        type: ticker.option_type,
      });
    }

    // 每批完成后更新聚合缓存
    await this.updateCachedExposure(currency, results, sorted.length);

    if (i + BATCH_SIZE < sorted.length) await sleep(200);
  }

  return this.buildExposure(currency, results, spot, true);
}
```

### 聚合指标计算

- **总 GEX**：`Σ (gamma × open_interest × spot)` 按 Call/Put 分别计算后求和
- **零 Gamma 行权价**：找到 `net_gex` 由正转负的两个相邻行权价，线性插值
- **Call Wall**：`call_gex` 最大的行权价
- **Put Wall**：`put_gex` 最大的行权价（绝对值）
- **总 DEX**：`Σ (delta × open_interest)` 按 Call/Put 分别计算

## 前端组件设计

### 布局

```
┌──────────────────────────────────────────────────────────────┐
│ Greeks 风险暴露                                              │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  总 GEX     │  Call Wall  │  Put Wall   │  零 Gamma 行权价 │
│  +$12.4B    │   $85,000   │   $78,000   │     $81,500      │
│  🟢 正      │  🟢 阻力    │  🔴 支撑    │   翻转点        │
├─────────────┴─────────────┴─────────────┴──────────────────┤
│  📊 计算进度: 156/420 合约 (37%) ... [████████░░░░░░░░░░] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  GEX by Strike（蝴蝶图）                                     │
│  │                                                           │
│  │    🔴 Put GEX          🟢 Call GEX                        │
│  │  ←────────────────────────────────→                      │
│  │  $70K ████                                               │
│  │  $75K ████████                                           │
│  │  $80K ████████████  ━━━━━━━━  ← 净GEX线                  │
│  │  $85K       ████████████████                             │
│  │  $90K             ████████████████                       │
│  │                                                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Delta Exposure by Strike                                    │
│  [类似的蝴蝶图，展示净方向性暴露]                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 图表细节

**GEX Butterfly Chart**（沿用 OIDistribution 蝴蝶图模式）：
- **Y 轴**：行权价（从低到高）
- **X 轴 左侧（负值）**：Call GEX（绿色 `#4ade80`）
- **X 轴 右侧（正值）**：Put GEX（红色 `#e94560`）
- **叠加线**：Net GEX（黄色 `#fbbf24`）
- **Tooltip**：显示具体数值 + OI 量

### KPI 卡片颜色编码

- **正 GEX**：绿色（市场稳定，做市商做空 gamma）
- **负 GEX**：红色（市场不稳定，做市商做多 gamma）

### 前端 Hook

```typescript
export function useGreeksExposure(currency: string = 'BTC') {
  return trpc.greeks.exposure.useQuery({ currency }, {
    refetchInterval: 30000,
  });
}
```

### 文件结构

```
apps/web/app/components/modules/
├── GreeksDashboard.tsx      # 主组件（KPI + 图表）
├── GreeksDashboard.test.tsx # 测试
└── greeks/
    ├── GexChart.tsx         # GEX 蝴蝶图
    └── DexChart.tsx         # DEX 蝴蝶图
```

## 错误处理与边界情况

### API Rate Limit

Deribit 限制约 10 req/s。采用 **5 req/s**（每批 5 个合约，间隔 200ms），留 50% 安全余量。

**429 处理**：
- 指数退避重试（等 2s、4s、8s，最多 3 次）
- 其他错误（合约不存在等）跳过该合约，记录 warning

### 部分数据可用时的降级

| 完成度 | 可用指标 |
|--------|----------|
| 0% | 显示"正在计算..." |
| < 30% | ATM 附近的 GEX 已有参考价值 |
| 30-70% | 大部分关键行权价已覆盖，Wall 可能已出现 |
| > 70% | 几乎所有指标可靠 |
| 100% | 完整视图 |

每批计算后立即更新缓存，前端始终读取最新缓存。

### 空数据场景

```typescript
if (instruments.length === 0) {
  return {
    currency,
    total_gex: 0,
    total_dex: 0,
    zero_gamma_strike: null,
    call_wall: null,
    put_wall: null,
    by_strike: [],
    progress: { total: 0, completed: 0, is_complete: true },
    timestamp: new Date().toISOString(),
  };
}
```

### 缓存策略

| 层级 | 用途 | TTL |
|------|------|-----|
| 计算中缓存 | 存储部分聚合结果 | 5 分钟（或直到完成） |
| 完整结果缓存 | 供所有前端请求读取 | 30 秒 |

## 测试策略

### 后端测试

```typescript
describe('GreeksService', () => {
  describe('computeExposure', () => {
    it('应返回 ATM 附近合约的 GEX', async () => {});
    it('应按优先级排序：先计算近期到期', async () => {});
    it('应在部分计算后返回可用结果', async () => {});
    it('应处理 429 rate limit', async () => {});
  });

  describe('buildExposure', () => {
    it('应正确计算零 Gamma 行权价', () => {});
    it('应识别 Call Wall 和 Put Wall', () => {});
  });
});
```

### 前端测试

```typescript
describe('GreeksDashboard', () => {
  it('应渲染 KPI 卡片', () => {});
  it('应显示计算进度', () => {});
  it('正 GEX 应显示绿色，负 GEX 应显示红色', () => {});
  it('部分数据时应显示可用指标 + 进度提示', () => {});
});
```

## 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据获取策略 | 服务端定时渐进式计算 | 与现有 SnapshotSchedulerService 模式一致，所有用户共享结果 |
| Rate Limit | 5 req/s | 低于 Deribit 限制（10 req/s），留 50% 安全余量 |
| 计算批次 | 每批 5 个合约，间隔 200ms | 配合 5 req/s 限制 |
| GEX 计算 | Gamma × OI × Spot × Contract Size | Deribit 合约乘数为 1 BTC |
| 零 Gamma | 相邻行权价线性插值 | 简单可靠 |
| 前端刷新 | 每 30 秒 | 平衡实时性与服务器负载 |
