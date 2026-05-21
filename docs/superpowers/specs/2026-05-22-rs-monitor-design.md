# 相对强度监控系统设计文档

## 背景

加密货币市场中存在一种典型现象：某些代币在 BTC 下跌时反而上涨，当 BTC 恢复上涨时，这些代币往往有更大的涨幅。这本质上是资金轮动和 Beta 差异导致的相对强弱（Relative Strength）信号。

本系统旨在通过量化方法自动检测这种信号，并在 Dashboard 上实时呈现。

## 目标

- 每小时自动扫描市值 Top 50 代币的相对 BTC 强弱
- 识别"BTC 跌时抗跌、BTC 涨时领涨"的标的
- 通过 Dashboard 实时呈现排名和信号
- 支持历史回溯和图表分析

## 非目标

- 不构成交易建议，仅为信号监控
- 不覆盖小市值代币（< Top 50）
- 不实现实时 WebSocket 推送（1 小时级别轮询已足够）
- 不实现告警通知（Phase 2）
- 不实现多时间框架复合评分（Phase 2，当前仅 7D）

## 架构概述

```
相对强度监控模块 (RS Monitor)
├── Universe Service (CoinGecko)       -- 每日更新 Top 50 代币列表
├── OKX K 线 Service (Candles)         -- 每小时拉取 1H K 线
├── 评分计算 Service (RS Score)        -- 每小时计算横截面排名
├── PostgreSQL (K 线 + 信号)           -- 持久化存储
├── tRPC Router (rsMonitor)            -- 前后端接口
└── Dashboard 前端 (新增第 8 模块)      -- 排名表格 + 历史图表
```

## 数据流

1. **每日 00:00 UTC**：`UniverseSchedulerService` 从 CoinGecko 获取市值 Top 100，交叉过滤 OKX 现货可用性，保留 Top 50 写入 `token_universe` 表
2. **每小时 xx:05**：`CandleSchedulerService` 对每个 Universe 代币调用 OKX `GET /api/v5/market/candles?instId={token}-USDT&bar=1H`，增量拉取（最新 2-3 条），写入 `ohlcv` 表
3. **每小时 xx:10**：`ScoreSchedulerService` 从 PG 读取近 168 小时 K 线，计算每只代币的 7 日 BTC 计价收益，横截面 Z-Score 标准化，生成 0-100 评分，Top 20% 标记"强势"、Bottom 20% 标记"弱势"，写入 `rs_scores` 表
4. **前端**：Dashboard 卡片显示当前 Top 3 强势/弱势；点击展开排名表格；点击单个代币可查看历史图表

## 数据库设计

### token_universe

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 自增主键 |
| token_symbol | TEXT NOT NULL UNIQUE | 代币符号，如 "SUI" |
| inst_id | TEXT NOT NULL | OKX instId，如 "SUI-USDT" |
| rank | INTEGER NOT NULL | CoinGecko 市值排名 |
| market_cap_usd | NUMERIC(20, 2) | 市值（USD） |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | 更新时间 |

### ohlcv

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 自增主键 |
| inst_id | TEXT NOT NULL | OKX instId |
| timeframe | TEXT NOT NULL | 时间粒度，如 "1H" |
| ts | BIGINT NOT NULL | Unix timestamp（毫秒，OKX 返回格式） |
| open | NUMERIC(18, 8) NOT NULL | 开盘价 |
| high | NUMERIC(18, 8) NOT NULL | 最高价 |
| low | NUMERIC(18, 8) NOT NULL | 最低价 |
| close | NUMERIC(18, 8) NOT NULL | 收盘价 |
| volume | NUMERIC(24, 8) NOT NULL | 成交量 |
| created_at | TIMESTAMPTZ DEFAULT NOW() | 写入时间 |

唯一索引：`UNIQUE(inst_id, timeframe, ts)`
查询索引：`CREATE INDEX idx_ohlcv_lookup ON ohlcv(inst_id, timeframe, ts DESC)`

### rs_scores

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 自增主键 |
| scored_at | TIMESTAMPTZ NOT NULL | 评分时间 |
| token_symbol | TEXT NOT NULL | 代币符号 |
| rs_score | NUMERIC(5, 2) NOT NULL | 0-100 评分 |
| btc_return_7d | NUMERIC(8, 4) | 7 日 BTC 计价收益 |
| raw_return_7d | NUMERIC(8, 4) | 7 日 USD 计价收益 |
| z_score | NUMERIC(6, 4) | 横截面 Z-Score |
| signal | TEXT CHECK ('strong'\|'weak'\|'neutral') | 信号标签 |
| rank_position | INTEGER NOT NULL | 在 Universe 中的排名 1-50 |
| created_at | TIMESTAMPTZ DEFAULT NOW() | 写入时间 |

查询索引：`CREATE INDEX idx_rs_scores_time ON rs_scores(scored_at DESC, signal)`

## 后端模块设计

### okx/ 模块 — OKX API 客户端

- `OkxService`
  - `getCandles(instId: string, bar: string, limit: number): Promise<Candle[]>`
  - `getSpotTickers(): Promise<Ticker[]>`
  - 复用现有 `axios` HTTP 客户端模式
  - OKX 公开 API 无需认证，限速 20 req/2s

### universe/ 模块 — Universe 管理

- `UniverseService`
  - `getCurrentUniverse(): Promise<TokenUniverseItem[]>` — 从 PG 读取当前 Universe
  - `getBtcInstId(): string` — 返回 "BTC-USDT"
- `UniverseSchedulerService`
  - `@Cron('0 0 * * *')` — 每日 UTC 0 点执行
  - 调用 CoinGecko `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1`
  - 交叉验证 OKX 现货可用性（调用 `OkxService.getSpotTickers()`）
  - 保留前 50 个，写入 `token_universe` 表（UPSERT）

### rs-monitor/ 模块 — 核心计算

- `CandleSchedulerService`
  - `@Cron('5 * * * *')` — 每小时 xx:05 执行
  - 遍历 Universe 中每个代币，调用 `OkxService.getCandles(instId, '1H', 3)`
  - 增量写入 `ohlcv` 表，遇到已存在的 `ts` 则跳过（幂等）
  - BTC 同时拉取作为基准

- `ScoreSchedulerService`
  - `@Cron('10 * * * *')` — 每小时 xx:10 执行（延迟 5 分钟确保 K 线已写入）
  - 从 `ohlcv` 读取每个代币近 168 条 1H K 线
  - 计算 7 日 BTC 计价收益：`tokenUsdReturn - btcUsdReturn`
  - 横截面 Z-Score 标准化（Winsorize ±3 sigma）
  - 转换为 0-100 RS Score
  - Top 20% → `strong`，Bottom 20% → `weak`，中间 → `neutral`
  - 写入 `rs_scores` 表

- `RsMonitorService`
  - `getLatestScores(): Promise<RsScore[]>` — 最新评分列表
  - `getScoreHistory(tokenSymbol: string, days: number): Promise<RsScore[]>` — 单代币历史
  - `getTokenChartData(tokenSymbol: string): Promise<RsChartData>` — 单代币图表数据

### tRPC Router 扩展

新增 `rsMonitor` router：

- `rsMonitor.latest` → `RsMonitorService.getLatestScores()`
- `rsMonitor.history({ tokenSymbol, days })` → `RsMonitorService.getScoreHistory(tokenSymbol, days)`
- `rsMonitor.chart({ tokenSymbol })` → `RsMonitorService.getTokenChartData(tokenSymbol)`

## 评分算法

### 输入

- 当前 Universe 中的 50 个代币 + BTC
- 每个代币近 168 条 1H K 线（7 天）

### 计算步骤

1. 读取 BTC 近 168 条 K 线，计算 BTC 7 日 USD 收益：
   `btcReturn = (btcClose[167] - btcClose[0]) / btcClose[0]`

2. 对每个代币：
   - 读取近 168 条 K 线，跳过数据不足（< 100 条）的代币
   - 计算代币 7 日 USD 收益：`tokenUsdReturn = (tokenClose[167] - tokenClose[0]) / tokenClose[0]`
   - 计算 BTC 计价收益：`tokenBtcReturn = tokenUsdReturn - btcReturn`

3. 横截面 Z-Score 标准化：
   - `mean = average(tokenBtcReturns)`
   - `std = stdev(tokenBtcReturns)`
   - `zScore = (tokenBtcReturn - mean) / std`
   - `clampedZ = clamp(zScore, -3, 3)`
   - `rsScore = 50 + 10 * clampedZ`

4. 信号分类：
   - 按 `tokenBtcReturn` 排序，Top 20% → `strong`
   - Bottom 20% → `weak`
   - 中间 60% → `neutral`

### 输出

- 每只代币的 RS Score（0-100）、Z-Score、7D BTC 收益、7D USD 收益、信号标签、排名

## 前端设计

### Dashboard 新增模块

#### RSMOverviewCard（OverviewGrid 第 8 个卡片）

```
┌─────────────────────────────────────────┐
│  相对强度监控                              │
│                                         │
│  强势                                    │
│  1. SUI   +12.3% vs BTC    Score: 89    │
│  2. SOL   +8.7% vs BTC     Score: 82    │
│  3. AVAX  +5.2% vs BTC     Score: 76    │
│                                         │
│  弱势                                    │
│  1. DOGE  -8.1% vs BTC     Score: 23    │
│  2. SHIB  -6.4% vs BTC     Score: 28    │
│  3. XRP   -4.2% vs BTC     Score: 31    │
│                                         │
│  [查看完整排名 →]                         │
└─────────────────────────────────────────┘
```

- 颜色编码：强势 → 绿色，弱势 → 红色，中性 → 灰色
- 点击卡片打开 Detail Drawer

#### RSMDetailView（Drawer 详情面板）

**Tab 1：排名表格**
- 50 行完整排名
- 列：排名、代币、当前价格、7D BTC 收益、RS Score、信号标签
- 按 RS Score 降序排列
- 点击某行切换到详情 Tab

**Tab 2：代币详情**
- 价格 vs BTC 价格比值折线图（7 天，Recharts）
- RS Score 历史折线图（7 天）
- 当前信号解读文字（如"SUI 在过去 7 日相对 BTC 上涨 12.3%，处于全市场前 10%"）

### 新增 Hooks

```typescript
// useDashboardData.ts
export const useRSLatest = () => trpc.rsMonitor.latest.useQuery();
export const useRSHistory = (tokenSymbol: string, days = 7) =>
  trpc.rsMonitor.history.useQuery({ tokenSymbol, days });
export const useRSChart = (tokenSymbol: string) =>
  trpc.rsMonitor.chart.useQuery({ tokenSymbol });
```

### 数据刷新策略

- 排名表格：`refetchInterval: 60000`（1 分钟轮询）
- 图表数据：`staleTime: 300000`（5 分钟）

## 共享类型（Zod Schema）

新增 `packages/shared-types/src/schemas/rs-monitor.ts`：

```typescript
export const TokenUniverseItem = z.object({
  tokenSymbol: z.string(),
  instId: z.string(),
  rank: z.number(),
  marketCapUsd: z.number().optional(),
});

export const Candle = z.object({
  ts: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  vol: z.string(),
  volCcy: z.string(),
  volCcyQuote: z.string(),
  confirm: z.string(),
});

export const RsScore = z.object({
  tokenSymbol: z.string(),
  rsScore: z.number(),      // 0-100
  btcReturn7d: z.number(),  // decimal, e.g. 0.123 = +12.3%
  rawReturn7d: z.number(),
  zScore: z.number(),
  signal: z.enum(['strong', 'weak', 'neutral']),
  rankPosition: z.number(),
  scoredAt: z.string(),     // ISO timestamp
});

export const RsChartData = z.object({
  timestamps: z.array(z.string()),
  prices: z.array(z.number()),       // token USD price
  btcRatio: z.array(z.number()),     // token/BTC ratio
  scores: z.array(z.number()),       // RS Score history
});
```

## Cron 调度

| 任务 | Cron | 说明 |
|------|------|------|
| updateUniverse | `0 0 * * *` | 每日 UTC 0 点更新 Universe |
| fetchCandles | `5 * * * *` | 每小时 xx:05 拉取 K 线 |
| calculateScores | `10 * * * *` | 每小时 xx:10 计算评分 |

## 错误处理

| 场景 | 处理策略 |
|------|---------|
| CoinGecko API 失败 | 保留昨日 Universe，记警告日志，前端显示"Universe 数据可能过期" |
| OKX candles 部分失败 | 跳过失败代币，继续计算其他；失败代币评分标记为 null |
| 新代币 K 线不足 100 条 | 跳过评分，表格中显示"数据不足" |
| 所有 API 均失败 | 前端显示 ErrorFallback + 重试按钮 |

## 外部 API 调用量

| 来源 | 端点 | 频率 | 日总量 |
|------|------|------|--------|
| CoinGecko | `/coins/markets` | 1 次/天 | 1 |
| OKX | `/market/candles` | 51 次/小时 | ~1224 |
| OKX | `/market/tickers` | 1 次/天 | 1 |

OKX 限速 20 req/2s，每小时 51 次调用完全无压力。

## 范围

### 包含

- CoinGecko + OKX API 客户端
- 3 个 PG 表 + 自动建表
- 3 个 Cron 调度服务
- RS Score 计算引擎
- tRPC router 扩展
- Dashboard 新增第 8 模块（卡片 + 详情 Drawer）
- 共享 Zod schema

### 不包含（Phase 2）

- WebSocket 实时推送
- 比值 RSI 完整实现（当前只计算 BTC 计价收益 Z-Score）
- 告警通知（Telegram/邮件）
- 回测框架
- 多时间框架复合评分（当前只有 7D）
- 滚动 Beta 计算

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| CoinGecko 免费 API 限流 | 每日仅 1 次调用；如失败保留昨日 Universe |
| OKX 移除某些现货交易对 | Universe 每日更新会自动过滤；历史 K 线保留但新数据不再写入 |
| Z-Score 对市场极端行情敏感 | Winsorize ±3 sigma；极端行情下所有代币趋向中性 |
| 新上币 K 线不足 | 跳过评分，表格显示"数据不足"，满 100 条后自动纳入 |

## 验收标准

1. Dashboard 新增"相对强度监控"卡片，正确显示 Top 3 强势和弱势代币
2. 点击卡片打开 Detail Drawer，展示 50 只代币的完整排名表格
3. 点击表格中某代币，展示 7 天价格/BTC 比值/RS Score 历史图表
4. 每小时自动生成新评分，前端 1 分钟内刷新显示
5. 每日自动更新 Universe，新上币/下币正确反映在排名中
6. API 失败时有优雅的降级和错误提示
