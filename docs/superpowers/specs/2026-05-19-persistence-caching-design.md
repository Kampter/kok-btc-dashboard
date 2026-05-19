# 数据持久化缓存系统设计

## 背景与问题

当前服务端缓存使用 `@nestjs/cache-manager` 的**内存存储**（`cache-manager` 6.x 默认），存在两个核心问题：

1. **服务重启即丢失**：内存缓存无法持久化，每次重启后所有数据需重新从 Deribit API 拉取
2. **多用户重复调用**：多个用户同时访问时，各自触发独立的 Deribit API 调用，浪费配额且增加延迟

## 目标

- 服务重启后，能从持久化存储恢复缓存数据，避免重复调用 Deribit
- 多用户共享同一份缓存数据，减少 API 调用次数
- 不降低现有内存缓存的高性能特性
- 不使用任何 Mock 数据，所有缓存均来自真实 Deribit API 响应

## 方案：双层缓存（内存 + PostgreSQL）

### 架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  前端用户   │────▶│ tRPC Router  │────▶│ DeribitService│────▶│ Deribit │
│             │     │              │     │             │     │   API   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
                                                │
                                                ▼
                                      ┌─────────────────────┐
                                      │  L1: 内存缓存       │
                                      │  (@nestjs/cache-    │
                                      │   manager, 30s TTL) │
                                      └─────────────────────┘
                                                │
                                                ▼ 未命中
                                      ┌─────────────────────┐
                                      │  L2: PostgreSQL     │
                                      │  持久化缓存         │
                                      └─────────────────────┘
```

### 数据流

#### 正常请求路径

1. 用户请求到达 `DeribitService`
2. **L1 内存缓存查询**：使用 `cache-manager` 的 `get()` 检查内存缓存
   - 命中且未过期 → 直接返回
   - 未命中 → 进入 L2
3. **L2 PostgreSQL 查询**：从 `cache_entries` 表查询
   - 命中且未过期 → 写回 L1 内存缓存 → 返回
   - 未命中 → 进入 Deribit API
4. **Deribit API 调用**：拉取真实数据
5. **双写**：同时写入 L1 内存缓存（30s TTL）和 L2 PostgreSQL（扩展 TTL）
6. 返回数据

#### 服务重启恢复路径

1. 服务启动，L1 内存缓存为空
2. 第一个用户请求到达
3. L1 未命中 → 查询 L2 PostgreSQL
4. L2 命中（重启前写入的缓存）→ 写回 L1 → 返回
5. **全程无需调用 Deribit API**

### PostgreSQL 表结构

```sql
CREATE TABLE cache_entries (
    cache_key   TEXT PRIMARY KEY,          -- 缓存键，如 "book_summary_BTC_option"
    value       JSONB NOT NULL,            -- 缓存值（Deribit API 原始响应）
    expires_at  TIMESTAMP WITH TIME ZONE,  -- 过期时间（比内存缓存更长）
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 查询索引
CREATE INDEX idx_cache_entries_expires_at ON cache_entries(expires_at);
```

### 缓存键策略

沿用现有 `DeribitService` 的缓存键命名：

| API 方法 | 缓存键示例 |
|---------|-----------|
| `getBookSummaryByCurrency` | `book_summary_BTC_option` |
| `getIndexPrice` | `index_price_btc_usd` |
| `getHistoricalVolatility` | `hist_vol_BTC` |
| `getLastTradesByCurrency` | `trades_BTC_option_100` |

### TTL 策略

| 层级 | TTL | 说明 |
|------|-----|------|
| L1 内存缓存 | 30s | 与现有保持一致，快速过期确保数据新鲜度 |
| L2 PostgreSQL | 10 分钟 | 比内存长，作为持久化兜底 |

### 组件设计

#### 1. `PersistentCacheService`

新服务，负责所有 PostgreSQL 缓存操作：

```typescript
@Injectable()
export class PersistentCacheService {
  // 从 PG 读取缓存
  // includeExpired: true 时返回已过期的缓存（stale-while-error 场景）
  async get<T>(key: string, options?: { includeExpired?: boolean }): Promise<T | null>

  // 写入 PG 缓存
  async set<T>(key: string, value: T, ttlMs: number): Promise<void>

  // 清理过期缓存（启动时执行一次）
  async cleanupExpired(): Promise<void>
}
```

#### 2. `DeribitService` 改造

在现有 `fetchWithCache` 中增加 L2 查询逻辑：

```typescript
private async fetchWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs = 30000,
): Promise<T> {
  // L1: 内存缓存
  const cached = await this.cacheManager.get<T>(cacheKey);
  if (cached) return cached;

  // L2: PostgreSQL 持久化缓存
  const persistent = await this.persistentCache.get<T>(cacheKey);
  if (persistent) {
    // 回写 L1
    await this.cacheManager.set(cacheKey, persistent, ttlMs);
    return persistent;
  }

  // 调用 Deribit API
  try {
    const result = await fetcher();
    // 双写 L1 + L2
    await this.cacheManager.set(cacheKey, result, ttlMs);
    await this.persistentCache.set(cacheKey, result, ttlMs * 20); // L2 TTL 更长
    return result;
  } catch (error) {
    // 如果 API 失败，尝试返回 L2 中的过期数据（stale-while-error）
    const stale = await this.persistentCache.get<T>(cacheKey, { includeExpired: true });
    if (stale) return stale;
    throw error;
  }
}
```

#### 3. 数据库模块

新增 `DatabaseModule`：

```typescript
@Module({
  providers: [
    {
      provide: 'DB_POOL',
      useFactory: () => new Pool({ connectionString: process.env.DATABASE_URL }),
    },
    PersistentCacheService,
  ],
  exports: ['DB_POOL', PersistentCacheService],
})
export class DatabaseModule {}
```

### 配置

环境变量：

```
DATABASE_URL=postgresql://user:pass@localhost:5432/kok_cache
```

### 错误处理

| 场景 | 处理策略 |
|------|---------|
| PostgreSQL 连接失败 | 降级为纯内存缓存模式，记录 error log，不阻塞请求 |
| PG 查询超时 | 直接 fallback 到 Deribit API |
| API 调用失败 | 尝试返回 PG 中的过期数据（stale-while-error） |
| PG 写入失败 | 不影响请求返回，异步记录写入失败日志 |

### 启动时清理

服务启动时执行一次过期缓存清理：

```typescript
async onModuleInit() {
  await this.persistentCache.cleanupExpired();
}
```

## 测试策略

### 单元测试

- `PersistentCacheService`：使用 `pg-mem` 或 mock `pg.Pool` 测试 get/set/cleanup 逻辑
- `DeribitService`：验证 fetchWithCache 的双层逻辑（L1 命中、L1 未命中 L2 命中、全未命中）

### 集成测试

- 启动真实 PostgreSQL 容器（testcontainers），验证：
  - 服务重启后能从 PG 恢复缓存
  - 多并发请求只触发一次 Deribit API 调用
  - TTL 过期后正确失效

### 不引入 Mock 数据

- 测试中使用真实的 `pg` 客户端连接真实/内存数据库
- Deribit API 调用仍使用 MSW 拦截（这是 API mock，不是数据 mock）或仅在集成测试中连接测试环境

## 实施范围

### 本次实现包含

- [ ] `DatabaseModule` + `PersistentCacheService`
- [ ] `cache_entries` 表启动时自动创建（若不存在）
- [ ] `DeribitService` 改造（L2 查询 + 双写）
- [ ] 环境变量配置 `DATABASE_URL`
- [ ] 单元测试 + 集成测试
- [ ] 启动时过期清理

### 后续可扩展（本次不做）

- 缓存预热（启动时预加载热点数据）
- 缓存统计（命中率监控）
- 分布式锁（防止多实例同时刷新同一缓存）
