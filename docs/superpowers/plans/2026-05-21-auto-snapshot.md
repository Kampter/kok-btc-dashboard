# 自动市场快照机制实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现统一内存源的自动市场快照机制，每15分钟快照BTC期权数据到PostgreSQL，保留90天。

**Architecture:** 内存缓存是唯一真相源（TTL=15min），PG是内存备份（TTL=2h），快照任务从内存读取不额外调API。所有数据读取都经过内存层。

**Tech Stack:** NestJS, @nestjs/schedule, pg, TypeScript

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `apps/api/src/deribit/deribit.service.ts` | 修改 `fetchWithCache`：只写内存，移除同步PG写入 |
| `apps/api/src/app.module.ts` | 导入 `ScheduleModule` |
| `apps/api/src/snapshot/snapshot.module.ts` | 注册 Snapshot 相关服务 |
| `apps/api/src/snapshot/snapshot.service.ts` | 快照采集逻辑：从内存读取 → 解析 → 写入快照表 |
| `apps/api/src/snapshot/snapshot-scheduler.service.ts` | 三个 `@Cron` 定时任务（快照、清理） |
| `apps/api/src/snapshot/cache-sync.service.ts` | 内存→PG 同步任务 |
| `apps/api/src/snapshot/snapshot.service.test.ts` | 单元测试 |
| `apps/api/src/snapshot/snapshot-scheduler.service.test.ts` | 定时任务测试 |

---

### Task 1: 安装 @nestjs/schedule

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: 安装依赖**

Run:
```bash
cd apps/api
pnpm add @nestjs/schedule
```

Expected: `@nestjs/schedule` 添加到 dependencies 中。

- [ ] **Step 2: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml
git commit -m "chore(api): install @nestjs/schedule for cron jobs"
```

---

### Task 2: 修改 DeribitService — 统一内存源

**Files:**
- Modify: `apps/api/src/deribit/deribit.service.ts`

将 `fetchWithCache` 改为：API 返回后**只写内存**，PG 写入由独立同步任务负责。

- [ ] **Step 1: 修改 `fetchWithCache` 方法**

将现有 `fetchWithCache` 替换为以下逻辑。关键改动：
1. 内存 TTL 改为 15 分钟（900000ms）
2. API 返回后**只写内存**，删除同步 `persistentCache.set`
3. PG 命中时写入内存（恢复机制）

```typescript
  private async fetchWithCache<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlMs = 900000, // 15 minutes
  ): Promise<T> {
    // L1: 内存缓存（唯一真相源）
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached) return cached;

    // L2: PostgreSQL 持久化缓存（仅用于服务重启后恢复内存）
    if (this.persistentCache) {
      try {
        const persistent = await this.persistentCache.get<T>(cacheKey);
        if (persistent) {
          // 从 PG 恢复内存
          await this.cacheManager.set(cacheKey, persistent, ttlMs);
          return persistent;
        }
      } catch (error) {
        Logger.warn(
          `L2 cache read failed for ${cacheKey}, falling back to API: ${error instanceof Error ? error.message : String(error)}`,
          'DeribitService',
        );
      }
    }

    try {
      const result = await fetcher();
      // 只写内存，PG 写入由 CacheSyncService 独立执行
      await this.cacheManager.set(cacheKey, result, ttlMs);
      return result;
    } catch (error) {
      // API 失败时尝试返回 L2 中的过期数据
      if (this.persistentCache) {
        try {
          const stale = await this.persistentCache.get<T>(cacheKey, { includeExpired: true });
          if (stale) return stale;
        } catch (error) {
          Logger.warn(
            `L2 stale cache read failed for ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
            'DeribitService',
          );
        }
      }
      throw error;
    }
  }
```

- [ ] **Step 2: 修改 `getHistoricalVolatility` 的 TTL**

将 `historicalVolatility` 的 TTL 改为 15 分钟：

```typescript
  async getHistoricalVolatility(currency: string) {
    return this.fetchWithCache(
      `hist_vol_${currency}`,
      async () => {
        const { data } = await this.client.get('/get_historical_volatility', {
          params: { currency },
        });
        return data.result as Array<[number, number]>;
      },
      900000, // 15 minutes
    );
  }
```

- [ ] **Step 3: 运行测试确保没破坏现有功能**

Run:
```bash
cd apps/api
pnpm test:run
```

Expected: 所有现有测试通过。

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/deribit/deribit.service.ts
git commit -m "feat(api): unify data source to memory cache only

- fetchWithCache now only writes to memory, PG sync is handled by CacheSyncService
- Memory TTL extended to 15 minutes
- PG cache serves only as recovery source after restart"
```

---

### Task 3: 注册 ScheduleModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 导入 ScheduleModule**

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { DeribitModule } from './deribit/deribit.module';
import { TrpcModule } from './trpc/trpc.module';
import { ChatModule } from './chat/chat.module';
import { SnapshotModule } from './snapshot/snapshot.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.register({
      isGlobal: true,
      ttl: 900000, // 15 minutes
    }),
    DatabaseModule,
    DeribitModule,
    TrpcModule,
    ChatModule,
    SnapshotModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register ScheduleModule and SnapshotModule"
```

---

### Task 4: 创建 SnapshotService

**Files:**
- Create: `apps/api/src/snapshot/snapshot.service.ts`
- Create: `apps/api/src/snapshot/snapshot.service.test.ts`

SnapshotService 负责：
1. 确保快照表存在（`onModuleInit`）
2. 从内存缓存读取数据并解析为结构化快照
3. 批量写入 `market_snapshots` 和 `contract_snapshots`

- [ ] **Step 1: 写单元测试（先写测试）**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotService } from './snapshot.service';

const mockPool = {
  query: vi.fn(),
} as unknown as import('pg').Pool;

const mockCacheManager = {
  get: vi.fn(),
} as unknown as import('cache-manager').Cache;

describe('SnapshotService', () => {
  let service: SnapshotService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SnapshotService(mockPool, mockCacheManager);
  });

  describe('collectSnapshot', () => {
    it('should skip when book_summary cache is empty', async () => {
      mockCacheManager.get = vi.fn().mockResolvedValue(null);

      await service.collectSnapshot();

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should skip when index_price cache is empty', async () => {
      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce([{ instrument_name: 'BTC-30MAY26-100000-C', open_interest: 100 }])
        .mockResolvedValueOnce(null);

      await service.collectSnapshot();

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should calculate market aggregates correctly', async () => {
      const bookData = [
        {
          instrument_name: 'BTC-30MAY26-100000-C',
          open_interest: 100,
          volume_usd: 50000,
          underlying_price: 100000,
          mark_iv: 65,
          bid_iv: 64,
          ask_iv: 66,
          strike: 100000,
        },
        {
          instrument_name: 'BTC-30MAY26-95000-P',
          open_interest: 200,
          volume_usd: 30000,
          underlying_price: 100000,
          mark_iv: 70,
          bid_iv: 69,
          ask_iv: 71,
          strike: 95000,
        },
      ];
      const indexData = { index_price: 100000 };

      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce(bookData)
        .mockResolvedValueOnce(indexData);

      // Mock the INSERT returning snapshot_id = 1
      mockPool.query = vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // market_snapshots INSERT
        .mockResolvedValueOnce({}); // contract_snapshots batch INSERT

      await service.collectSnapshot();

      // Verify market_snapshots was called with correct aggregates
      const marketSnapshotCall = mockPool.query.mock.calls[0];
      expect(marketSnapshotCall[0]).toContain('INSERT INTO market_snapshots');
      // btc_price = 100000
      expect(marketSnapshotCall[1]).toContain(100000);
      // total_oi_usd = (100 + 200) * 100000 = 30,000,000
      expect(marketSnapshotCall[1]).toContain(30000000);
      // total_volume_24h_usd = 50000 + 30000 = 80000
      expect(marketSnapshotCall[1]).toContain(80000);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/api
pnpm test snapshot.service.test.ts
```

Expected: FAIL — `SnapshotService` not found。

- [ ] **Step 3: 实现 SnapshotService**

```typescript
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Pool } from 'pg';
import { parseInstrumentName } from '@kok/shared-types';
import { DB_POOL } from '../database/persistent-cache.service';

const CONTRACT_MULTIPLIER = 1;

interface BookSummaryItem {
  instrument_name: string;
  open_interest: number;
  volume_usd: number;
  underlying_price: number;
  mark_iv: number;
  bid_iv: number;
  ask_iv: number;
}

interface IndexPriceData {
  index_price: number;
}

@Injectable()
export class SnapshotService implements OnModuleInit {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS market_snapshots (
        id            SERIAL PRIMARY KEY,
        snapshot_at   TIMESTAMPTZ NOT NULL UNIQUE,
        btc_price     NUMERIC(16,2),
        total_oi_usd  NUMERIC(20,2),
        total_volume_24h_usd NUMERIC(20,2),
        atm_iv        NUMERIC(8,4),
        pc_ratio      NUMERIC(6,4),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_market_snapshots_time
      ON market_snapshots(snapshot_at)
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS contract_snapshots (
        id              SERIAL PRIMARY KEY,
        snapshot_id     INTEGER NOT NULL REFERENCES market_snapshots(id) ON DELETE CASCADE,
        instrument_name TEXT NOT NULL,
        strike          NUMERIC(16,2) NOT NULL,
        expiry          TIMESTAMPTZ NOT NULL,
        option_type     CHAR(1) NOT NULL CHECK (option_type IN ('C', 'P')),
        open_interest   NUMERIC(20,2),
        open_interest_usd NUMERIC(20,2),
        mark_iv         NUMERIC(8,4),
        bid_iv          NUMERIC(8,4),
        ask_iv          NUMERIC(8,4),
        underlying_price NUMERIC(16,2),
        volume_24h      NUMERIC(20,2),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_snapshots_snapshot
      ON contract_snapshots(snapshot_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_snapshots_instrument
      ON contract_snapshots(instrument_name)
    `);
  }

  async collectSnapshot(): Promise<void> {
    const bookData = await this.cacheManager.get<BookSummaryItem[]>('book_summary_BTC_option');
    const indexData = await this.cacheManager.get<IndexPriceData>('index_price_btc_usd');

    if (!bookData || !indexData) {
      this.logger.warn('Memory cache empty, skipping snapshot collection');
      return;
    }

    const btcPrice = indexData.index_price ?? 0;

    // Calculate market aggregates
    let totalOiUsd = 0;
    let totalVolume24hUsd = 0;
    let callOiUsd = 0;
    let putOiUsd = 0;
    const atmIVs: number[] = [];

    for (const item of bookData) {
      const oi = (item.open_interest as number) ?? 0;
      const underlyingPrice = (item.underlying_price as number) ?? btcPrice;
      const oiUsd = oi * underlyingPrice * CONTRACT_MULTIPLIER;
      const volume = (item.volume_usd as number) ?? 0;

      totalOiUsd += oiUsd;
      totalVolume24hUsd += volume;

      try {
        const parsed = parseInstrumentName(item.instrument_name);
        if (parsed.optionType === 'C') {
          callOiUsd += oiUsd;
        } else {
          putOiUsd += oiUsd;
        }

        const iv = (item.mark_iv as number) ?? 0;
        if (parsed.strike >= btcPrice * 0.98 && parsed.strike <= btcPrice * 1.02 && iv > 0) {
          atmIVs.push(iv);
        }
      } catch {
        // Skip instruments that fail parsing
      }
    }

    const atmIV = atmIVs.length > 0
      ? atmIVs.reduce((sum, iv) => sum + iv, 0) / atmIVs.length
      : 0;

    const pcRatio = (putOiUsd + callOiUsd) > 0
      ? putOiUsd / (putOiUsd + callOiUsd)
      : 0;

    // Insert market snapshot
    const snapshotAt = new Date();
    snapshotAt.setSeconds(0, 0); // Truncate to minute

    const marketResult = await this.pool.query(
      `INSERT INTO market_snapshots (snapshot_at, btc_price, total_oi_usd, total_volume_24h_usd, atm_iv, pc_ratio)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (snapshot_at) DO NOTHING
       RETURNING id`,
      [snapshotAt, btcPrice, totalOiUsd, totalVolume24hUsd, atmIV, pcRatio],
    );

    if (marketResult.rows.length === 0) {
      this.logger.warn(`Snapshot already exists for ${snapshotAt.toISOString()}, skipping`);
      return;
    }

    const snapshotId = marketResult.rows[0].id;

    // Batch insert contract snapshots
    const contractValues: unknown[] = [];
    for (const item of bookData) {
      try {
        const parsed = parseInstrumentName(item.instrument_name);
        const oi = (item.open_interest as number) ?? 0;
        const underlyingPrice = (item.underlying_price as number) ?? btcPrice;
        const oiUsd = oi * underlyingPrice * CONTRACT_MULTIPLIER;

        contractValues.push([
          snapshotId,
          item.instrument_name,
          parsed.strike,
          parsed.expiry,
          parsed.optionType,
          oi,
          oiUsd,
          (item.mark_iv as number) ?? 0,
          (item.bid_iv as number) ?? 0,
          (item.ask_iv as number) ?? 0,
          underlyingPrice,
          (item.volume_usd as number) ?? 0,
        ]);
      } catch {
        // Skip instruments that fail parsing
      }
    }

    if (contractValues.length > 0) {
      const placeholders = contractValues
        .map((_, i) => `($${i * 13 + 1}, $${i * 13 + 2}, $${i * 13 + 3}, $${i * 13 + 4}, $${i * 13 + 5}, $${i * 13 + 6}, $${i * 13 + 7}, $${i * 13 + 8}, $${i * 13 + 9}, $${i * 13 + 10}, $${i * 13 + 11}, $${i * 13 + 12}, $${i * 13 + 13})`)
        .join(', ');

      const flatValues = contractValues.flat();

      await this.pool.query(
        `INSERT INTO contract_snapshots (
          snapshot_id, instrument_name, strike, expiry, option_type,
          open_interest, open_interest_usd, mark_iv, bid_iv, ask_iv,
          underlying_price, volume_24h
        ) VALUES ${placeholders}`,
        flatValues,
      );
    }

    this.logger.log(`Snapshot collected: id=${snapshotId}, contracts=${contractValues.length}, time=${snapshotAt.toISOString()}`);
  }

  async cleanupOldSnapshots(): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM market_snapshots WHERE snapshot_at < NOW() - INTERVAL \'90 days\'',
    );
    if (result.rowCount && result.rowCount > 0) {
      this.logger.log(`Cleaned up ${result.rowCount} old snapshots`);
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
cd apps/api
pnpm test snapshot.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/snapshot/snapshot.service.ts apps/api/src/snapshot/snapshot.service.test.ts
git commit -m "feat(api): add SnapshotService for collecting market snapshots

- Creates market_snapshots and contract_snapshots tables on init
- Collects snapshot from memory cache every 15 minutes
- Calculates aggregate metrics (total_oi, atm_iv, pc_ratio)
- Cleans up snapshots older than 90 days"
```

---

### Task 5: 创建 CacheSyncService

**Files:**
- Create: `apps/api/src/snapshot/cache-sync.service.ts`

负责每 10 分钟将内存缓存同步到 PG。

- [ ] **Step 1: 实现 CacheSyncService**

```typescript
import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Cron } from '@nestjs/schedule';
import { PersistentCacheService } from '../database/persistent-cache.service';

const CACHE_KEYS = [
  'book_summary_BTC_option',
  'index_price_btc_usd',
  'hist_vol_BTC',
  'trades_BTC_option_100',
];

const PG_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class CacheSyncService {
  private readonly logger = new Logger(CacheSyncService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly persistentCache: PersistentCacheService,
  ) {}

  @Cron('*/10 * * * *') // Every 10 minutes
  async syncCacheToPersistentStorage(): Promise<void> {
    for (const key of CACHE_KEYS) {
      try {
        const data = await this.cacheManager.get(key);
        if (data !== undefined && data !== null) {
          await this.persistentCache.set(key, data, PG_TTL_MS);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to sync ${key} to persistent cache: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.logger.log('Cache sync completed');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/snapshot/cache-sync.service.ts
git commit -m "feat(api): add CacheSyncService for memory-to-PG sync

- Syncs cache entries to PostgreSQL every 10 minutes
- PG retains data for 2 hours (recovery after restart)"
```

---

### Task 6: 创建 SnapshotSchedulerService

**Files:**
- Create: `apps/api/src/snapshot/snapshot-scheduler.service.ts`
- Create: `apps/api/src/snapshot/snapshot-scheduler.service.test.ts`

- [ ] **Step 1: 写测试（先写测试）**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';

const mockSnapshotService = {
  collectSnapshot: vi.fn(),
  cleanupOldSnapshots: vi.fn(),
};

describe('SnapshotSchedulerService', () => {
  let scheduler: SnapshotSchedulerService;

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = new SnapshotSchedulerService(mockSnapshotService as any);
  });

  it('should call collectSnapshot on scheduled interval', async () => {
    await scheduler.handleSnapshotCollection();
    expect(mockSnapshotService.collectSnapshot).toHaveBeenCalledTimes(1);
  });

  it('should call cleanupOldSnapshots on scheduled interval', async () => {
    await scheduler.handleCleanup();
    expect(mockSnapshotService.cleanupOldSnapshots).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/api
pnpm test snapshot-scheduler.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 SnapshotSchedulerService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SnapshotService } from './snapshot.service';

@Injectable()
export class SnapshotSchedulerService {
  private readonly logger = new Logger(SnapshotSchedulerService.name);

  constructor(private readonly snapshotService: SnapshotService) {}

  @Cron('*/15 * * * *') // Every 15 minutes: :00, :15, :30, :45
  async handleSnapshotCollection(): Promise<void> {
    this.logger.log('Starting scheduled snapshot collection');
    try {
      await this.snapshotService.collectSnapshot();
    } catch (error) {
      this.logger.error(
        `Snapshot collection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Cron('0 3 * * *') // Daily at 3:00 AM
  async handleCleanup(): Promise<void> {
    this.logger.log('Starting scheduled snapshot cleanup');
    try {
      await this.snapshotService.cleanupOldSnapshots();
    } catch (error) {
      this.logger.error(
        `Snapshot cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
cd apps/api
pnpm test snapshot-scheduler.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/snapshot/snapshot-scheduler.service.ts apps/api/src/snapshot/snapshot-scheduler.service.test.ts
git commit -m "feat(api): add SnapshotSchedulerService with cron jobs

- Snapshot collection every 15 minutes
- Cleanup old snapshots (90d+) daily at 3:00 AM"
```

---

### Task 7: 创建 SnapshotModule

**Files:**
- Create: `apps/api/src/snapshot/snapshot.module.ts`

- [ ] **Step 1: 实现 SnapshotModule**

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SnapshotService } from './snapshot.service';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';
import { CacheSyncService } from './cache-sync.service';

@Module({
  imports: [DatabaseModule],
  providers: [SnapshotService, SnapshotSchedulerService, CacheSyncService],
})
export class SnapshotModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/snapshot/snapshot.module.ts
git commit -m "feat(api): add SnapshotModule"
```

---

### Task 8: 全量类型检查和测试

- [ ] **Step 1: 运行类型检查**

Run:
```bash
cd apps/api
pnpm typecheck
```

Expected: 无类型错误。

- [ ] **Step 2: 运行所有测试**

Run:
```bash
cd apps/api
pnpm test:run
```

Expected: 所有测试通过（包括新增的 snapshot 测试和现有测试）。

- [ ] **Step 3: Commit**

```bash
git commit -m "test(api): verify snapshot feature with full test suite"
```

---

## Spec Coverage Check

| 设计文档要求 | 对应任务 |
|-------------|---------|
| 内存是唯一真相源，TTL=15min | Task 2 |
| 移除 `fetchWithCache` 同步 PG 写入 | Task 2 |
| PG 作为内存备份，TTL=2h | Task 5 |
| 内存→PG 同步任务每 10 分钟 | Task 5 |
| 快照任务每 15 分钟从内存读取 | Task 4, Task 6 |
| `market_snapshots` 表结构 | Task 4 |
| `contract_snapshots` 表结构 | Task 4 |
| 90 天清理 | Task 4, Task 6 |
| 聚合指标计算（total_oi, atm_iv, pc_ratio） | Task 4 |
| 批量写入 contract_snapshots | Task 4 |
| `UNIQUE` 约束防重 | Task 4 |
| 错误处理（内存为空跳过） | Task 4 |
| 测试覆盖 | Task 4, Task 6, Task 8 |

---

## 执行方式选择

Plan complete and saved to `docs/superpowers/plans/2026-05-21-auto-snapshot.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
