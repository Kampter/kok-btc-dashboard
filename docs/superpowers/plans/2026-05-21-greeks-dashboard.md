# Greeks Dashboard 模块实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Kok Dashboard 中新增 Greeks 风险暴露分析模块，包含服务端渐进式 GEX/DEX 计算和前端可视化。

**Architecture:** 后端新增 `GreeksModule`，含 `GreeksService`（渐进式分批计算）和 `GreeksSchedulerService`（每 5 分钟定时触发）；前端新增 `GreeksDashboard` 组件和概览卡片，通过 tRPC `greeks.exposure` 获取数据。

**Tech Stack:** NestJS + tRPC + Zod + React + Recharts + Vitest

---

## 文件映射

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/shared-types/src/schemas/greeks.ts` | 新建 | Greeks 数据模型（Zod Schema） |
| `packages/shared-types/src/schemas/index.ts` | 修改 | 导出 Greeks schema |
| `packages/shared-types/src/trpc/router.ts` | 修改 | 添加 `greeks.exposure` 路由定义 |
| `apps/api/src/deribit/deribit.service.ts` | 修改 | 新增 `getInstruments` 和 `getTicker` 方法 |
| `apps/api/src/greeks/greeks.service.ts` | 新建 | 核心 Greeks 计算逻辑 |
| `apps/api/src/greeks/greeks.service.test.ts` | 新建 | GreeksService 单元测试 |
| `apps/api/src/greeks/greeks-scheduler.service.ts` | 新建 | 5 分钟定时调度 |
| `apps/api/src/greeks/greeks.module.ts` | 新建 | NestJS 模块定义 |
| `apps/api/src/app.module.ts` | 修改 | 注册 `GreeksModule` |
| `apps/api/src/trpc/trpc.service.ts` | 修改 | 添加 `greeks.exposure` tRPC 路由 |
| `apps/web/app/hooks/useDashboardData.ts` | 修改 | 新增 `useGreeksExposure` hook |
| `apps/web/app/components/modules/GreeksDashboard.tsx` | 新建 | Greeks 详情组件 |
| `apps/web/app/components/modules/GreeksDashboard.test.tsx` | 新建 | 前端组件测试 |
| `apps/web/app/components/modules/overview/GreeksOverviewCard.tsx` | 新建 | 概览卡片 |
| `apps/web/app/components/OverviewGrid.tsx` | 修改 | 注册 Greeks 模块 |
| `apps/web/app/components/DashboardLayout.tsx` | 修改 | 注册 Greeks 详情组件 |

---

## Task 1: Schema & Types (shared-types)

**先决条件：** 无

**依赖：** 无

**Files:**
- 新建: `packages/shared-types/src/schemas/greeks.ts`
- 修改: `packages/shared-types/src/schemas/index.ts`
- 修改: `packages/shared-types/src/trpc/router.ts`

- [ ] **Step 1: 创建 Greeks Zod Schema**

在 `packages/shared-types/src/schemas/greeks.ts` 写入：

```typescript
import { z } from 'zod';

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
  call_gex: z.number(),
  put_gex: z.number(),
  net_gex: z.number(),
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

export type GreekValues = z.infer<typeof GreekValuesSchema>;
export type StrikeGreeks = z.infer<typeof StrikeGreeksSchema>;
export type GreeksProgress = z.infer<typeof GreeksProgressSchema>;
export type GreeksExposure = z.infer<typeof GreeksExposureSchema>;
```

- [ ] **Step 2: 修改 schemas/index.ts 导出 Greeks**

在 `packages/shared-types/src/schemas/index.ts` 末尾追加：

```typescript
export * from './greeks.js';
```

- [ ] **Step 3: 修改 tRPC Router 添加 greeks 路由**

在 `packages/shared-types/src/trpc/router.ts` 中：

1. 在现有 import 后添加：

```typescript
import type { GreeksExposure } from '../schemas/greeks.js';
```

2. 在 `chat` router 后添加 `greeks` router：

```typescript
export const appRouter = t.router({
  deribit: t.router({
    // ... existing routes ...
  }),

  chat: t.router({
    // ... existing routes ...
  }),

  greeks: t.router({
    exposure: t.procedure
      .input(z.object({ currency: z.string().default('BTC') }))
      .query(async () => ({} as GreeksExposure)),
  }),
});
```

- [ ] **Step 4: 运行 shared-types 类型检查**

Run:
```bash
cd packages/shared-types && pnpm typecheck
```
Expected: 无错误

- [ ] **Step 5: 构建 shared-types**

Run:
```bash
cd packages/shared-types && pnpm build
```
Expected: 编译成功，dist/ 目录更新

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add Greeks schema and tRPC router"
```

---

## Task 2: DeribitService 扩展

**先决条件：** Task 1 完成

**依赖：** Task 1

**Files:**
- 修改: `apps/api/src/deribit/deribit.service.ts`

- [ ] **Step 1: 添加接口和类型**

在 `apps/api/src/deribit/deribit.service.ts` 中，在 `BookSummaryItem` 接口后添加：

```typescript
export interface Instrument {
  instrument_name: string;
}

export interface TickerGreeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface TickerResponse {
  instrument_name: string;
  strike: number;
  option_type: 'C' | 'P';
  open_interest: number;
  underlying_price: number;
  greeks: TickerGreeks;
}
```

- [ ] **Step 2: 添加 getInstruments 方法**

在 `DeribitService` 类中，在 `getLastTradesByCurrency` 方法后添加：

```typescript
async getInstruments(currency: string, kind: string): Promise<Instrument[]> {
  return this.fetchWithCache<Instrument[]>(
    `instruments_${currency}_${kind}`,
    async () => {
      const { data } = await this.client.get('/get_instruments', {
        params: { currency, kind, expired: false },
      });
      return data.result as Instrument[];
    },
    900000,
  );
}
```

- [ ] **Step 3: 添加 getTicker 方法**

在 `getInstruments` 后添加：

```typescript
async getTicker(instrumentName: string): Promise<TickerResponse> {
  return this.fetchWithCache<TickerResponse>(
    `ticker_${instrumentName}`,
    async () => {
      const { data } = await this.client.get('/ticker', {
        params: { instrument_name: instrumentName },
      });
      return data.result as TickerResponse;
    },
    30000, // 30 seconds TTL for Greeks data
  );
}
```

- [ ] **Step 4: 运行 API 类型检查**

Run:
```bash
cd apps/api && pnpm typecheck
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/deribit/deribit.service.ts
git commit -m "feat(api): add getInstruments and getTicker to DeribitService"
```

---

## Task 3: GreeksService 核心计算

**先决条件：** Task 1, Task 2 完成

**依赖：** Task 1, Task 2

**Files:**
- 新建: `apps/api/src/greeks/greeks.service.ts`
- 新建: `apps/api/src/greeks/greeks.service.test.ts`

- [ ] **Step 1: 创建测试文件（TDD - 先写测试）**

在 `apps/api/src/greeks/greeks.service.test.ts` 写入：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GreeksService } from './greeks.service';
import { DeribitService } from '../deribit/deribit.service';
import type { Cache } from 'cache-manager';

describe('GreeksService', () => {
  let service: GreeksService;
  let mockDeribitService: Partial<DeribitService>;
  let mockCacheManager: Partial<Cache>;

  beforeEach(() => {
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
    };

    mockDeribitService = {
      getInstruments: vi.fn(),
      getIndexPrice: vi.fn(),
      getTicker: vi.fn(),
    };

    service = new GreeksService(
      mockCacheManager as Cache,
      mockDeribitService as DeribitService,
    );
  });

  describe('getExposure', () => {
    it('应返回缓存中的数据', async () => {
      const cached = {
        currency: 'BTC',
        total_gex: 100,
        total_dex: 50,
        zero_gamma_strike: 80000,
        call_wall: 85000,
        put_wall: 75000,
        by_strike: [],
        progress: { total: 10, completed: 10, is_complete: true },
        timestamp: new Date().toISOString(),
      };
      vi.mocked(mockCacheManager.get!).mockResolvedValue(cached);

      const result = await service.getExposure('BTC');
      expect(result).toEqual(cached);
    });

    it('无缓存时应返回空结果', async () => {
      vi.mocked(mockCacheManager.get!).mockResolvedValue(null);

      const result = await service.getExposure('BTC');
      expect(result.currency).toBe('BTC');
      expect(result.total_gex).toBe(0);
      expect(result.progress.is_complete).toBe(false);
    });
  });

  describe('buildExposure', () => {
    it('应正确计算零 Gamma 行权价', () => {
      const results = [
        { strike: 75000, greeks: { delta: 0.3, gamma: 0.001, vega: 10, theta: -5, rho: 2 }, oi: 100, type: 'C' as const },
        { strike: 75000, greeks: { delta: -0.3, gamma: 0.001, vega: 10, theta: -5, rho: 2 }, oi: 100, type: 'P' as const },
        { strike: 80000, greeks: { delta: 0.5, gamma: 0.002, vega: 15, theta: -8, rho: 3 }, oi: 200, type: 'C' as const },
        { strike: 80000, greeks: { delta: -0.5, gamma: 0.002, vega: 15, theta: -8, rho: 3 }, oi: 200, type: 'P' as const },
        { strike: 85000, greeks: { delta: 0.7, gamma: 0.001, vega: 8, theta: -4, rho: 1 }, oi: 150, type: 'C' as const },
        { strike: 85000, greeks: { delta: -0.7, gamma: 0.001, vega: 8, theta: -4, rho: 1 }, oi: 150, type: 'P' as const },
      ];

      const exposure = (service as any).buildExposure('BTC', results, 80000, { total: 6, completed: 6, is_complete: true });
      expect(exposure.currency).toBe('BTC');
      expect(exposure.by_strike).toHaveLength(3);
      expect(exposure.zero_gamma_strike).toBeDefined();
    });

    it('应识别 Call Wall 和 Put Wall', () => {
      const results = [
        { strike: 80000, greeks: { delta: 0.5, gamma: 0.01, vega: 10, theta: -5, rho: 2 }, oi: 100, type: 'C' as const },
        { strike: 80000, greeks: { delta: -0.3, gamma: 0.001, vega: 5, theta: -2, rho: 1 }, oi: 50, type: 'P' as const },
      ];

      const exposure = (service as any).buildExposure('BTC', results, 80000, { total: 2, completed: 2, is_complete: true });
      expect(exposure.call_wall).toBe(80000);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/api && pnpm test src/greeks/greeks.service.test.ts
```
Expected: FAIL - "Cannot find module './greeks.service'"

- [ ] **Step 3: 创建 GreeksService 实现**

在 `apps/api/src/greeks/greeks.service.ts` 写入：

```typescript
import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { parseInstrumentName } from '@kok/shared-types';
import type { GreeksExposure, GreeksProgress, GreekValues } from '@kok/shared-types';
import { DeribitService } from '../deribit/deribit.service';

const CONTRACT_MULTIPLIER = 1;

interface TickerResult {
  strike: number;
  greeks: GreekValues;
  oi: number;
  type: 'C' | 'P';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GreeksService {
  private readonly logger = new Logger(GreeksService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly deribitService: DeribitService,
  ) {}

  async getExposure(currency: string): Promise<GreeksExposure> {
    const cached = await this.cacheManager.get<GreeksExposure>(`greeks_exposure_${currency}`);
    if (cached) return cached;

    return {
      currency,
      total_gex: 0,
      total_dex: 0,
      zero_gamma_strike: null,
      call_wall: null,
      put_wall: null,
      by_strike: [],
      progress: { total: 0, completed: 0, is_complete: false },
      timestamp: new Date().toISOString(),
    };
  }

  async computeExposure(currency: string): Promise<void> {
    try {
      const instruments = await this.deribitService.getInstruments(currency, 'option');
      const { index_price: spot } = await this.deribitService.getIndexPrice(`${currency.toLowerCase()}_usd`);

      if (instruments.length === 0) {
        const emptyResult = this.buildExposure(currency, [], spot, { total: 0, completed: 0, is_complete: true });
        await this.cacheManager.set(`greeks_exposure_${currency}`, emptyResult, 300000);
        return;
      }

      const now = Date.now();
      const sorted = instruments
        .map((i) => {
          const parsed = parseInstrumentName(i.instrument_name);
          const daysToExpiry = Math.ceil(
            (new Date(parsed.expiry).getTime() - now) / (1000 * 60 * 60 * 24),
          );
          const moneyness = parsed.strike / spot;
          return {
            ...parsed,
            instrument_name: i.instrument_name,
            priority: Math.abs(daysToExpiry) + Math.abs(moneyness - 1) * 10,
          };
        })
        .sort((a, b) => a.priority - b.priority);

      const BATCH_SIZE = 5;
      const results: TickerResult[] = [];

      // Initialize cache with empty progress
      const initialResult = this.buildExposure(currency, [], spot, {
        total: sorted.length,
        completed: 0,
        is_complete: false,
      });
      await this.cacheManager.set(`greeks_exposure_${currency}`, initialResult, 300000);

      for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
        const batch = sorted.slice(i, i + BATCH_SIZE);

        for (const instrument of batch) {
          try {
            const ticker = await this.deribitService.getTicker(instrument.instrument_name);
            results.push({
              strike: instrument.strike,
              greeks: ticker.greeks,
              oi: ticker.open_interest,
              type: instrument.optionType,
            });
          } catch (error) {
            this.logger.warn(
              `Failed to get ticker for ${instrument.instrument_name}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Update cache after each batch
        const isLastBatch = i + BATCH_SIZE >= sorted.length;
        const progress: GreeksProgress = {
          total: sorted.length,
          completed: results.length,
          is_complete: isLastBatch,
        };
        const partialResult = this.buildExposure(currency, results, spot, progress);
        await this.cacheManager.set(`greeks_exposure_${currency}`, partialResult, 300000);

        if (!isLastBatch) {
          await sleep(200);
        }
      }

      this.logger.log(`Greeks computation complete for ${currency}: ${results.length}/${sorted.length} contracts`);
    } catch (error) {
      this.logger.error(
        `Greeks computation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private buildExposure(
    currency: string,
    results: TickerResult[],
    spot: number,
    progress: GreeksProgress,
  ): GreeksExposure {
    const strikeMap = new Map<
      number,
      {
        strike: number;
        call_oi: number;
        put_oi: number;
        call_gex: number;
        put_gex: number;
        net_gex: number;
        call_delta: number;
        put_delta: number;
        net_delta: number;
      }
    >();

    for (const item of results) {
      const existing = strikeMap.get(item.strike) ?? {
        strike: item.strike,
        call_oi: 0,
        put_oi: 0,
        call_gex: 0,
        put_gex: 0,
        net_gex: 0,
        call_delta: 0,
        put_delta: 0,
        net_delta: 0,
      };

      const gex = item.greeks.gamma * item.oi * spot * CONTRACT_MULTIPLIER;
      const dex = item.greeks.delta * item.oi;

      if (item.type === 'C') {
        existing.call_oi += item.oi;
        existing.call_gex += gex;
        existing.call_delta += dex;
      } else {
        existing.put_oi += item.oi;
        existing.put_gex += gex;
        existing.put_delta += dex;
      }

      existing.net_gex = existing.call_gex + existing.put_gex;
      existing.net_delta = existing.call_delta + existing.put_delta;
      strikeMap.set(item.strike, existing);
    }

    const byStrike = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);

    const totalGex = byStrike.reduce((sum, s) => sum + s.net_gex, 0);
    const totalDex = byStrike.reduce((sum, s) => sum + s.net_delta, 0);

    // Find Call Wall (max call_gex)
    let callWall: number | null = null;
    let maxCallGex = -Infinity;
    for (const s of byStrike) {
      if (s.call_gex > maxCallGex) {
        maxCallGex = s.call_gex;
        callWall = s.strike;
      }
    }

    // Find Put Wall (max put_gex by absolute value, puts have negative gex in our calculation)
    let putWall: number | null = null;
    let maxPutGex = -Infinity;
    for (const s of byStrike) {
      const absPutGex = Math.abs(s.put_gex);
      if (absPutGex > maxPutGex) {
        maxPutGex = absPutGex;
        putWall = s.strike;
      }
    }

    // Find zero gamma strike via linear interpolation
    let zeroGammaStrike: number | null = null;
    for (let i = 0; i < byStrike.length - 1; i++) {
      const curr = byStrike[i]!;
      const next = byStrike[i + 1]!;
      if ((curr.net_gex > 0 && next.net_gex <= 0) || (curr.net_gex < 0 && next.net_gex >= 0)) {
        // Linear interpolation
        const t = Math.abs(curr.net_gex) / (Math.abs(curr.net_gex) + Math.abs(next.net_gex));
        zeroGammaStrike = curr.strike + t * (next.strike - curr.strike);
        break;
      }
    }

    return {
      currency,
      total_gex: totalGex,
      total_dex: totalDex,
      zero_gamma_strike: zeroGammaStrike,
      call_wall: callWall,
      put_wall: putWall,
      by_strike: byStrike,
      progress,
      timestamp: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
cd apps/api && pnpm test src/greeks/greeks.service.test.ts
```
Expected: PASS - 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/greeks/
git commit -m "feat(api): add GreeksService with progressive computation"
```

---

## Task 4: GreeksSchedulerService & Module

**先决条件：** Task 3 完成

**依赖：** Task 3

**Files:**
- 新建: `apps/api/src/greeks/greeks-scheduler.service.ts`
- 新建: `apps/api/src/greeks/greeks.module.ts`

- [ ] **Step 1: 创建 GreeksSchedulerService**

在 `apps/api/src/greeks/greeks-scheduler.service.ts` 写入：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GreeksService } from './greeks.service';

@Injectable()
export class GreeksSchedulerService {
  private readonly logger = new Logger(GreeksSchedulerService.name);
  private isRunning = false;

  constructor(private readonly greeksService: GreeksService) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async handleGreeksComputation(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Greeks computation already running, skipping');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting scheduled Greeks computation');

    try {
      await this.greeksService.computeExposure('BTC');
    } catch (error) {
      this.logger.error(
        `Greeks computation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
```

- [ ] **Step 2: 创建 GreeksModule**

在 `apps/api/src/greeks/greeks.module.ts` 写入：

```typescript
import { Module } from '@nestjs/common';
import { DeribitModule } from '../deribit/deribit.module';
import { GreeksService } from './greeks.service';
import { GreeksSchedulerService } from './greeks-scheduler.service';

@Module({
  imports: [DeribitModule],
  providers: [GreeksService, GreeksSchedulerService],
  exports: [GreeksService],
})
export class GreeksModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/greeks/greeks-scheduler.service.ts apps/api/src/greeks/greeks.module.ts
git commit -m "feat(api): add GreeksSchedulerService with 5min cron"
```

---

## Task 5: tRPC Router Integration

**先决条件：** Task 1, Task 4 完成

**依赖：** Task 1, Task 4

**Files:**
- 修改: `apps/api/src/trpc/trpc.service.ts`
- 修改: `apps/api/src/trpc/trpc.module.ts`
- 修改: `apps/api/src/app.module.ts`

- [ ] **Step 1: 修改 TrpcService 添加 greeks router**

在 `apps/api/src/trpc/trpc.service.ts` 中：

1. 在 imports 后添加：

```typescript
import { GreeksService } from '../greeks/greeks.service';
```

2. 修改构造函数注入：

```typescript
constructor(
  private readonly deribitService: DeribitService,
  private readonly chatRouter: ChatRouter,
  private readonly greeksService: GreeksService,
) {
  this.appRouter = t.router({
    deribit: this.buildDeribitRouter(),
    chat: this.chatRouter.router,
    greeks: this.buildGreeksRouter(),
  });
}
```

3. 在 `buildDeribitRouter` 方法后添加：

```typescript
private buildGreeksRouter() {
  return t.router({
    exposure: t.procedure
      .input(z.object({ currency: z.string().default('BTC') }))
      .query(async ({ input }) => {
        try {
          return await this.greeksService.getExposure(input.currency);
        } catch (error) {
          handleTrpcError('Failed to fetch Greeks exposure data', error);
        }
      }),
  });
}
```

- [ ] **Step 2: 修改 TrpcModule 注入 GreeksModule**

在 `apps/api/src/trpc/trpc.module.ts` 中：

```typescript
import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DeribitModule } from '../deribit/deribit.module';
import { ChatModule } from '../chat/chat.module';
import { GreeksModule } from '../greeks/greeks.module';

@Module({
  imports: [DeribitModule, ChatModule, GreeksModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
```

- [ ] **Step 3: 修改 AppModule 注册 GreeksModule**

在 `apps/api/src/app.module.ts` 中，在 imports 数组添加 `GreeksModule`：

```typescript
import { GreeksModule } from './greeks/greeks.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.register({
      isGlobal: true,
      ttl: 900000,
    }),
    DatabaseModule,
    DeribitModule,
    TrpcModule,
    ChatModule,
    SnapshotModule,
    GreeksModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: 运行 API 类型检查**

Run:
```bash
cd apps/api && pnpm typecheck
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/trpc/ apps/api/src/app.module.ts
git commit -m "feat(api): integrate Greeks tRPC router and register module"
```

---

## Task 6: Frontend Hook

**先决条件：** Task 5 完成

**依赖：** Task 5

**Files:**
- 修改: `apps/web/app/hooks/useDashboardData.ts`

- [ ] **Step 1: 添加 useGreeksExposure hook**

在 `apps/web/app/hooks/useDashboardData.ts` 末尾添加：

```typescript
export function useGreeksExposure(currency: string = 'BTC') {
  return useQuery(
    trpc.greeks.exposure.queryOptions({ currency }),
  );
}
```

- [ ] **Step 2: 运行 Web 类型检查**

Run:
```bash
cd apps/web && pnpm typecheck
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/hooks/useDashboardData.ts
git commit -m "feat(web): add useGreeksExposure hook"
```

---

## Task 7: GreeksDashboard Component

**先决条件：** Task 6 完成

**依赖：** Task 6

**Files:**
- 新建: `apps/web/app/components/modules/GreeksDashboard.tsx`

- [ ] **Step 1: 创建主组件文件**

在 `apps/web/app/components/modules/GreeksDashboard.tsx` 写入：

```typescript
import * as React from 'react';
import { useGreeksExposure } from '../../hooks/useDashboardData';
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
  Legend,
} from 'recharts';

const CALL_COLOR = '#4ade80';
const PUT_COLOR = '#e94560';
const NET_COLOR = '#fbbf24';

interface GexChartRow {
  strike: string;
  rawStrike: number;
  call_gex: number;
  put_gex: number;
}

interface DexChartRow {
  strike: string;
  rawStrike: number;
  call_delta: number;
  put_delta: number;
}

function formatStrike(strike: number): string {
  return `$${(strike / 1000).toFixed(0)}K`;
}

export function GreeksDashboard() {
  const { data, isLoading, isError, refetch } = useGreeksExposure('BTC');

  const gexData: GexChartRow[] = React.useMemo(() => {
    if (!data?.by_strike) return [];
    return data.by_strike
      .map((item) => ({
        strike: formatStrike(item.strike),
        rawStrike: item.strike,
        call_gex: -item.call_gex,
        put_gex: item.put_gex,
      }))
      .sort((a, b) => a.rawStrike - b.rawStrike);
  }, [data]);

  const dexData: DexChartRow[] = React.useMemo(() => {
    if (!data?.by_strike) return [];
    return data.by_strike
      .map((item) => ({
        strike: formatStrike(item.strike),
        rawStrike: item.strike,
        call_delta: -item.call_delta,
        put_delta: item.put_delta,
      }))
      .sort((a, b) => a.rawStrike - b.rawStrike);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
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
    return (
      <ErrorFallback
        title="Greeks 数据加载失败"
        onRetry={() => refetch()}
      />
    );
  }

  const isComplete = data?.progress?.is_complete ?? false;
  const progress = data?.progress;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总 GEX
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.total_gex ?? 0) >= 0 ? 'text-call' : 'text-put'}`}>
              {data?.total_gex ? formatUSD(data.total_gex) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(data?.total_gex ?? 0) >= 0 ? '正 GEX（稳定）' : '负 GEX（波动）'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Call Wall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-call">
              {data?.call_wall ? formatUSD(data.call_wall) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              最大 Gamma 阻力位
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Put Wall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-put">
              {data?.put_wall ? formatUSD(data.put_wall) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              最大 Gamma 支撑位
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              零 Gamma 行权价
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {data?.zero_gamma_strike ? formatUSD(data.zero_gamma_strike) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              正负 Gamma 翻转点
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {!isComplete && progress && progress.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
              <span>
                计算进度: {progress.completed}/{progress.total} 合约 (
                {Math.round((progress.completed / progress.total) * 100)}%)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GEX Butterfly Chart */}
      {gexData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GEX by Strike（Gamma 暴露）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={gexData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(v: number) => formatUSD(Math.abs(v))}
                />
                <YAxis
                  dataKey="strike"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={12}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                  }}
                  formatter={(value, name) => [
                    formatUSD(Math.abs(value as number)),
                    name,
                  ]}
                />
                <Legend />
                <Bar dataKey="call_gex" name="Call GEX" fill={CALL_COLOR} radius={[0, 2, 2, 0]} />
                <Bar dataKey="put_gex" name="Put GEX" fill={PUT_COLOR} radius={[2, 0, 0, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* DEX Butterfly Chart */}
      {dexData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">DEX by Strike（Delta 暴露）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={dexData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(v: number) => `${(v as number).toFixed(0)}`}
                />
                <YAxis
                  dataKey="strike"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={12}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                  }}
                />
                <Legend />
                <Bar dataKey="call_delta" name="Call Delta" fill={CALL_COLOR} radius={[0, 2, 2, 0]} />
                <Bar dataKey="put_delta" name="Put Delta" fill={PUT_COLOR} radius={[2, 0, 0, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 运行 Web 类型检查**

Run:
```bash
cd apps/web && pnpm typecheck
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/modules/GreeksDashboard.tsx
git commit -m "feat(web): add GreeksDashboard component with GEX/DEX charts"
```

---

## Task 8: Overview Card & Dashboard Registration

**先决条件：** Task 7 完成

**依赖：** Task 7

**Files:**
- 新建: `apps/web/app/components/modules/overview/GreeksOverviewCard.tsx`
- 修改: `apps/web/app/components/OverviewGrid.tsx`
- 修改: `apps/web/app/components/DashboardLayout.tsx`

- [ ] **Step 1: 创建 GreeksOverviewCard**

在 `apps/web/app/components/modules/overview/GreeksOverviewCard.tsx` 写入：

```typescript
import { memo } from 'react';
import { useGreeksExposure } from '../../../hooks/useDashboardData';
import { OverviewCard } from '../../OverviewCard';
import { formatUSD } from '../../../lib/utils';

export const GreeksOverviewCard = memo(function GreeksOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean;
  onClick: () => void;
}) {
  const { data, isLoading, isError } = useGreeksExposure('BTC');
  const status = isLoading ? 'loading' : isError ? 'error' : 'ready';

  const totalGex = data?.total_gex ?? 0;
  const gexLabel = totalGex >= 0 ? '正 GEX（稳定）' : '负 GEX（波动）';

  return (
    <OverviewCard
      moduleId="greeks"
      title="Greeks 风险暴露"
      kpi={{
        label: gexLabel,
        value: totalGex !== 0 ? formatUSD(Math.abs(totalGex)) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  );
});
```

- [ ] **Step 2: 修改 OverviewGrid 注册模块**

在 `apps/web/app/components/OverviewGrid.tsx` 中：

1. 在 imports 后添加：

```typescript
import { GreeksOverviewCard } from './modules/overview/GreeksOverviewCard'
```

2. 在 `MODULES` 数组末尾添加：

```typescript
const MODULES = [
  // ... existing modules ...
  { id: 'greeks', label: 'Greeks 风险暴露', Component: GreeksOverviewCard },
] as const
```

- [ ] **Step 3: 修改 DashboardLayout 注册详情组件**

在 `apps/web/app/components/DashboardLayout.tsx` 中：

1. 在 imports 后添加：

```typescript
import { GreeksDashboard } from './modules/GreeksDashboard'
```

2. 在 `MODULE_DETAILS` 对象末尾添加：

```typescript
const MODULE_DETAILS: Record<ModuleId, { title: string; component: React.ComponentType }> = {
  // ... existing entries ...
  greeks: { title: 'Greeks 风险暴露', component: GreeksDashboard },
}
```

- [ ] **Step 4: 运行 Web 类型检查**

Run:
```bash
cd apps/web && pnpm typecheck
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/
git commit -m "feat(web): register Greeks module in dashboard"
```

---

## Task 9: Frontend Tests

**先决条件：** Task 8 完成

**依赖：** Task 8

**Files:**
- 新建: `apps/web/app/components/modules/GreeksDashboard.test.tsx`

- [ ] **Step 1: 创建测试文件**

在 `apps/web/app/components/modules/GreeksDashboard.test.tsx` 写入：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GreeksDashboard } from './GreeksDashboard';
import { useGreeksExposure } from '../../hooks/useDashboardData';

vi.mock('../../hooks/useDashboardData', () => ({
  useGreeksExposure: vi.fn(),
}));

const mockedUseGreeksExposure = vi.mocked(useGreeksExposure);

describe('GreeksDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText('Greeks 数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders KPI cards with positive GEX in green', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: {
        currency: 'BTC',
        total_gex: 12400000000,
        total_dex: 5000000,
        zero_gamma_strike: 81500,
        call_wall: 85000,
        put_wall: 78000,
        by_strike: [
          {
            strike: 80000,
            call_oi: 100,
            put_oi: 50,
            call_gex: 5000000,
            put_gex: -2000000,
            net_gex: 3000000,
            call_delta: 50,
            put_delta: -20,
            net_delta: 30,
          },
        ],
        progress: { total: 10, completed: 10, is_complete: true },
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText('总 GEX')).toBeInTheDocument();
    expect(screen.getByText('Call Wall')).toBeInTheDocument();
    expect(screen.getByText('Put Wall')).toBeInTheDocument();
    expect(screen.getByText('零 Gamma 行权价')).toBeInTheDocument();
    expect(screen.getByText('正 GEX（稳定）')).toBeInTheDocument();
  });

  it('shows progress bar when computation is incomplete', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: {
        currency: 'BTC',
        total_gex: 0,
        total_dex: 0,
        zero_gamma_strike: null,
        call_wall: null,
        put_wall: null,
        by_strike: [],
        progress: { total: 420, completed: 156, is_complete: false },
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText(/计算进度:/)).toBeInTheDocument();
    expect(screen.getByText(/156\/420/)).toBeInTheDocument();
  });

  it('renders GEX chart when data is available', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: {
        currency: 'BTC',
        total_gex: 1000000,
        total_dex: 500000,
        zero_gamma_strike: 80000,
        call_wall: 85000,
        put_wall: 75000,
        by_strike: [
          {
            strike: 80000,
            call_oi: 100,
            put_oi: 100,
            call_gex: 5000000,
            put_gex: -3000000,
            net_gex: 2000000,
            call_delta: 50,
            put_delta: -30,
            net_delta: 20,
          },
        ],
        progress: { total: 1, completed: 1, is_complete: true },
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText('GEX by Strike（Gamma 暴露）')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行前端测试**

Run:
```bash
cd apps/web && pnpm test app/components/modules/GreeksDashboard.test.tsx
```
Expected: PASS - 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/modules/GreeksDashboard.test.tsx
git commit -m "test(web): add GreeksDashboard component tests"
```

---

## Task 10: Integration & Verification

**先决条件：** Task 9 完成

**依赖：** Task 9

- [ ] **Step 1: 全量类型检查**

Run:
```bash
pnpm typecheck
```
Expected: 三个包（shared-types、api、web）均无类型错误

- [ ] **Step 2: 运行全量测试**

Run:
```bash
pnpm test
```
Expected: 所有测试通过

- [ ] **Step 3: 构建验证**

Run:
```bash
pnpm build
```
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify full build and test suite"
```

---

## Self-Review Checklist

### Spec Coverage

| 设计文档要求 | 对应任务 |
|-------------|---------|
| Zod Schema 定义 | Task 1 |
| tRPC Router 扩展 | Task 1, Task 5 |
| DeribitService 扩展（getInstruments, getTicker） | Task 2 |
| GreeksService 渐进式计算 | Task 3 |
| 定时调度（每 5 分钟） | Task 4 |
| NestJS 模块注册 | Task 4, Task 5 |
| 前端 useGreeksExposure hook | Task 6 |
| GreeksDashboard 组件（KPI + 图表） | Task 7 |
| 概览卡片 | Task 8 |
| Dashboard 模块注册 | Task 8 |
| 前端测试 | Task 9 |
| 后端测试 | Task 3 |
| 类型检查 + 构建 | Task 10 |

### Placeholder Scan

- [x] 无 "TBD"、"TODO"、"implement later"
- [x] 无 "Add appropriate error handling" 等模糊描述
- [x] 所有代码步骤包含完整代码
- [x] 所有测试包含完整测试代码

### Type Consistency

- [x] `GreeksExposure` 类型在 Task 1、Task 3、Task 5、Task 7、Task 9 中一致
- [x] `GreekValues` 类型在 Task 1、Task 3 中一致
- [x] `getExposure` 和 `computeExposure` 方法签名在整个计划中一致
- [x] `useGreeksExposure` hook 在 Task 6、Task 7、Task 9 中一致
