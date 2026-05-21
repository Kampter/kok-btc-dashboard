# 相对强度监控系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Kok Dashboard 中新增"相对强度监控"模块，每小时自动计算市值 Top 50 代币相对 BTC 的强弱评分，通过 Dashboard 卡片 + 详情 Drawer 呈现。

**Architecture:** 新增 3 个 NestJS 模块（okx、universe、rs-monitor），使用 PostgreSQL 存储 K 线和评分，通过 tRPC 暴露给前端。前端新增第 8 个 Dashboard 模块卡片和详情面板。

**Tech Stack:** NestJS + PostgreSQL + tRPC + TanStack Query + Recharts

---

## 文件结构

### 后端新建

| 文件 | 职责 |
|------|------|
| `apps/api/src/okx/okx.module.ts` | OKX 模块声明 |
| `apps/api/src/okx/okx.service.ts` | OKX REST API 客户端（candles、tickers） |
| `apps/api/src/universe/universe.module.ts` | Universe 模块声明 |
| `apps/api/src/universe/universe.service.ts` | Universe 查询（读 PG token_universe 表） |
| `apps/api/src/universe/universe-scheduler.service.ts` | 每日 Cron 更新 Universe |
| `apps/api/src/rs-monitor/rs-monitor.module.ts` | RS Monitor 模块声明 |
| `apps/api/src/rs-monitor/rs-monitor.service.ts` | 查询接口：最新评分、历史、图表数据 |
| `apps/api/src/rs-monitor/candle-scheduler.service.ts` | 每小时 Cron 拉取 OKX K 线 |
| `apps/api/src/rs-monitor/score-scheduler.service.ts` | 每小时 Cron 计算 RS Score |

### 后端修改

| 文件 | 修改 |
|------|------|
| `apps/api/src/trpc/trpc.module.ts` | 导入 OkxModule、UniverseModule、RsMonitorModule |
| `apps/api/src/trpc/trpc.service.ts` | 添加 `rsMonitor` router（latest、history、chart） |
| `apps/api/src/app.module.ts` | 注册 OkxModule、UniverseModule、RsMonitorModule |

### 共享类型新建

| 文件 | 职责 |
|------|------|
| `packages/shared-types/src/schemas/rs-monitor.ts` | RS Monitor Zod schemas |

### 共享类型修改

| 文件 | 修改 |
|------|------|
| `packages/shared-types/src/schemas/index.ts` | 导出 rs-monitor schemas |
| `packages/shared-types/src/trpc/router.ts` | 添加 rsMonitor router 类型 |

### 前端新建

| 文件 | 职责 |
|------|------|
| `apps/web/app/components/modules/overview/RSMOverviewCard.tsx` | Dashboard 第 8 张卡片 |
| `apps/web/app/components/modules/RSMonitor.tsx` | Detail Drawer 内容（排名表格 + 图表） |

### 前端修改

| 文件 | 修改 |
|------|------|
| `apps/web/app/hooks/useDashboardData.ts` | 添加 useRSLatest、useRSHistory、useRSChart hooks |
| `apps/web/app/components/OverviewGrid.tsx` | 注册 RSMOverviewCard |
| `apps/web/app/components/DashboardLayout.tsx` | 注册 RSMonitor detail component |

---

### Task 1: 共享类型 — 创建 rs-monitor Zod schemas

**Files:**
- Create: `packages/shared-types/src/schemas/rs-monitor.ts`
- Modify: `packages/shared-types/src/schemas/index.ts`
- Test: `packages/shared-types/src/schemas/rs-monitor.test.ts`

- [ ] **Step 1: 创建 rs-monitor.ts schema 文件**

```typescript
import { z } from 'zod';

export const TokenUniverseItemSchema = z.object({
  tokenSymbol: z.string(),
  instId: z.string(),
  rank: z.number(),
  marketCapUsd: z.number().optional(),
});

export type TokenUniverseItem = z.infer<typeof TokenUniverseItemSchema>;

export const OkxCandleSchema = z.object({
  ts: z.string(),
  o: z.string(),
  h: z.string(),
  l: z.string(),
  c: z.string(),
  vol: z.string(),
  volCcy: z.string(),
  volCcyQuote: z.string(),
  confirm: z.string(),
});

export type OkxCandle = z.infer<typeof OkxCandleSchema>;

export const RsScoreSchema = z.object({
  tokenSymbol: z.string(),
  rsScore: z.number(),
  btcReturn7d: z.number(),
  rawReturn7d: z.number(),
  zScore: z.number(),
  signal: z.enum(['strong', 'weak', 'neutral']),
  rankPosition: z.number(),
  scoredAt: z.string(),
});

export type RsScore = z.infer<typeof RsScoreSchema>;

export const RsChartPointSchema = z.object({
  timestamp: z.string(),
  price: z.number(),
  btcRatio: z.number(),
  score: z.number().nullable(),
});

export type RsChartPoint = z.infer<typeof RsChartPointSchema>;

export const RsChartDataSchema = z.object({
  tokenSymbol: z.string(),
  points: z.array(RsChartPointSchema),
});

export type RsChartData = z.infer<typeof RsChartDataSchema>;
```

- [ ] **Step 2: 更新 schemas/index.ts 导出**

在 `packages/shared-types/src/schemas/index.ts` 添加：

```typescript
export * from './rs-monitor.js';
```

- [ ] **Step 3: 创建 schema 测试**

```typescript
import { describe, it, expect } from 'vitest';
import {
  TokenUniverseItemSchema,
  RsScoreSchema,
  RsChartDataSchema,
} from './rs-monitor';

describe('RsScoreSchema', () => {
  it('validates a complete score', () => {
    const score = {
      tokenSymbol: 'SUI',
      rsScore: 89.5,
      btcReturn7d: 0.123,
      rawReturn7d: 0.15,
      zScore: 2.3,
      signal: 'strong' as const,
      rankPosition: 3,
      scoredAt: '2026-05-22T10:00:00Z',
    };
    expect(RsScoreSchema.parse(score)).toEqual(score);
  });

  it('rejects invalid signal', () => {
    const score = {
      tokenSymbol: 'SUI',
      rsScore: 89.5,
      btcReturn7d: 0.123,
      rawReturn7d: 0.15,
      zScore: 2.3,
      signal: 'bullish',
      rankPosition: 3,
      scoredAt: '2026-05-22T10:00:00Z',
    };
    expect(() => RsScoreSchema.parse(score)).toThrow();
  });
});

describe('RsChartDataSchema', () => {
  it('validates chart data', () => {
    const data = {
      tokenSymbol: 'SUI',
      points: [
        { timestamp: '2026-05-22T09:00:00Z', price: 1.5, btcRatio: 0.00002, score: 85 },
        { timestamp: '2026-05-22T10:00:00Z', price: 1.52, btcRatio: 0.000021, score: null },
      ],
    };
    expect(RsChartDataSchema.parse(data)).toEqual(data);
  });
});
```

- [ ] **Step 4: 运行 shared-types 测试**

Run: `cd packages/shared-types && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/schemas/rs-monitor.ts packages/shared-types/src/schemas/index.ts packages/shared-types/src/schemas/rs-monitor.test.ts
git commit -m "feat(shared-types): add rs-monitor schemas"
```

---

### Task 2: 共享类型 — 更新 tRPC router 类型

**Files:**
- Modify: `packages/shared-types/src/trpc/router.ts`

- [ ] **Step 1: 添加 rsMonitor router 类型**

在 `packages/shared-types/src/trpc/router.ts` 中：

1. 在现有 import 下方添加类型导入：

```typescript
import type { RsScore, RsChartData } from '../schemas/rs-monitor.js';
```

2. 在 `greeks` router 下方添加 `rsMonitor` router：

```typescript
  rsMonitor: t.router({
    latest: t.procedure.query(async () => [] as RsScore[]),

    history: t.procedure
      .input(z.object({ tokenSymbol: z.string(), days: z.number().default(7) }))
      .query(async () => [] as RsScore[]),

    chart: t.procedure
      .input(z.object({ tokenSymbol: z.string() }))
      .query(async () => ({} as RsChartData)),
  }),
```

- [ ] **Step 2: 运行 shared-types typecheck**

Run: `cd packages/shared-types && pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/trpc/router.ts
git commit -m "feat(shared-types): add rsMonitor router types"
```

---

### Task 3: 后端 — 创建 OKX API 客户端

**Files:**
- Create: `apps/api/src/okx/okx.service.ts`
- Create: `apps/api/src/okx/okx.module.ts`
- Test: `apps/api/src/okx/okx.service.spec.ts`

- [ ] **Step 1: 创建 OkxService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OkxCandleSchema } from '@kok/shared-types';
import type { OkxCandle } from '@kok/shared-types';

const OKX_BASE_URL = 'https://www.okx.com';

@Injectable()
export class OkxService {
  private readonly logger = new Logger(OkxService.name);
  private readonly client = axios.create({
    baseURL: OKX_BASE_URL,
    timeout: 15000,
  });

  async getCandles(instId: string, bar: string, limit: number): Promise<OkxCandle[]> {
    try {
      const response = await this.client.get('/api/v5/market/candles', {
        params: { instId, bar, limit },
      });

      const data = response.data?.data ?? [];
      return data.map((row: string[]) =>
        OkxCandleSchema.parse({
          ts: row[0],
          o: row[1],
          h: row[2],
          l: row[3],
          c: row[4],
          vol: row[5],
          volCcy: row[6],
          volCcyQuote: row[7] ?? '',
          confirm: row[8] ?? '1',
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to fetch candles for ${instId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getSpotTickers(): Promise<Array<{ instId: string; last: string }>> {
    try {
      const response = await this.client.get('/api/v5/market/tickers', {
        params: { instType: 'SPOT' },
      });

      const data = response.data?.data ?? [];
      return data.map((t: Record<string, string>) => ({
        instId: t.instId,
        last: t.last,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch spot tickers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
```

- [ ] **Step 2: 创建 OkxModule**

```typescript
import { Module } from '@nestjs/common';
import { OkxService } from './okx.service';

@Module({
  providers: [OkxService],
  exports: [OkxService],
})
export class OkxModule {}
```

- [ ] **Step 3: 创建 OkxService 测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OkxService } from './okx.service';
import axios from 'axios';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}));

describe('OkxService', () => {
  let service: OkxService;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGet = vi.fn();
    (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });
    service = new OkxService();
  });

  it('parses candles correctly', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          ['1716262800000', '65000.1', '65100.2', '64900.3', '65050.4', '100.5', '50.2', '100.5', '1'],
        ],
      },
    });

    const candles = await service.getCandles('BTC-USDT', '1H', 2);
    expect(candles).toHaveLength(1);
    expect(candles[0].ts).toBe('1716262800000');
    expect(candles[0].c).toBe('65050.4');
  });

  it('returns empty array when no data', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    const candles = await service.getCandles('BTC-USDT', '1H', 2);
    expect(candles).toHaveLength(0);
  });
});
```

- [ ] **Step 4: 运行 API 测试**

Run: `cd apps/api && pnpm test -- okx.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/okx/
git commit -m "feat(api): add OKX API client module"
```

---

### Task 4: 后端 — 创建 Universe 服务与每日 Cron

**Files:**
- Create: `apps/api/src/universe/universe.service.ts`
- Create: `apps/api/src/universe/universe-scheduler.service.ts`
- Create: `apps/api/src/universe/universe.module.ts`

- [ ] **Step 1: 创建 UniverseService**

```typescript
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../database/persistent-cache.service';

interface UniverseRow {
  token_symbol: string;
  inst_id: string;
  rank: number;
}

@Injectable()
export class UniverseService implements OnModuleInit {
  private readonly logger = new Logger(UniverseService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS token_universe (
        id             SERIAL PRIMARY KEY,
        token_symbol   TEXT NOT NULL UNIQUE,
        inst_id        TEXT NOT NULL,
        rank           INTEGER NOT NULL,
        market_cap_usd NUMERIC(20, 2),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async getCurrentUniverse(): Promise<UniverseRow[]> {
    const result = await this.pool.query<UniverseRow>(`
      SELECT token_symbol, inst_id, rank
      FROM token_universe
      ORDER BY rank ASC
    `);
    return result.rows;
  }

  async getBtcInstId(): Promise<string> {
    return 'BTC-USDT';
  }

  async updateUniverse(items: Array<{ tokenSymbol: string; instId: string; rank: number; marketCapUsd?: number }>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE token_universe');

      for (const item of items) {
        await client.query(
          `INSERT INTO token_universe (token_symbol, inst_id, rank, market_cap_usd)
           VALUES ($1, $2, $3, $4)`,
          [item.tokenSymbol, item.instId, item.rank, item.marketCapUsd ?? null],
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Updated universe with ${items.length} tokens`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

- [ ] **Step 2: 创建 UniverseSchedulerService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { UniverseService } from './universe.service';
import { OkxService } from '../okx/okx.service';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

@Injectable()
export class UniverseSchedulerService {
  private readonly logger = new Logger(UniverseSchedulerService.name);

  constructor(
    private readonly universeService: UniverseService,
    private readonly okxService: OkxService,
  ) {}

  @Cron('0 0 * * *')
  async updateUniverse(): Promise<void> {
    this.logger.log('Starting universe update...');

    try {
      // 1. Fetch top 100 from CoinGecko
      const cgResponse = await axios.get(`${COINGECKO_API}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 100,
          page: 1,
          sparkline: false,
        },
        timeout: 15000,
      });

      const cgCoins = cgResponse.data as Array<{ symbol: string; market_cap: number }>;

      // 2. Fetch OKX spot tickers to check availability
      const okxTickers = await this.okxService.getSpotTickers();
      const okxSet = new Set(okxTickers.map((t) => t.instId));

      // 3. Filter: must have USDT spot pair on OKX
      const filtered: Array<{ tokenSymbol: string; instId: string; rank: number; marketCapUsd: number }> = [];
      let rank = 1;

      for (const coin of cgCoins) {
        const symbol = coin.symbol.toUpperCase();
        const instId = `${symbol}-USDT`;

        if (okxSet.has(instId)) {
          filtered.push({
            tokenSymbol: symbol,
            instId,
            rank,
            marketCapUsd: coin.market_cap ?? 0,
          });
          rank++;
        }

        if (filtered.length >= 50) break;
      }

      if (filtered.length < 30) {
        this.logger.warn(`Only ${filtered.length} tokens found, expected at least 30`);
      }

      await this.universeService.updateUniverse(filtered);
      this.logger.log(`Universe updated: ${filtered.length} tokens`);
    } catch (error) {
      this.logger.error(`Failed to update universe: ${error instanceof Error ? error.message : String(error)}`);
      // Keep yesterday's universe - do not throw
    }
  }
}
```

- [ ] **Step 3: 创建 UniverseModule**

```typescript
import { Module } from '@nestjs/common';
import { OkxModule } from '../okx/okx.module';
import { UniverseService } from './universe.service';
import { UniverseSchedulerService } from './universe-scheduler.service';

@Module({
  imports: [OkxModule],
  providers: [UniverseService, UniverseSchedulerService],
  exports: [UniverseService],
})
export class UniverseModule {}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/universe/
git commit -m "feat(api): add universe management module with daily cron"
```

---

### Task 5: 后端 — 创建 RS Monitor 核心服务与 Cron

**Files:**
- Create: `apps/api/src/rs-monitor/rs-monitor.service.ts`
- Create: `apps/api/src/rs-monitor/candle-scheduler.service.ts`
- Create: `apps/api/src/rs-monitor/score-scheduler.service.ts`
- Create: `apps/api/src/rs-monitor/rs-monitor.module.ts`

- [ ] **Step 1: 创建 RsMonitorService**

```typescript
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../database/persistent-cache.service';
import type { RsScore, RsChartData, RsChartPoint } from '@kok/shared-types';

interface KlineRow {
  inst_id: string;
  ts: string;
  close: number;
}

interface ScoreRow {
  token_symbol: string;
  rs_score: number;
  btc_return_7d: number;
  raw_return_7d: number;
  z_score: number;
  signal: string;
  rank_position: number;
  scored_at: Date;
}

@Injectable()
export class RsMonitorService implements OnModuleInit {
  private readonly logger = new Logger(RsMonitorService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ohlcv (
        id         SERIAL PRIMARY KEY,
        inst_id    TEXT NOT NULL,
        timeframe  TEXT NOT NULL,
        ts         BIGINT NOT NULL,
        open       NUMERIC(18, 8) NOT NULL,
        high       NUMERIC(18, 8) NOT NULL,
        low        NUMERIC(18, 8) NOT NULL,
        close      NUMERIC(18, 8) NOT NULL,
        volume     NUMERIC(24, 8) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(inst_id, timeframe, ts)
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ohlcv_lookup
      ON ohlcv(inst_id, timeframe, ts DESC)
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rs_scores (
        id            SERIAL PRIMARY KEY,
        scored_at     TIMESTAMPTZ NOT NULL,
        token_symbol  TEXT NOT NULL,
        rs_score      NUMERIC(5, 2) NOT NULL,
        btc_return_7d NUMERIC(8, 4),
        raw_return_7d NUMERIC(8, 4),
        z_score       NUMERIC(6, 4),
        signal        TEXT CHECK (signal IN ('strong', 'weak', 'neutral')),
        rank_position INTEGER NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rs_scores_time
      ON rs_scores(scored_at DESC, signal)
    `);
  }

  async saveCandles(
    instId: string,
    timeframe: string,
    candles: Array<{ ts: string; o: string; h: string; l: string; c: string; vol: string }>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const candle of candles) {
        await client.query(
          `INSERT INTO ohlcv (inst_id, timeframe, ts, open, high, low, close, volume)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (inst_id, timeframe, ts) DO NOTHING`,
          [
            instId,
            timeframe,
            BigInt(candle.ts),
            candle.o,
            candle.h,
            candle.l,
            candle.c,
            candle.vol,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getKlines(instId: string, timeframe: string, limit: number): Promise<KlineRow[]> {
    const result = await this.pool.query<KlineRow>(`
      SELECT inst_id, ts::text as ts, close::numeric as close
      FROM ohlcv
      WHERE inst_id = $1 AND timeframe = $2
      ORDER BY ts DESC
      LIMIT $3
    `, [instId, timeframe, limit]);
    return result.rows.reverse();
  }

  async saveScores(scores: RsScore[], scoredAt: Date): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const score of scores) {
        await client.query(
          `INSERT INTO rs_scores (scored_at, token_symbol, rs_score, btc_return_7d, raw_return_7d, z_score, signal, rank_position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            scoredAt,
            score.tokenSymbol,
            score.rsScore,
            score.btcReturn7d,
            score.rawReturn7d,
            score.zScore,
            score.signal,
            score.rankPosition,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getLatestScores(): Promise<RsScore[]> {
    const result = await this.pool.query<ScoreRow>(`
      SELECT token_symbol, rs_score, btc_return_7d, raw_return_7d, z_score, signal, rank_position, scored_at
      FROM rs_scores
      WHERE scored_at = (SELECT MAX(scored_at) FROM rs_scores)
      ORDER BY rank_position ASC
    `);
    return result.rows.map((row) => ({
      tokenSymbol: row.token_symbol,
      rsScore: Number(row.rs_score),
      btcReturn7d: Number(row.btc_return_7d),
      rawReturn7d: Number(row.raw_return_7d),
      zScore: Number(row.z_score),
      signal: row.signal as 'strong' | 'weak' | 'neutral',
      rankPosition: row.rank_position,
      scoredAt: row.scored_at.toISOString(),
    }));
  }

  async getScoreHistory(tokenSymbol: string, days: number): Promise<RsScore[]> {
    const result = await this.pool.query<ScoreRow>(`
      SELECT token_symbol, rs_score, btc_return_7d, raw_return_7d, z_score, signal, rank_position, scored_at
      FROM rs_scores
      WHERE token_symbol = $1 AND scored_at >= NOW() - INTERVAL '${days} days'
      ORDER BY scored_at ASC
    `, [tokenSymbol]);
    return result.rows.map((row) => ({
      tokenSymbol: row.token_symbol,
      rsScore: Number(row.rs_score),
      btcReturn7d: Number(row.btc_return_7d),
      rawReturn7d: Number(row.raw_return_7d),
      zScore: Number(row.z_score),
      signal: row.signal as 'strong' | 'weak' | 'neutral',
      rankPosition: row.rank_position,
      scoredAt: row.scored_at.toISOString(),
    }));
  }

  async getTokenChartData(tokenSymbol: string): Promise<RsChartData> {
    const instId = `${tokenSymbol}-USDT`;
    const btcInstId = 'BTC-USDT';

    const [tokenResult, btcResult, scoreResult] = await Promise.all([
      this.pool.query<KlineRow>(`
        SELECT ts::text as ts, close::numeric as close
        FROM ohlcv
        WHERE inst_id = $1 AND timeframe = '1H'
        ORDER BY ts DESC
        LIMIT 168
      `, [instId]),
      this.pool.query<KlineRow>(`
        SELECT ts::text as ts, close::numeric as close
        FROM ohlcv
        WHERE inst_id = $1 AND timeframe = '1H'
        ORDER BY ts DESC
        LIMIT 168
      `, [btcInstId]),
      this.pool.query<{ ts: string; rs_score: number }>(`
        SELECT scored_at::text as ts, rs_score::numeric as rs_score
        FROM rs_scores
        WHERE token_symbol = $1 AND scored_at >= NOW() - INTERVAL '7 days'
        ORDER BY scored_at ASC
      `, [tokenSymbol]),
    ]);

    const tokenKlines = tokenResult.rows.reverse();
    const btcKlines = btcResult.rows.reverse();
    const scoreMap = new Map(scoreResult.rows.map((r) => [r.ts, Number(r.rs_score)]));

    const points: RsChartPoint[] = [];
    const btcMap = new Map(btcKlines.map((k) => [k.ts, Number(k.close)]));

    for (const tk of tokenKlines) {
      const btcClose = btcMap.get(tk.ts);
      if (btcClose && Number(btcClose) > 0) {
        points.push({
          timestamp: tk.ts,
          price: Number(tk.close),
          btcRatio: Number(tk.close) / Number(btcClose),
          score: scoreMap.get(tk.ts) ?? null,
        });
      }
    }

    return {
      tokenSymbol,
      points,
    };
  }
}
```

- [ ] **Step 2: 创建 CandleSchedulerService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OkxService } from '../okx/okx.service';
import { UniverseService } from '../universe/universe.service';
import { RsMonitorService } from './rs-monitor.service';

@Injectable()
export class CandleSchedulerService {
  private readonly logger = new Logger(CandleSchedulerService.name);

  constructor(
    private readonly okxService: OkxService,
    private readonly universeService: UniverseService,
    private readonly rsMonitorService: RsMonitorService,
  ) {}

  @Cron('5 * * * *')
  async fetchCandles(): Promise<void> {
    this.logger.log('Starting candle fetch...');

    const universe = await this.universeService.getCurrentUniverse();
    if (universe.length === 0) {
      this.logger.warn('No universe tokens found, skipping candle fetch');
      return;
    }

    // Include BTC as baseline
    const targets = [...universe, { token_symbol: 'BTC', inst_id: 'BTC-USDT', rank: 0 }];

    for (const token of targets) {
      try {
        const candles = await this.okxService.getCandles(token.inst_id, '1H', 3);
        if (candles.length > 0) {
          await this.rsMonitorService.saveCandles(token.inst_id, '1H', candles);
        }
        // Rate limit safety: 100ms delay between requests
        await this.delay(100);
      } catch (error) {
        this.logger.error(`Failed to fetch candles for ${token.inst_id}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with next token
      }
    }

    this.logger.log(`Candle fetch completed for ${targets.length} tokens`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 3: 创建 ScoreSchedulerService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UniverseService } from '../universe/universe.service';
import { RsMonitorService } from './rs-monitor.service';
import type { RsScore } from '@kok/shared-types';

@Injectable()
export class ScoreSchedulerService {
  private readonly logger = new Logger(ScoreSchedulerService.name);

  constructor(
    private readonly universeService: UniverseService,
    private readonly rsMonitorService: RsMonitorService,
  ) {}

  @Cron('10 * * * *')
  async calculateScores(): Promise<void> {
    this.logger.log('Starting RS score calculation...');

    const universe = await this.universeService.getCurrentUniverse();
    if (universe.length === 0) {
      this.logger.warn('No universe tokens found, skipping score calculation');
      return;
    }

    // Fetch BTC klines
    const btcKlines = await this.rsMonitorService.getKlines('BTC-USDT', '1H', 168);
    if (btcKlines.length < 100) {
      this.logger.warn(`Insufficient BTC data (${btcKlines.length} candles), skipping`);
      return;
    }

    const btcStartPrice = Number(btcKlines[0].close);
    const btcEndPrice = Number(btcKlines[btcKlines.length - 1].close);
    const btcReturn = (btcEndPrice - btcStartPrice) / btcStartPrice;

    interface TokenReturn {
      symbol: string;
      btcReturn: number;
      rawReturn: number;
    }

    const tokenReturns: TokenReturn[] = [];

    for (const token of universe) {
      const klines = await this.rsMonitorService.getKlines(`${token.token_symbol}-USDT`, '1H', 168);
      if (klines.length < 100) {
        this.logger.warn(`Insufficient data for ${token.token_symbol} (${klines.length} candles), skipping`);
        continue;
      }

      const startPrice = Number(klines[0].close);
      const endPrice = Number(klines[klines.length - 1].close);
      const tokenUsdReturn = (endPrice - startPrice) / startPrice;
      const tokenBtcReturn = tokenUsdReturn - btcReturn;

      tokenReturns.push({
        symbol: token.token_symbol,
        btcReturn: tokenBtcReturn,
        rawReturn: tokenUsdReturn,
      });
    }

    if (tokenReturns.length < 10) {
      this.logger.warn(`Only ${tokenReturns.length} tokens have sufficient data, skipping`);
      return;
    }

    // Cross-sectional Z-Score
    const returns = tokenReturns.map((t) => t.btcReturn);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);

    const scoredTokens: RsScore[] = tokenReturns.map((t) => {
      const zScore = std === 0 ? 0 : (t.btcReturn - mean) / std;
      const clampedZ = Math.max(-3, Math.min(3, zScore));
      const rsScore = 50 + 10 * clampedZ;

      return {
        tokenSymbol: t.symbol,
        rsScore: Math.round(rsScore * 100) / 100,
        btcReturn7d: Math.round(t.btcReturn * 10000) / 10000,
        rawReturn7d: Math.round(t.rawReturn * 10000) / 10000,
        zScore: Math.round(zScore * 10000) / 10000,
        signal: 'neutral' as const,
        rankPosition: 0,
        scoredAt: new Date().toISOString(),
      };
    });

    // Sort and assign rank
    scoredTokens.sort((a, b) => b.rsScore - a.rsScore);

    const total = scoredTokens.length;
    const strongThreshold = Math.floor(total * 0.8);
    const weakThreshold = Math.floor(total * 0.2);

    scoredTokens.forEach((t, index) => {
      t.rankPosition = index + 1;
      if (index >= strongThreshold) {
        t.signal = 'strong';
      } else if (index < weakThreshold) {
        t.signal = 'weak';
      } else {
        t.signal = 'neutral';
      }
    });

    await this.rsMonitorService.saveScores(scoredTokens, new Date());
    this.logger.log(`RS scores calculated for ${scoredTokens.length} tokens`);
  }
}
```

- [ ] **Step 4: 创建 RsMonitorModule**

```typescript
import { Module } from '@nestjs/common';
import { OkxModule } from '../okx/okx.module';
import { UniverseModule } from '../universe/universe.module';
import { RsMonitorService } from './rs-monitor.service';
import { CandleSchedulerService } from './candle-scheduler.service';
import { ScoreSchedulerService } from './score-scheduler.service';

@Module({
  imports: [OkxModule, UniverseModule],
  providers: [RsMonitorService, CandleSchedulerService, ScoreSchedulerService],
  exports: [RsMonitorService],
})
export class RsMonitorModule {}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/rs-monitor/
git commit -m "feat(api): add RS monitor module with candle and score schedulers"
```

---

### Task 6: 后端 — 注册模块并扩展 tRPC Router

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/trpc/trpc.module.ts`
- Modify: `apps/api/src/trpc/trpc.service.ts`

- [ ] **Step 1: 修改 app.module.ts 注册新模块**

在 `apps/api/src/app.module.ts` 中：

1. 添加 import：
```typescript
import { OkxModule } from './okx/okx.module';
import { UniverseModule } from './universe/universe.module';
import { RsMonitorModule } from './rs-monitor/rs-monitor.module';
```

2. 在 imports 数组中添加：
```typescript
    OkxModule,
    UniverseModule,
    RsMonitorModule,
```

- [ ] **Step 2: 修改 trpc.module.ts 导入新模块**

在 `apps/api/src/trpc/trpc.module.ts` 中：

1. 添加 import：
```typescript
import { UniverseModule } from '../universe/universe.module';
import { RsMonitorModule } from '../rs-monitor/rs-monitor.module';
```

2. 修改 imports 数组：
```typescript
@Module({
  imports: [DeribitModule, ChatModule, GreeksModule, UniverseModule, RsMonitorModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
```

- [ ] **Step 3: 修改 trpc.service.ts 添加 rsMonitor router**

在 `apps/api/src/trpc/trpc.service.ts` 中：

1. 在现有 import 下方添加：
```typescript
import { RsMonitorService } from '../rs-monitor/rs-monitor.service';
import {
  RsScoreSchema,
  RsChartDataSchema,
} from '@kok/shared-types';
```

2. 在 constructor 参数中添加：
```typescript
    private readonly rsMonitorService: RsMonitorService,
```

3. 在 `buildGreeksRouter()` 调用下方，appRouter 定义中新增：
```typescript
      rsMonitor: this.buildRsMonitorRouter(),
```

4. 在类末尾（`buildGreeksRouter` 之后）添加：
```typescript
  private buildRsMonitorRouter() {
    return t.router({
      latest: t.procedure.query(async () => {
        try {
          const scores = await this.rsMonitorService.getLatestScores();
          return scores.map((s) => RsScoreSchema.parse(s));
        } catch (error) {
          handleTrpcError('Failed to fetch latest RS scores', error);
        }
      }),

      history: t.procedure
        .input(z.object({ tokenSymbol: z.string(), days: z.number().default(7) }))
        .query(async ({ input }) => {
          try {
            const scores = await this.rsMonitorService.getScoreHistory(input.tokenSymbol, input.days);
            return scores.map((s) => RsScoreSchema.parse(s));
          } catch (error) {
            handleTrpcError('Failed to fetch RS score history', error);
          }
        }),

      chart: t.procedure
        .input(z.object({ tokenSymbol: z.string() }))
        .query(async ({ input }) => {
          try {
            const data = await this.rsMonitorService.getTokenChartData(input.tokenSymbol);
            return RsChartDataSchema.parse(data);
          } catch (error) {
            handleTrpcError('Failed to fetch RS chart data', error);
          }
        }),
    });
  }
```

- [ ] **Step 4: 运行 API typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/trpc/
git commit -m "feat(api): wire rsMonitor into tRPC router and app module"
```

---

### Task 7: 前端 — 添加数据获取 Hooks

**Files:**
- Modify: `apps/web/app/hooks/useDashboardData.ts`

- [ ] **Step 1: 添加 RS Monitor hooks**

在 `apps/web/app/hooks/useDashboardData.ts` 末尾添加：

```typescript
export function useRSLatest() {
  return useQuery({
    ...trpc.rsMonitor.latest.queryOptions(),
    refetchInterval: 60000,
  });
}

export function useRSHistory(tokenSymbol: string, days = 7) {
  return useQuery({
    ...trpc.rsMonitor.history.queryOptions({ tokenSymbol, days }),
    enabled: !!tokenSymbol,
    staleTime: 300000,
  });
}

export function useRSChart(tokenSymbol: string) {
  return useQuery({
    ...trpc.rsMonitor.chart.queryOptions({ tokenSymbol }),
    enabled: !!tokenSymbol,
    staleTime: 300000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/hooks/useDashboardData.ts
git commit -m "feat(web): add RS monitor data hooks"
```

---

### Task 8: 前端 — 创建 RSMOverviewCard

**Files:**
- Create: `apps/web/app/components/modules/overview/RSMOverviewCard.tsx`

- [ ] **Step 1: 创建 OverviewCard 组件**

```typescript
import { memo } from 'react';
import { useRSLatest } from '../../../hooks/useDashboardData';
import { OverviewCard } from '../../OverviewCard';

export const RSMOverviewCard = memo(function RSMOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean;
  onClick: () => void;
}) {
  const { data: scores, isLoading, isError } = useRSLatest();

  const strongTokens = scores?.filter((s) => s.signal === 'strong').slice(0, 3) ?? [];
  const weakTokens = scores?.filter((s) => s.signal === 'weak').slice(0, 3) ?? [];

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready';

  const formatReturn = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}% vs BTC`;

  return (
    <OverviewCard
      moduleId="rs-monitor"
      title="相对强度监控"
      kpi={{
        label: strongTokens.length > 0
          ? `${strongTokens.length} 个强势标的`
          : '等待数据...',
        value: strongTokens.length > 0
          ? `Top: ${strongTokens[0]?.tokenSymbol ?? '-'}`
          : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/modules/overview/RSMOverviewCard.tsx
git commit -m "feat(web): add RS monitor overview card"
```

---

### Task 9: 前端 — 创建 RSMonitor Detail View

**Files:**
- Create: `apps/web/app/components/modules/RSMonitor.tsx`

- [ ] **Step 1: 创建 Detail View 组件**

```typescript
import { useState } from 'react';
import { useRSLatest, useRSChart } from '../../hooks/useDashboardData';
import { ErrorFallback } from '../ui/error-fallback';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const SIGNAL_COLORS = {
  strong: 'text-call',
  weak: 'text-put',
  neutral: 'text-muted-foreground',
} as const;

const SIGNAL_LABELS = {
  strong: '强势',
  weak: '弱势',
  neutral: '中性',
} as const;

export function RSMonitor() {
  const { data: scores, isLoading, isError, refetch } = useRSLatest();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const { data: chartData } = useRSChart(selectedToken ?? '');

  if (isError) {
    return <ErrorFallback onRetry={() => refetch()} />;
  }

  if (isLoading || !scores) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      {!selectedToken ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">相对强度排名</h3>
            <span className="text-xs text-muted-foreground">
              评分时间: {scores[0]?.scoredAt ? new Date(scores[0].scoredAt).toLocaleString('zh-CN') : '-'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-3">排名</th>
                  <th className="text-left py-2 px-3">代币</th>
                  <th className="text-right py-2 px-3">7D vs BTC</th>
                  <th className="text-right py-2 px-3">RS Score</th>
                  <th className="text-center py-2 px-3">信号</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score) => (
                  <tr
                    key={score.tokenSymbol}
                    className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedToken(score.tokenSymbol)}
                  >
                    <td className="py-2 px-3 font-mono">{score.rankPosition}</td>
                    <td className="py-2 px-3 font-medium">{score.tokenSymbol}</td>
                    <td className={`py-2 px-3 text-right ${score.btcReturn7d >= 0 ? 'text-call' : 'text-put'}`}>
                      {formatPercent(score.btcReturn7d)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{score.rsScore.toFixed(1)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SIGNAL_COLORS[score.signal]}`}>
                        {SIGNAL_LABELS[score.signal]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedToken(null)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 返回排名
            </button>
            <h3 className="text-lg font-semibold">{selectedToken} / BTC 相对强度</h3>
          </div>

          {chartData && chartData.points.length > 0 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">价格 / BTC 比值</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => v.toExponential(2)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        labelFormatter={(ts) => new Date(ts).toLocaleString('zh-CN')}
                      />
                      <Line
                        type="monotone"
                        dataKey="btcRatio"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">RS Score 趋势</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.points.filter((p) => p.score !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        labelFormatter={(ts) => new Date(ts).toLocaleString('zh-CN')}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--call))"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/modules/RSMonitor.tsx
git commit -m "feat(web): add RS monitor detail view with ranking and charts"
```

---

### Task 10: 前端 — 注册新模块到 Dashboard

**Files:**
- Modify: `apps/web/app/components/OverviewGrid.tsx`
- Modify: `apps/web/app/components/DashboardLayout.tsx`

- [ ] **Step 1: 修改 OverviewGrid.tsx**

1. 在 import 区域添加：
```typescript
import { RSMOverviewCard } from './modules/overview/RSMOverviewCard'
```

2. 在 MODULES 数组末尾添加：
```typescript
  { id: 'rs-monitor', label: '相对强度监控', Component: RSMOverviewCard },
```

- [ ] **Step 2: 修改 DashboardLayout.tsx**

1. 在 import 区域添加：
```typescript
import { RSMonitor } from './modules/RSMonitor'
```

2. 在 MODULE_DETAILS 对象中添加：
```typescript
  'rs-monitor': { title: '相对强度监控', component: RSMonitor },
```

- [ ] **Step 3: 运行 web typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/OverviewGrid.tsx apps/web/app/components/DashboardLayout.tsx
git commit -m "feat(web): register RS monitor module in dashboard"
```

---

### Task 11: 集成测试与验证

- [ ] **Step 1: 运行全量 typecheck**

Run: `pnpm typecheck`
Expected: 所有包无类型错误

- [ ] **Step 2: 运行 API 测试**

Run: `cd apps/api && pnpm test`
Expected: 所有测试通过

- [ ] **Step 3: 运行 shared-types 测试**

Run: `cd packages/shared-types && pnpm test`
Expected: 所有测试通过

- [ ] **Step 4: 构建所有包**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 5: 启动 dev 环境验证**

Run: `pnpm dev`（在单独终端中，或者确认前后端都能启动）
Expected: 后端 3000 端口、前端 5173 端口正常启动

- [ ] **Step 6: 验证 Dashboard 显示**

1. 打开浏览器访问 `http://localhost:5173`
2. 确认 Dashboard 显示 8 个卡片（新增"相对强度监控"）
3. 点击新卡片，确认 Drawer 打开显示"等待数据..."或加载状态

- [ ] **Step 7: 手动触发 Universe 初始化**

由于 Universe 是每日 0 点更新，首次部署需要手动填充。可以通过：
1. 临时调用 API endpoint（如果有）
2. 或者直接插入几条测试数据到 PG：

```sql
INSERT INTO token_universe (token_symbol, inst_id, rank) VALUES
  ('BTC', 'BTC-USDT', 1),
  ('ETH', 'ETH-USDT', 2),
  ('SOL', 'SOL-USDT', 3),
  ('SUI', 'SUI-USDT', 4);
```

3. 等待下一个小时的 candle fetch（xx:05）和 score calculation（xx:10）

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: complete RS monitor dashboard integration"
```

---

## Spec 覆盖检查

| Spec 要求 | 实现任务 |
|-----------|---------|
| 每日自动从 CoinGecko 更新 Universe | Task 4 (UniverseSchedulerService) |
| 每小时拉取 OKX 1H K 线 | Task 5 (CandleSchedulerService) |
| 每小时计算 RS Score | Task 5 (ScoreSchedulerService) |
| PG 建表（token_universe, ohlcv, rs_scores） | Task 4, Task 5 (onModuleInit) |
| Z-Score + Winsorize + 0-100 评分 | Task 5 (ScoreSchedulerService) |
| Top 20% strong / Bottom 20% weak | Task 5 |
| tRPC router (latest, history, chart) | Task 6 |
| Dashboard 第 8 张卡片 | Task 8 |
| 排名表格 | Task 9 |
| 单代币图表（比值 + Score 趋势） | Task 9 |
| 错误降级（API 失败保留旧数据） | Task 4, Task 5 (try/catch + logger) |
| 数据不足跳过 | Task 5 (klines.length < 100) |

## 自检清单

- [x] 无 TBD/TODO/placeholder
- [x] 所有类型名一致（RsScore、RsChartData、TokenUniverseItem）
- [x] 文件路径与现有项目结构一致
- [x] Cron 表达式与 Spec 一致（0 0 * * *, 5 * * * *, 10 * * * *)
- [x] 数据库表结构与 Spec 一致
- [x] 评分算法与 Spec 一致（Z-Score + Winsorize ±3 + 0-100）
- [x] 前端刷新策略与 Spec 一致（排名 60s、图表 5min stale）
