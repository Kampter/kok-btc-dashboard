# 数据持久化缓存 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 NestJS API 中实现双层缓存（L1 内存 + L2 PostgreSQL），解决服务重启缓存丢失和多用户重复调用 Deribit API 的问题。

**Architecture:** 保留现有 `@nestjs/cache-manager` 内存缓存（30s TTL），新增 `PersistentCacheService` 通过 `pg` 客户端读写 PostgreSQL 作为持久化缓存层（10min TTL）。`DeribitService` 在 `fetchWithCache` 中先查 L1、再查 L2、最后调 Deribit API，写入时双写 L1+L2。L2 使用独立的 `DatabaseModule`。

**Tech Stack:** NestJS, `pg` (PostgreSQL client), Vitest, unplugin-swc

---

## File Structure

| 文件 | 动作 | 职责 |
|------|------|------|
| `apps/api/package.json` | 修改 | 添加 `pg` 依赖 |
| `apps/api/src/database/persistent-cache.service.ts` | 新建 | L2 缓存读写、表自动创建、过期清理 |
| `apps/api/src/database/persistent-cache.service.test.ts` | 新建 | PersistentCacheService 单元测试 |
| `apps/api/src/database/database.module.ts` | 新建 | DatabaseModule：提供 Pool 和 PersistentCacheService |
| `apps/api/src/deribit/deribit.service.ts` | 修改 | `fetchWithCache` 增加 L2 查询与双写逻辑 |
| `apps/api/src/deribit/deribit.service.test.ts` | 修改 | 更新构造参数，适配新 DI |
| `apps/api/src/deribit/deribit.service.edge.test.ts` | 修改 | 更新构造参数；新增 L2 缓存场景测试 |
| `apps/api/src/deribit/deribit.module.ts` | 修改 | 导入 `DatabaseModule` |
| `apps/api/src/app.module.ts` | 修改 | 导入 `DatabaseModule` |
| `apps/api/.env.example` | 新建 | DATABASE_URL 环境变量示例 |

---

## Task 1: 添加 `pg` 依赖

**Files:**
- Modify: `apps/api/package.json`

**说明：** 在 `dependencies` 中添加 `pg`，用于连接 PostgreSQL。

- [ ] **Step 1: 修改 `apps/api/package.json`**

在 `"dependencies"` 中加入：
```json
"pg": "^8.15.6"
```

`dependencies` 完整形态：
```json
"dependencies": {
  "@kok/shared-types": "workspace:*",
  "@nestjs/cache-manager": "^3.0.1",
  "@nestjs/common": "^11.1.21",
  "@nestjs/core": "^11.1.21",
  "@nestjs/platform-express": "^11.1.21",
  "@trpc/server": "^11.17.0",
  "axios": "^1.8.0",
  "cache-manager": "^6.4.2",
  "pg": "^8.15.6",
  "reflect-metadata": "^0.2.2",
  "rxjs": "^7.8.2",
  "zod": "^4.4.3"
}
```

- [ ] **Step 2: 安装依赖**

Run:
```bash
cd apps/api && pnpm install
```

Expected: 安装成功，无报错。

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "deps(api): add pg for PostgreSQL persistent cache"
```

---

## Task 2: 创建 `PersistentCacheService`（TDD）

**Files:**
- Create: `apps/api/src/database/persistent-cache.service.ts`
- Create: `apps/api/src/database/persistent-cache.service.test.ts`

**说明：** 该服务负责所有 PostgreSQL 缓存操作。通过 mock `pg.Pool` 的 `.query()` 方法进行单元测试，无需真实数据库。

- [ ] **Step 1: 创建目录**

Run:
```bash
mkdir -p apps/api/src/database
```

- [ ] **Step 2: 写失败的测试 `persistent-cache.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersistentCacheService } from './persistent-cache.service'

const mockQuery = vi.fn()

// 模拟一个 pg.Pool 对象（只有 query 方法）
function createMockPool() {
  return { query: mockQuery } as unknown as import('pg').Pool
}

describe('PersistentCacheService', () => {
  let service: PersistentCacheService

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockReset()
    service = new PersistentCacheService(createMockPool())
  })

  describe('onModuleInit', () => {
    it('creates cache_entries table on init', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
      await service.onModuleInit()
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS cache_entries'),
      )
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at'),
      )
    })

    it('cleans up expired entries on init', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 5 })
      await service.onModuleInit()
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at <= NOW()"),
      )
    })
  })

  describe('get', () => {
    it('returns cached value when key exists and not expired', async () => {
      const cachedValue = { foo: 'bar' }
      mockQuery.mockResolvedValueOnce({ rows: [{ value: cachedValue }], rowCount: 1 })

      const result = await service.get('test_key')

      expect(result).toEqual(cachedValue)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value FROM cache_entries'),
        ['test_key'],
      )
    })

    it('returns null when key does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await service.get('missing_key')

      expect(result).toBeNull()
    })

    it('returns null when key is expired', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await service.get('expired_key')

      expect(result).toBeNull()
    })

    it('returns expired value when includeExpired is true', async () => {
      const staleValue = { stale: true }
      mockQuery.mockResolvedValueOnce({ rows: [{ value: staleValue }], rowCount: 1 })

      const result = await service.get('expired_key', { includeExpired: true })

      expect(result).toEqual(staleValue)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value FROM cache_entries WHERE cache_key = $1'),
        ['expired_key'],
      )
    })
  })

  describe('set', () => {
    it('inserts or updates cache entry with expiration', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

      await service.set('test_key', { data: 123 }, 600000)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cache_entries'),
        ['test_key', JSON.stringify({ data: 123 }), expect.any(Date)],
      )
    })
  })

  describe('cleanupExpired', () => {
    it('deletes expired entries and logs count', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 })
      await service.cleanupExpired()
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM cache_entries WHERE expires_at IS NOT NULL'),
      )
    })
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run:
```bash
cd apps/api && pnpm test persistent-cache.service.test.ts
```

Expected: FAIL with `Error: Cannot find module './persistent-cache.service'` 或类似的 import 错误。

- [ ] **Step 4: 实现 `persistent-cache.service.ts`**

```typescript
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common'
import type { Pool } from 'pg'

export const DB_POOL = Symbol('DB_POOL')

@Injectable()
export class PersistentCacheService implements OnModuleInit {
  private readonly logger = new Logger(PersistentCacheService.name)

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTable()
    await this.cleanupExpired()
  }

  private async ensureTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key   TEXT PRIMARY KEY,
        value       JSONB NOT NULL,
        expires_at  TIMESTAMP WITH TIME ZONE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at
      ON cache_entries(expires_at)
    `)
  }

  async get<T>(key: string, options?: { includeExpired?: boolean }): Promise<T | null> {
    const includeExpired = options?.includeExpired ?? false

    const query = includeExpired
      ? 'SELECT value FROM cache_entries WHERE cache_key = $1'
      : 'SELECT value FROM cache_entries WHERE cache_key = $1 AND (expires_at IS NULL OR expires_at > NOW())'

    const result = await this.pool.query(query, [key])
    if (result.rows.length === 0) return null
    return result.rows[0].value as T
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs)
    await this.pool.query(
      `INSERT INTO cache_entries (cache_key, value, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE SET
         value = EXCLUDED.value,
         expires_at = EXCLUDED.expires_at,
         created_at = NOW()`,
      [key, JSON.stringify(value), expiresAt],
    )
  }

  async cleanupExpired(): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at <= NOW()',
    )
    if (result.rowCount && result.rowCount > 0) {
      this.logger.log(`Cleaned up ${result.rowCount} expired cache entries`)
    }
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
cd apps/api && pnpm test persistent-cache.service.test.ts
```

Expected: ALL PASS (6 test suites, ~12 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/database/
git commit -m "feat(api): add PersistentCacheService with PostgreSQL backend"
```

---

## Task 3: 创建 `DatabaseModule`

**Files:**
- Create: `apps/api/src/database/database.module.ts`

**说明：** NestJS 模块，负责创建 `pg.Pool` 实例并导出 `PersistentCacheService`。

- [ ] **Step 1: 实现 `database.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { Pool } from 'pg'
import { PersistentCacheService, DB_POOL } from './persistent-cache.service'

@Module({
  providers: [
    {
      provide: DB_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL
        if (!connectionString) {
          throw new Error('DATABASE_URL environment variable is not set')
        }
        return new Pool({ connectionString })
      },
    },
    PersistentCacheService,
  ],
  exports: [PersistentCacheService],
})
export class DatabaseModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/database/database.module.ts
git commit -m "feat(api): add DatabaseModule with pg Pool provider"
```

---

## Task 4: 改造 `DeribitService` 实现双层缓存（TDD）

**Files:**
- Modify: `apps/api/src/deribit/deribit.service.ts`
- Modify: `apps/api/src/deribit/deribit.service.test.ts`
- Modify: `apps/api/src/deribit/deribit.service.edge.test.ts`

**说明：** 在 `fetchWithCache` 中增加 L2 查询；`DeribitService` 构造函数增加可选的 `PersistentCacheService` 参数；所有现有测试需要更新构造参数。

- [ ] **Step 1: 更新 `deribit.service.test.ts` 的构造参数**

在 `apps/api/src/deribit/deribit.service.test.ts` 中，将 `beforeEach` 修改为：

```typescript
  const mockCacheManager = {
    get: vi.fn<Cache['get']>(),
    set: vi.fn<Cache['set']>(),
  }
  const mockPersistentCache = {
    get: vi.fn(),
    set: vi.fn(),
    cleanupExpired: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCacheManager.get.mockResolvedValue(undefined)
    mockCacheManager.set.mockResolvedValue(undefined)
    mockPersistentCache.get.mockResolvedValue(null)
    mockPersistentCache.set.mockResolvedValue(undefined)
    service = new DeribitService(mockCacheManager as Cache, mockPersistentCache as any)
  })
```

其余测试内容保持不变。

- [ ] **Step 2: 更新 `deribit.service.edge.test.ts` 的构造参数**

同样在 `beforeEach` 中添加 `mockPersistentCache`：

```typescript
  const mockCacheManager = {
    get: vi.fn<Cache['get']>(),
    set: vi.fn<Cache['set']>(),
  }
  const mockPersistentCache = {
    get: vi.fn(),
    set: vi.fn(),
    cleanupExpired: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCacheManager.get.mockResolvedValue(undefined)
    mockCacheManager.set.mockResolvedValue(undefined)
    mockPersistentCache.get.mockResolvedValue(null)
    mockPersistentCache.set.mockResolvedValue(undefined)
    service = new DeribitService(mockCacheManager as Cache, mockPersistentCache as any)
  })
```

**注意：** 现有的 edge case 测试（cache hit, 429 rate limit, stale fallback 等）应该继续通过，因为 `mockPersistentCache.get` 默认返回 `null`，流程会走到 API 调用，与之前行为一致。

- [ ] **Step 3: 运行现有测试确认它们仍然编译和通过**

Run:
```bash
cd apps/api && pnpm test deribit.service.test.ts deribit.service.edge.test.ts
```

Expected: 编译通过，但可能有一些测试行为差异（因为构造参数变了）。如果编译失败，修复类型错误后再继续。

- [ ] **Step 4: 在 `deribit.service.edge.test.ts` 中新增 L2 缓存场景测试**

在文件末尾的 `describe('DeribitService edge cases', ...)` 内，新增 describe block：

```typescript
  describe('two-layer caching', () => {
    it('L1 miss + L2 hit: returns persistent cache and writes back to L1', async () => {
      const persistentData = [{ instrument_name: 'BTC-L2-HIT' }]
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(persistentData)

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(mockGet).not.toHaveBeenCalled() // 不应调用 Deribit API
      expect(result).toEqual(persistentData)
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'book_summary_BTC_option',
        persistentData,
        30000,
      )
    })

    it('L1 miss + L2 miss: calls API and writes to both L1 and L2', async () => {
      const apiData = { result: rawBookSummaryBTC }
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null)
      mockGet.mockResolvedValueOnce({ data: apiData })

      await service.getBookSummaryByCurrency('BTC', 'option')

      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'book_summary_BTC_option',
        rawBookSummaryBTC,
        30000,
      )
      expect(mockPersistentCache.set).toHaveBeenCalledWith(
        'book_summary_BTC_option',
        rawBookSummaryBTC,
        600000, // 30s * 20 = 10min
      )
    })

    it('L2 read failure degrades gracefully to API call', async () => {
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockRejectedValueOnce(new Error('PG connection lost'))
      mockGet.mockResolvedValueOnce({ data: { result: rawBookSummaryBTC } })

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(result).toEqual(rawBookSummaryBTC)
    })

    it('API error falls back to stale L2 cache', async () => {
      const staleData = [{ instrument_name: 'BTC-STALE-L2' }]
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null) // first call: fresh check
      mockGet.mockRejectedValueOnce(new Error('API down'))
      mockPersistentCache.get.mockResolvedValueOnce(staleData) // second call: includeExpired

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual(staleData)
      expect(mockPersistentCache.get).toHaveBeenCalledTimes(2)
      expect(mockPersistentCache.get).toHaveBeenLastCalledWith(
        'book_summary_BTC_option',
        { includeExpired: true },
      )
    })

    it('works without PersistentCacheService (backward compatible)', async () => {
      const serviceWithoutL2 = new DeribitService(mockCacheManager as Cache, undefined as any)
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockGet.mockResolvedValueOnce({ data: { result: rawBookSummaryBTC } })

      const result = await serviceWithoutL2.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual(rawBookSummaryBTC)
      expect(mockPersistentCache.set).not.toHaveBeenCalled()
    })
  })
```

- [ ] **Step 5: 运行新增测试，确认失败**

Run:
```bash
cd apps/api && pnpm test deribit.service.edge.test.ts
```

Expected: 新增测试 FAIL（因为 DeribitService 尚未实现 L2 逻辑）。已有测试应继续通过。

- [ ] **Step 6: 修改 `DeribitService` 实现 L2 缓存**

修改 `apps/api/src/deribit/deribit.service.ts`：

**import 变更：** 在文件顶部新增：
```typescript
import { Optional } from '@nestjs/common'
import { PersistentCacheService } from '../database/persistent-cache.service'
```

**构造函数变更：**
```typescript
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Optional() private readonly persistentCache?: PersistentCacheService,
  ) {}
```

**`fetchWithCache` 方法变更：** 将现有方法替换为：

```typescript
  private async fetchWithCache<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlMs = 30000,
  ): Promise<T> {
    // L1: 内存缓存
    const cached = await this.cacheManager.get<T>(cacheKey)
    if (cached) return cached

    // L2: PostgreSQL 持久化缓存
    if (this.persistentCache) {
      try {
        const persistent = await this.persistentCache.get<T>(cacheKey)
        if (persistent) {
          await this.cacheManager.set(cacheKey, persistent, ttlMs)
          return persistent
        }
      } catch (error) {
        Logger.error(
          `Persistent cache read failed for ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
          'DeribitService',
        )
      }
    }

    try {
      const result = await fetcher()
      await this.cacheManager.set(cacheKey, result, ttlMs)

      if (this.persistentCache) {
        try {
          await this.persistentCache.set(cacheKey, result, ttlMs * 20)
        } catch (error) {
          Logger.error(
            `Persistent cache write failed for ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
            'DeribitService',
          )
        }
      }

      return result
    } catch (error) {
      // API 失败时尝试返回 L2 中的过期数据
      if (this.persistentCache) {
        try {
          const stale = await this.persistentCache.get<T>(cacheKey, { includeExpired: true })
          if (stale) return stale
        } catch {
          // 忽略 stale cache 读取错误
        }
      }
      throw error
    }
  }
```

- [ ] **Step 7: 运行所有 DeribitService 测试确认通过**

Run:
```bash
cd apps/api && pnpm test deribit.service.test.ts deribit.service.edge.test.ts
```

Expected: ALL PASS（包括新增的 L2 缓存测试）

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/deribit/deribit.service.ts apps/api/src/deribit/deribit.service.test.ts apps/api/src/deribit/deribit.service.edge.test.ts
git commit -m "feat(api): two-layer caching in DeribitService (memory + PostgreSQL)"
```

---

## Task 5: 更新 `DeribitModule` 导入 `DatabaseModule`

**Files:**
- Modify: `apps/api/src/deribit/deribit.module.ts`

- [ ] **Step 1: 修改 `deribit.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { DeribitService } from './deribit.service'
import { DeribitController } from './deribit.controller'

@Module({
  imports: [DatabaseModule],
  providers: [DeribitService],
  controllers: [DeribitController],
  exports: [DeribitService],
})
export class DeribitModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/deribit/deribit.module.ts
git commit -m "feat(api): DeribitModule imports DatabaseModule"
```

---

## Task 6: 更新 `AppModule`

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 修改 `app.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { DatabaseModule } from './database/database.module'
import { DeribitModule } from './deribit/deribit.module'
import { TrpcModule } from './trpc/trpc.module'

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 30000, // 30 seconds
    }),
    DatabaseModule,
    DeribitModule,
    TrpcModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): AppModule imports DatabaseModule"
```

---

## Task 7: 添加 `.env.example` 环境变量文档

**Files:**
- Create: `apps/api/.env.example`

- [ ] **Step 1: 创建文件**

```
# API Server
PORT=3000
FRONTEND_URL=http://localhost:5173

# PostgreSQL persistent cache
DATABASE_URL=postgresql://user:password@localhost:5432/kok_cache
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/.env.example
git commit -m "docs(api): add .env.example with DATABASE_URL"
```

---

## Task 8: 全量测试验证

- [ ] **Step 1: 运行 API 全部单元测试**

Run:
```bash
cd apps/api && pnpm test:run
```

Expected: ALL PASS，无编译错误。

- [ ] **Step 2: 运行全量类型检查**

Run:
```bash
cd apps/api && pnpm typecheck
```

Expected: 无类型错误。

- [ ] **Step 3: Commit（如测试通过）**

如果全部通过：
```bash
git commit --allow-empty -m "chore(api): all tests passing after persistence cache implementation"
```

如果有失败，先修复再提交。

---

## Self-Review Checklist

### Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|-----------|
| `PersistentCacheService` (get/set/cleanupExpired) | Task 2 |
| `cache_entries` 表启动时自动创建 | Task 2 (`ensureTable`) |
| `DeribitService` L2 查询 + 双写 | Task 4 |
| L1 内存缓存保留（30s TTL） | Task 4（未修改 L1 逻辑） |
| L2 PostgreSQL TTL 更长（10min = 30s * 20） | Task 4 (`ttlMs * 20`) |
| 降级策略（PG 连接失败不阻塞请求） | Task 4（try/catch 包裹所有 L2 操作） |
| stale-while-error（API 失败返回过期缓存） | Task 4 + Task 2 edge test |
| 启动时过期清理 | Task 2 (`onModuleInit` → `cleanupExpired`) |
| 环境变量 `DATABASE_URL` | Task 7 |
| 不使用 Mock 数据 | 全部（缓存数据均来自真实 API 响应） |

### Placeholder Scan

- [x] 无 "TBD" / "TODO"
- [x] 无 "add appropriate error handling" 等模糊描述
- [x] 所有测试步骤包含完整测试代码
- [x] 所有实现步骤包含完整实现代码

### Type Consistency

- [x] `PersistentCacheService.get<T>` 签名与 DeribitService 中的调用一致（`includeExpired`）
- [x] `PersistentCacheService.set<T>` 签名与调用一致
- [x] `DB_POOL` symbol 在 service 和 module 中定义和使用一致
- [x] `DeribitService` 构造函数参数顺序与所有测试文件中的实例化一致
