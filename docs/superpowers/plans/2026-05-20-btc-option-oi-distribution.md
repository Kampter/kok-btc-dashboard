# BTC 期权持仓 OI 分布 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 Dashboard 模块"期权 OI 分布"，支持选择到期日，展示 Call/Put 在行权价上的持仓分布（蝴蝶图），并计算阻力、支撑、Max Pain。

**Architecture:** 后端新增 tRPC endpoint `oiDistribution`，从 Deribit book summary 聚合单个到期日的 OI 分布数据；前端新增 `OIDistribution` 组件，用 Recharts BarChart 渲染水平对称蝴蝶图。

**Tech Stack:** NestJS + tRPC (backend), React 19 + Recharts + Tailwind CSS v4 (frontend), Zod (shared types), Vitest (testing)

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `packages/shared-types/src/schemas/oi-distribution.ts` | 新增 | Zod Schema：OIStrikeItem、OIDistribution、OIDistributionList |
| `packages/shared-types/src/schemas/index.ts` | 修改 | 导出新 Schema |
| `packages/shared-types/src/trpc/router.ts` | 修改 | 添加 `oiDistribution` endpoint 类型占位 |
| `apps/api/src/trpc/trpc.service.ts` | 修改 | 实现 `oiDistribution` endpoint：聚合逻辑 + Max Pain 计算 |
| `apps/api/src/trpc/trpc.service.test.ts` | 修改 | 测试：聚合正确性、加权中心、Max Pain、到期日筛选、错误处理 |
| `apps/web/app/hooks/useDashboardData.ts` | 修改 | 添加 `useOIDistribution` hook |
| `apps/web/app/components/modules/OIDistribution.tsx` | 新增 | 蝴蝶图组件：到期日选择器 + 指标卡片 + 对称条形图 |
| `apps/web/app/components/modules/OIDistribution.test.tsx` | 新增 | 组件测试：渲染、加载态、数据态、错误态 |
| `apps/web/app/components/DashboardLayout.tsx` | 修改 | 注册新模块到 Tab 导航 |

---

### Task 1: 新增 shared-types Schema

**Files:**
- Create: `packages/shared-types/src/schemas/oi-distribution.ts`
- Modify: `packages/shared-types/src/schemas/index.ts`

- [ ] **Step 1: 编写 OI 分布 Schema**

Create `packages/shared-types/src/schemas/oi-distribution.ts`:

```typescript
import { z } from 'zod';

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

export const ExpiryItemSchema = z.object({
  expiry: z.string().datetime(),
  days_to_expiry: z.number(),
  total_oi_usd: z.number(),
});

export const OIDistributionListSchema = z.object({
  expiries: z.array(ExpiryItemSchema),
  selected: OIDistributionSchema,
});

export type OIStrikeItem = z.infer<typeof OIStrikeItemSchema>;
export type OIDistribution = z.infer<typeof OIDistributionSchema>;
export type OIDistributionList = z.infer<typeof OIDistributionListSchema>;
```

- [ ] **Step 2: 更新 index.ts 导出**

Modify `packages/shared-types/src/schemas/index.ts`:

```typescript
export * from './option.js';
export * from './trade.js';
export * from './oi-distribution.js';
```

- [ ] **Step 3: 构建并验证类型**

Run:
```bash
cd packages/shared-types && pnpm build
```

Expected: 编译成功，无错误。

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/src/schemas/
git commit -m "feat(shared-types): add OI distribution schemas"
```

---

### Task 2: 更新 tRPC router 类型定义

**Files:**
- Modify: `packages/shared-types/src/trpc/router.ts`

- [ ] **Step 1: 添加 oiDistribution endpoint 类型占位**

Modify `packages/shared-types/src/trpc/router.ts`:

```typescript
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { OptionSummary, MarketOverview } from '../schemas/option.js';
import type { OptionTrade } from '../schemas/trade.js';
import type { OIDistributionList } from '../schemas/oi-distribution.js';

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

    oiDistribution: t.procedure
      .input(z.object({
        currency: z.string().default('BTC'),
        expiry: z.string().datetime().optional(),
      }))
      .query(async () => ({} as OIDistributionList)),
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
      .mutation(async () => ({ success: true })),
  }),
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 2: 构建并验证**

Run:
```bash
cd packages/shared-types && pnpm build
```

Expected: 编译成功。

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/trpc/router.ts
git commit -m "feat(shared-types): add oiDistribution to tRPC router types"
```

---

### Task 3: 后端实现 oiDistribution endpoint

**Files:**
- Modify: `apps/api/src/trpc/trpc.service.ts`

- [ ] **Step 1: 实现聚合逻辑和 Max Pain 计算**

Modify `apps/api/src/trpc/trpc.service.ts` — 在 `historicalVolatility` endpoint 之后、`chat` router 之前，新增 `oiDistribution` endpoint：

新增 import：
```typescript
import {
  MarketOverviewSchema,
  OptionSummarySchema,
  OptionTradeSchema,
  OIDistributionListSchema,
  parseInstrumentName,
  getOptionTypeFromInstrumentName,
} from '@kok/shared-types';
```

在 `historicalVolatility` 的 closing `}),` 之后，添加：

```typescript
      oiDistribution: t.procedure
        .input(
          z.object({
            currency: z.string().default('BTC'),
            expiry: z.string().datetime().optional(),
          }),
        )
        .query(async ({ input }) => {
          try {
            const MIN_OI_USD = 100_000_000; // $100M 阈值
            const MAX_EXPIRIES = 10;

            const [bookData, indexData] = await Promise.all([
              this.deribitService.getBookSummaryByCurrency(input.currency, 'option'),
              this.deribitService.getIndexPrice(`${input.currency.toLowerCase()}_usd`),
            ]);

            const spotPrice = indexData.index_price ?? 0;

            // Step 1: Parse raw data into structured items
            interface ParsedItem {
              expiryIso: string;
              strike: number;
              optionType: 'C' | 'P';
              oi: number;
              oiUsd: number;
            }

            const items: ParsedItem[] = [];
            for (const raw of bookData) {
              const name = String(raw.instrument_name ?? '');
              let expiryIso: string;
              let strike: number;
              let optionType: 'C' | 'P';

              try {
                const parsed = parseInstrumentName(name);
                expiryIso = parsed.expiry;
                strike = parsed.strike;
                optionType = parsed.optionType;
              } catch {
                // Fallback to raw fields if parsing fails
                const rawExpiry = raw.expiry as number;
                expiryIso = new Date(rawExpiry).toISOString();
                strike = raw.strike as number;
                optionType = (raw.option_type as 'C' | 'P') ?? getOptionTypeFromInstrumentName(name);
              }

              const oi = (raw.open_interest as number) ?? 0;
              const underlyingPrice = (raw.underlying_price as number) ?? spotPrice;
              const contractSize = 0.001;
              const oiUsd = oi * underlyingPrice * contractSize;

              items.push({ expiryIso, strike, optionType, oi, oiUsd });
            }

            // Step 2: Group by expiry and calculate total OI per expiry
            const expiryMap = new Map<string, { totalOiUsd: number; items: ParsedItem[] }>();
            for (const item of items) {
              const existing = expiryMap.get(item.expiryIso) ?? { totalOiUsd: 0, items: [] };
              existing.totalOiUsd += item.oiUsd;
              existing.items.push(item);
              expiryMap.set(item.expiryIso, existing);
            }

            // Step 3: Filter and sort expiries
            const now = new Date();
            const validExpiries = Array.from(expiryMap.entries())
              .filter(([_, data]) => data.totalOiUsd >= MIN_OI_USD)
              .map(([expiryIso, data]) => ({
                expiryIso,
                totalOiUsd: data.totalOiUsd,
                daysToExpiry: Math.ceil(
                  (new Date(expiryIso).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                ),
              }))
              .filter((e) => e.daysToExpiry >= 0)
              .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
              .slice(0, MAX_EXPIRIES);

            if (validExpiries.length === 0) {
              return OIDistributionListSchema.parse({
                expiries: [],
                selected: {
                  expiry: now.toISOString(),
                  days_to_expiry: 0,
                  total_call_oi: 0,
                  total_put_oi: 0,
                  total_call_oi_usd: 0,
                  total_put_oi_usd: 0,
                  resistance: 0,
                  support: 0,
                  max_pain: 0,
                  spot_price: spotPrice,
                  strike_distribution: [],
                },
              });
            }

            // Step 4: Select expiry
            const selectedExpiry =
              input.expiry && expiryMap.has(input.expiry)
                ? input.expiry
                : validExpiries[0].expiryIso;

            const selectedData = expiryMap.get(selectedExpiry)!;

            // Step 5: Aggregate by strike
            const strikeMap = new Map<
              number,
              { callOi: number; putOi: number; callOiUsd: number; putOiUsd: number }
            >();
            for (const item of selectedData.items) {
              const existing = strikeMap.get(item.strike) ?? {
                callOi: 0,
                putOi: 0,
                callOiUsd: 0,
                putOiUsd: 0,
              };
              if (item.optionType === 'C') {
                existing.callOi += item.oi;
                existing.callOiUsd += item.oiUsd;
              } else {
                existing.putOi += item.oi;
                existing.putOiUsd += item.oiUsd;
              }
              strikeMap.set(item.strike, existing);
            }

            const strikeDistribution = Array.from(strikeMap.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([strike, data]) => ({
                strike,
                call_oi: data.callOi,
                put_oi: data.putOi,
                call_oi_usd: data.callOiUsd,
                put_oi_usd: data.putOiUsd,
              }));

            // Step 6: Calculate totals
            const totalCallOi = strikeDistribution.reduce((s, d) => s + d.call_oi, 0);
            const totalPutOi = strikeDistribution.reduce((s, d) => s + d.put_oi, 0);
            const totalCallOiUsd = strikeDistribution.reduce((s, d) => s + d.call_oi_usd, 0);
            const totalPutOiUsd = strikeDistribution.reduce((s, d) => s + d.put_oi_usd, 0);

            // Step 7: Calculate weighted centers (resistance / support)
            let resistance = 0;
            if (totalCallOiUsd > 0) {
              resistance =
                strikeDistribution.reduce((s, d) => s + d.strike * d.call_oi_usd, 0) /
                totalCallOiUsd;
            }

            let support = 0;
            if (totalPutOiUsd > 0) {
              support =
                strikeDistribution.reduce((s, d) => s + d.strike * d.put_oi_usd, 0) /
                totalPutOiUsd;
            }

            // Step 8: Calculate Max Pain
            // Max Pain = strike that minimizes total intrinsic value across all options
            const strikes = strikeDistribution.map((d) => d.strike);
            let maxPain = strikes[0] ?? 0;
            let minIntrinsicValue = Infinity;

            for (const s of strikes) {
              let intrinsicValue = 0;
              for (const d of strikeDistribution) {
                // Call intrinsic value: max(0, S - strike)
                intrinsicValue += d.call_oi * Math.max(0, s - d.strike);
                // Put intrinsic value: max(0, strike - S)
                intrinsicValue += d.put_oi * Math.max(0, d.strike - s);
              }
              if (intrinsicValue < minIntrinsicValue) {
                minIntrinsicValue = intrinsicValue;
                maxPain = s;
              }
            }

            const daysToExpiry = Math.ceil(
              (new Date(selectedExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );

            return OIDistributionListSchema.parse({
              expiries: validExpiries.map((e) => ({
                expiry: e.expiryIso,
                days_to_expiry: e.daysToExpiry,
                total_oi_usd: e.totalOiUsd,
              })),
              selected: {
                expiry: selectedExpiry,
                days_to_expiry: daysToExpiry,
                total_call_oi: totalCallOi,
                total_put_oi: totalPutOi,
                total_call_oi_usd: totalCallOiUsd,
                total_put_oi_usd: totalPutOiUsd,
                resistance,
                support,
                max_pain: maxPain,
                spot_price: spotPrice,
                strike_distribution: strikeDistribution,
              },
            });
          } catch (error) {
            handleTrpcError('Failed to fetch OI distribution data', error);
          }
        }),
```

- [ ] **Step 2: 编译验证后端**

Run:
```bash
cd apps/api && pnpm typecheck
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/trpc/trpc.service.ts
git commit -m "feat(api): implement oiDistribution tRPC endpoint"
```

---

### Task 4: 后端测试

**Files:**
- Modify: `apps/api/src/trpc/trpc.service.test.ts`

- [ ] **Step 1: 添加 oiDistribution 测试**

Modify `apps/api/src/trpc/trpc.service.test.ts` — 在 `historicalVolatility` describe 块之后添加：

```typescript
  describe('oiDistribution', () => {
    const mockBookData = [
      // Expiry 2026-05-30
      { instrument_name: 'BTC-30MAY26-70000-C', strike: 70000, expiry: 1748620800000, option_type: 'C', open_interest: 1000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-70000-P', strike: 70000, expiry: 1748620800000, option_type: 'P', open_interest: 3000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-80000-C', strike: 80000, expiry: 1748620800000, option_type: 'C', open_interest: 5000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-80000-P', strike: 80000, expiry: 1748620800000, option_type: 'P', open_interest: 1000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-90000-C', strike: 90000, expiry: 1748620800000, option_type: 'C', open_interest: 2000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-90000-P', strike: 90000, expiry: 1748620800000, option_type: 'P', open_interest: 500, underlying_price: 90000 },
      // Expiry 2026-06-27 (low OI, should be filtered out)
      { instrument_name: 'BTC-27JUN26-85000-C', strike: 85000, expiry: 1751001600000, option_type: 'C', open_interest: 10, underlying_price: 90000 },
    ]

    it('returns OI distribution for the nearest expiry by default', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(mockBookData)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 90000, estimated_delivery_price: 90000 })

      const result = await caller.deribit.oiDistribution({ currency: 'BTC' })

      expect(result.expiries).toHaveLength(1)
      expect(result.selected.strike_distribution).toHaveLength(3)
      // Call weighted center: (70000*1000 + 80000*5000 + 90000*2000) / 8000 = 81250
      expect(result.selected.resistance).toBeCloseTo(81250, 0)
      // Put weighted center: (70000*3000 + 80000*1000 + 90000*500) / 4500 = 74444...
      expect(result.selected.support).toBeCloseTo(74444, 0)
      // Max Pain at $80000 (minimizes total intrinsic value)
      expect(result.selected.max_pain).toBe(80000)
    })

    it('returns specific expiry when provided', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(mockBookData)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 90000, estimated_delivery_price: 90000 })

      const result = await caller.deribit.oiDistribution({
        currency: 'BTC',
        expiry: '2026-05-30T08:00:00.000Z',
      })

      expect(result.selected.expiry).toBe('2026-05-30T08:00:00.000Z')
      expect(result.selected.strike_distribution).toHaveLength(3)
    })

    it('returns empty distribution when no valid expiries', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue([
        { instrument_name: 'BTC-30MAY26-70000-C', strike: 70000, expiry: 1748620800000, option_type: 'C', open_interest: 1, underlying_price: 90000 },
      ])
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 90000, estimated_delivery_price: 90000 })

      const result = await caller.deribit.oiDistribution({ currency: 'BTC' })

      expect(result.expiries).toEqual([])
      expect(result.selected.strike_distribution).toEqual([])
    })

    it('handles DeribitService failure', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockRejectedValue(new Error('Service down'))

      await expect(caller.deribit.oiDistribution({ currency: 'BTC' })).rejects.toThrow(TRPCError)
    })
  })
```

- [ ] **Step 2: 运行测试**

Run:
```bash
cd apps/api && pnpm test -- src/trpc/trpc.service.test.ts
```

Expected: 所有测试通过。

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/trpc/trpc.service.test.ts
git commit -m "test(api): add oiDistribution endpoint tests"
```

---

### Task 5: 前端 Hook

**Files:**
- Modify: `apps/web/app/hooks/useDashboardData.ts`

- [ ] **Step 1: 添加 useOIDistribution hook**

Modify `apps/web/app/hooks/useDashboardData.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc';

export function useMarketOverview() {
  return useQuery(trpc.deribit.marketOverview.queryOptions());
}

export function useBookSummary(currency: string, kind: string) {
  return useQuery(
    trpc.deribit.bookSummary.queryOptions({ currency, kind }),
  );
}

export function useTrades(currency: string, count = 100) {
  return useQuery(
    trpc.deribit.trades.queryOptions({ currency, count }),
  );
}

export function useHistoricalVolatility(currency: string) {
  return useQuery(
    trpc.deribit.historicalVolatility.queryOptions({ currency }),
  );
}

export function useOIDistribution(currency: string, expiry?: string) {
  return useQuery(
    trpc.deribit.oiDistribution.queryOptions({ currency, expiry }),
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/hooks/useDashboardData.ts
git commit -m "feat(web): add useOIDistribution hook"
```

---

### Task 6: 前端 OIDistribution 组件

**Files:**
- Create: `apps/web/app/components/modules/OIDistribution.tsx`

- [ ] **Step 1: 实现蝴蝶图组件**

Create `apps/web/app/components/modules/OIDistribution.tsx`:

```typescript
import * as React from 'react';
import { useOIDistribution } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ErrorFallback } from '../ui/error-fallback';
import { formatUSD } from '../../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const CALL_COLOR = '#4ade80';
const PUT_COLOR = '#e94560';

interface ChartRow {
  strike: string;
  rawStrike: number;
  call_oi: number;
  put_oi: number;
}

export function OIDistribution() {
  const { data, isLoading, isError, refetch } = useOIDistribution('BTC');
  const [selectedExpiry, setSelectedExpiry] = React.useState<string>('');

  const { queryOptions } = useOIDistribution('BTC', selectedExpiry || undefined);

  // When data loads, set default selected expiry
  React.useEffect(() => {
    if (data && data.expiries.length > 0 && !selectedExpiry) {
      setSelectedExpiry(data.expiries[0].expiry);
    }
  }, [data, selectedExpiry]);

  // Refetch when expiry changes
  const { data: selectedData, isLoading: isLoadingSelected } = useOIDistribution(
    'BTC',
    selectedExpiry || undefined,
  );

  const distribution = selectedData?.selected;

  const chartData: ChartRow[] = React.useMemo(() => {
    if (!distribution) return [];
    return distribution.strike_distribution.map((item) => ({
      strike: `$${(item.strike / 1000).toFixed(0)}K`,
      rawStrike: item.strike,
      call_oi: -item.call_oi_usd,
      put_oi: item.put_oi_usd,
    }));
  }, [distribution]);

  const metrics = React.useMemo(() => {
    if (!distribution) return null;
    return {
      resistance: distribution.resistance,
      support: distribution.support,
      maxPain: distribution.max_pain,
      daysToExpiry: distribution.days_to_expiry,
    };
  }, [distribution]);

  if (isLoading || isLoadingSelected) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="h-16" />
        </Card>
        <Card className="animate-pulse">
          <CardContent className="h-96" />
        </Card>
      </div>
    );
  }

  if (isError) {
    return <ErrorFallback title="OI 分布数据加载失败" onRetry={() => refetch()} />;
  }

  if (!data || data.expiries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          暂无足够持仓数据的到期日
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with expiry selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            className="rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
          >
            {data.expiries.map((exp) => (
              <option key={exp.expiry} value={exp.expiry}>
                {new Date(exp.expiry).toLocaleDateString('zh-CN')} (
                {exp.days_to_expiry}天后)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">阻力位置</div>
              <div className="text-lg font-bold text-call">{formatUSD(metrics.resistance)}</div>
              <div className="text-xs text-muted-foreground">Call OI 加权中心</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">支撑位置</div>
              <div className="text-lg font-bold text-put">{formatUSD(metrics.support)}</div>
              <div className="text-xs text-muted-foreground">Put OI 加权中心</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">Max Pain</div>
              <div className="text-lg font-bold text-warning">{formatUSD(metrics.maxPain)}</div>
              <div className="text-xs text-muted-foreground">买方损失最大点</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Butterfly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">期权持仓 OI 分布（蝴蝶图）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CALL_COLOR }} />
              Call OI
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: PUT_COLOR }} />
              Put OI
            </span>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v: number) => formatUSD(Math.abs(v))}
              />
              <YAxis
                dataKey="strike"
                type="category"
                stroke="#94a3b8"
                fontSize={11}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                }}
                formatter={(value: number, name: string) => {
                  const absValue = Math.abs(value);
                  const label = name === 'call_oi' ? 'Call OI' : 'Put OI';
                  return [formatUSD(absValue), label];
                }}
              />
              <Bar dataKey="call_oi" fill={CALL_COLOR} radius={[2, 0, 0, 2]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`call-${index}`}
                    fill={entry.rawStrike === metrics?.resistance ? '#22c55e' : CALL_COLOR}
                  />
                ))}
              </Bar>
              <Bar dataKey="put_oi" fill={PUT_COLOR} radius={[0, 2, 2, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`put-${index}`}
                    fill={entry.rawStrike === metrics?.support ? '#ef4444' : PUT_COLOR}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 检查 tailwind 颜色变量**

确认 `globals.css` 中定义了 `text-call`、`text-put`、`text-warning` 等颜色类：

Run:
```bash
grep -n "call\|put\|warning" /Users/wangzizheng/Desktop/kok/apps/web/app/globals.css
```

如果这些类不存在，需要添加（检查后再决定）。查看 globals.css：

如果缺少，在 `globals.css` 的 `@theme` 块中添加：
```css
--color-call: #4ade80;
--color-put: #e94560;
--color-warning: #fbbf24;
```

以及对应的 text 类：
```css
.text-call { color: var(--color-call); }
.text-put { color: var(--color-put); }
.text-warning { color: var(--color-warning); }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/modules/OIDistribution.tsx
git commit -m "feat(web): add OIDistribution butterfly chart component"
```

---

### Task 7: 前端组件测试

**Files:**
- Create: `apps/web/app/components/modules/OIDistribution.test.tsx`

- [ ] **Step 1: 编写组件测试**

Create `apps/web/app/components/modules/OIDistribution.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OIDistribution } from './OIDistribution';

// Mock the hook
vi.mock('../../hooks/useDashboardData', () => ({
  useOIDistribution: vi.fn(),
}));

import { useOIDistribution } from '../../hooks/useDashboardData';

const mockData = {
  expiries: [
    { expiry: '2026-05-30T08:00:00.000Z', days_to_expiry: 7, total_oi_usd: 500000000 },
    { expiry: '2026-06-27T08:00:00.000Z', days_to_expiry: 35, total_oi_usd: 300000000 },
  ],
  selected: {
    expiry: '2026-05-30T08:00:00.000Z',
    days_to_expiry: 7,
    total_call_oi: 8000,
    total_put_oi: 4500,
    total_call_oi_usd: 250000000,
    total_put_oi_usd: 150000000,
    resistance: 85000,
    support: 75000,
    max_pain: 80000,
    spot_price: 90000,
    strike_distribution: [
      { strike: 70000, call_oi: 1000, put_oi: 3000, call_oi_usd: 50000000, put_oi_usd: 150000000 },
      { strike: 80000, call_oi: 5000, put_oi: 1000, call_oi_usd: 150000000, put_oi_usd: 50000000 },
      { strike: 90000, call_oi: 2000, put_oi: 500, call_oi_usd: 50000000, put_oi_usd: 25000000 },
    ],
  },
};

describe('OIDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    vi.mocked(useOIDistribution).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<OIDistribution />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error fallback on failure', () => {
    vi.mocked(useOIDistribution).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    render(<OIDistribution />);

    expect(screen.getByText('OI 分布数据加载失败')).toBeInTheDocument();
  });

  it('renders empty state when no expiries', () => {
    vi.mocked(useOIDistribution).mockReturnValue({
      data: { expiries: [], selected: mockData.selected },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<OIDistribution />);

    expect(screen.getByText('暂无足够持仓数据的到期日')).toBeInTheDocument();
  });

  it('renders metrics and chart with data', () => {
    vi.mocked(useOIDistribution).mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<OIDistribution />);

    // Metrics
    expect(screen.getByText('阻力位置')).toBeInTheDocument();
    expect(screen.getByText('支撑位置')).toBeInTheDocument();
    expect(screen.getByText('Max Pain')).toBeInTheDocument();

    // Chart title
    expect(screen.getByText('期权持仓 OI 分布（蝴蝶图）')).toBeInTheDocument();

    // Expiry selector
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('switches expiry when select changes', async () => {
    const mockRefetch = vi.fn();
    vi.mocked(useOIDistribution).mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as any);

    render(<OIDistribution />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2026-06-27T08:00:00.000Z' } });

    await waitFor(() => {
      expect(select).toHaveValue('2026-06-27T08:00:00.000Z');
    });
  });
});
```

- [ ] **Step 2: 运行前端测试**

Run:
```bash
cd apps/web && pnpm test -- app/components/modules/OIDistribution.test.tsx
```

Expected: 所有测试通过。

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/modules/OIDistribution.test.tsx
git commit -m "test(web): add OIDistribution component tests"
```

---

### Task 8: DashboardLayout 注册新模块

**Files:**
- Modify: `apps/web/app/components/DashboardLayout.tsx`

- [ ] **Step 1: 注册 OIDistribution 模块**

Modify `apps/web/app/components/DashboardLayout.tsx`:

```typescript
import { useState, memo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { MarketOverview } from './modules/MarketOverview'
import { VolatilityAnalysis } from './modules/VolatilityAnalysis'
import { PositionStructure } from './modules/PositionStructure'
import { FundingSentiment } from './modules/FundingSentiment'
import { ExpiryAnalysis } from './modules/ExpiryAnalysis'
import { OIDistribution } from './modules/OIDistribution'

const MODULES = [
  { id: 'overview', label: '市场概况' },
  { id: 'volatility', label: '波动率分析' },
  { id: 'positions', label: '持仓结构' },
  { id: 'sentiment', label: '资金情绪' },
  { id: 'expiry', label: '到期分析' },
  { id: 'oi', label: 'OI 分布' },
] as const

type ModuleId = (typeof MODULES)[number]['id']

const MemoMarketOverview = memo(MarketOverview)
const MemoVolatilityAnalysis = memo(VolatilityAnalysis)
const MemoPositionStructure = memo(PositionStructure)
const MemoFundingSentiment = memo(FundingSentiment)
const MemoExpiryAnalysis = memo(ExpiryAnalysis)
const MemoOIDistribution = memo(OIDistribution)

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<ModuleId>('overview')

  return (
    <div className="min-h-screen bg-background">
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
          <TabsContent value="oi">
            <MemoOIDistribution />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/DashboardLayout.tsx
git commit -m "feat(web): register OIDistribution module in DashboardLayout"
```

---

### Task 9: 全量验证

- [ ] **Step 1: 运行 shared-types 类型检查**

```bash
cd packages/shared-types && pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 2: 运行 API 类型检查**

```bash
cd apps/api && pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 3: 运行 API 测试**

```bash
cd apps/api && pnpm test:run
```

Expected: 全部通过。

- [ ] **Step 4: 运行 Web 类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 5: 运行 Web 测试**

```bash
cd apps/web && pnpm test:run
```

Expected: 全部通过。

- [ ] **Step 6: 最终 Commit**

```bash
git add .
git commit -m "feat: BTC option OI distribution analysis with butterfly chart"
```

---

## Spec Coverage Check

| Spec 需求 | 对应 Task |
|---|---|
| 新增 Zod Schema（OIStrikeItem, OIDistribution, OIDistributionList） | Task 1 |
| tRPC router 类型更新 | Task 2 |
| 后端聚合逻辑（按 expiry/strike 分组） | Task 3 |
| 到期日筛选（OI > $100M，前 10 个） | Task 3 |
| 阻力/支撑加权中心计算 | Task 3 |
| Max Pain 算法 | Task 3 |
| 后端测试（聚合、Max Pain、筛选、错误） | Task 4 |
| 前端 hook | Task 5 |
| 蝴蝶图组件（Recharts BarChart） | Task 6 |
| 到期日选择器 | Task 6 |
| 指标卡片（阻力/支撑/Max Pain） | Task 6 |
| 前端组件测试 | Task 7 |
| DashboardLayout 注册 | Task 8 |
| 全量类型检查 + 测试 | Task 9 |

## Placeholder Scan

- ✅ 无 "TBD"、"TODO"、"implement later"
- ✅ 无 "Add appropriate error handling" 等模糊描述
- ✅ 所有代码步骤包含完整代码
- ✅ 类型名称一致（`OIDistributionListSchema`、`OIStrikeItemSchema` 等）

## Type Consistency Check

- `OIDistributionListSchema` → `OIDistributionList` 类型 — 一致
- `OIStrikeItemSchema` → `OIStrikeItem` 类型 — 一致
- `ExpiryItemSchema` — 新增，用于 expiries 数组项 — 一致
- tRPC endpoint 名 `oiDistribution` — 前后端一致
- hook 名 `useOIDistribution` — 一致
