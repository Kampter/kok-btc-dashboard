---
name: auto-snapshot-design
description: 统一内存源的自动市场快照机制，每15分钟快照BTC期权数据，支持历史回溯
metadata:
  type: project
---

# 自动市场快照机制设计（统一内存源架构）

## 背景

当前系统通过 Deribit API 获取实时数据，使用两层缓存（内存 30s + PostgreSQL 10分钟）。但缓存语义是"覆盖旧值"，无法保留历史状态。用户在忙完几小时后无法回溯"刚才发生了什么"。

更关键的是，之前的架构存在**数据来源不统一**的问题：Dashboard 实时请求、PG 持久化缓存、快照任务各自独立走 `fetchWithCache`，三者拿到的不一定是同一批数据。

## 核心决策：内存是单一真相源

所有数据（Dashboard 实时展示、PG 持久化备份、快照表归档）**都从内存缓存读取同一批数据**。API 调用只发生在内存未命中时。

### 架构对比示例

以 `book_summary_BTC_option` 为例：

**之前架构**（数据来源不统一）：
```
10:01 Dashboard 请求 → 内存空 → 调 API → 写入内存+PG → 返回数据 A
10:15 快照任务执行 → 独立走 fetchWithCache → 可能命中内存/PG/调 API → 拿到数据 B（不一定=A）
```

**统一内存源架构**：
```
10:01 Dashboard 请求 → 内存空 → 调 API → 只写内存 → 返回数据 A
10:10 内存→PG 同步 → 从内存读数据 A → 写入 PG（备份）
10:15 快照任务执行 → 从内存读数据 A → 写入快照表（和 Dashboard 看到的是同一批）
```

## 目标

1. **数据一致性**：Dashboard 和快照表看到的数据一定一致
2. **减少 API 调用**：快照任务不额外调 API，直接从内存读取
3. **历史归档**：每 15 分钟保存一次结构化快照，保留 90 天

## 缓存策略

| 层级 | 存储 | TTL | 角色 |
|-----|------|-----|------|
| L1 | 内存（`@nestjs/cache-manager`） | **15 分钟** | **唯一真相源**：所有读取都从这里开始 |
| L2 | PostgreSQL（`cache_entries` 表） | 2 小时 | **内存的备份**：服务重启时恢复内存 |

### 关键改动：移除 `fetchWithCache` 里的同步 PG 写入

```ts
// 之前：API 返回后同时写入内存和 PG
const result = await fetcher();
await this.cacheManager.set(cacheKey, result, ttlMs);
await this.persistentCache.set(key, result, ttlMs * 20); // ← 删除这行

// 之后：只写内存，PG 由独立同步任务写入
const result = await fetcher();
await this.cacheManager.set(cacheKey, result, ttlMs); // TTL 改为 15 分钟
```

### 降级策略

- **内存命中** → 直接返回（99% 的场景）
- **内存未命中，PG 缓存命中** → 恢复内存，返回数据
- **全部未命中** → 调 Deribit API，写入内存
- **API 失败** → 尝试返回 PG 中的过期数据（stale fallback）

## 表结构

### 1. market_snapshots（市场快照）

```sql
CREATE TABLE market_snapshots (
  id            SERIAL PRIMARY KEY,
  snapshot_at   TIMESTAMPTZ NOT NULL UNIQUE,
  btc_price     NUMERIC(16,2),
  total_oi_usd  NUMERIC(20,2),
  total_volume_24h_usd NUMERIC(20,2),
  atm_iv        NUMERIC(8,4),
  pc_ratio      NUMERIC(6,4),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_snapshots_time ON market_snapshots(snapshot_at);
```

字段说明：

| 字段 | 来源 | 计算方式 |
|-----|------|---------|
| `btc_price` | 内存缓存 `index_price_btc_usd` | `index_price` 原值 |
| `total_oi_usd` | 内存缓存 `book_summary_BTC_option` | 所有合约 `open_interest * underlying_price` 之和 |
| `total_volume_24h_usd` | 内存缓存 `book_summary_BTC_option` | 所有合约 `volume_usd` 之和 |
| `atm_iv` | 内存缓存 `book_summary_BTC_option` | ±2% spot 范围内合约的 `mark_iv` 加权平均 |
| `pc_ratio` | 内存缓存 `book_summary_BTC_option` | Put OI USD / (Put OI USD + Call OI USD) |

### 2. contract_snapshots（合约快照）

```sql
CREATE TABLE contract_snapshots (
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
);

CREATE INDEX idx_contract_snapshots_snapshot ON contract_snapshots(snapshot_id);
CREATE INDEX idx_contract_snapshots_instrument ON contract_snapshots(instrument_name);
```

字段说明：

| 字段 | 来源 |
|-----|------|
| `instrument_name` | 内存缓存中的 `instrument_name` |
| `strike` / `expiry` / `option_type` | 从 `instrument_name` 解析 |
| `open_interest` | 内存缓存中的 `open_interest` |
| `open_interest_usd` | `open_interest * underlying_price * CONTRACT_MULTIPLIER` |
| `mark_iv` | 内存缓存中的 `mark_iv` |
| `bid_iv` / `ask_iv` | 内存缓存中的 `bid_iv` / `ask_iv` |
| `volume_24h` | 内存缓存中的 `volume_usd` |

## 数据流

```
┌──────────────────────────────────────────────────────────────┐
│                       Deribit API                            │
└──────────────┬───────────────────────────────────────────────┘
               │ 仅内存未命中时调用
               ▼
┌──────────────────────────────────────────────────────────────┐
│                    内存缓存层（L1）                            │
│   TTL = 15 分钟                                               │
│                                                               │
│   book_summary_BTC_option  →  { 所有合约原始数据 }             │
│   index_price_btc_usd      →  { btc_price }                  │
│   trades_BTC_option_100    →  { trades }                     │
│   hist_vol_BTC             →  { historical_volatility }      │
└──────────────┬────────────────────┬───────────────────────────┘
               │                    │
               ▼                    ▼
        ┌──────────────┐    ┌──────────────────────┐
        │ Dashboard    │    │ SnapshotService      │
        │ 实时请求     │    │ 每15分钟从内存读取    │
        └──────────────┘    └──────────┬───────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ 解析 → 写入      │
                              │ market_snapshots │
                              │ contract_snapshots│
                              └─────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│               内存→PG 同步任务（每10分钟）                     │
│                                                               │
│   从内存读取所有缓存 key → 写入 PG（cache_entries）           │
│   PG 保留 2 小时，服务重启时恢复内存                          │
└──────────────────────────────────────────────────────────────┘
```

## 定时任务

### 任务 1：内存 → PG 同步（每 10 分钟）

```ts
@Cron('*/10 * * * *')
async syncCacheToPersistentStorage() {
  const keys = ['book_summary_BTC_option', 'index_price_btc_usd', 'hist_vol_BTC', 'trades_BTC_option_100'];
  for (const key of keys) {
    const data = await this.cacheManager.get(key);
    if (data) {
      await this.persistentCache.set(key, data, 2 * 60 * 60 * 1000); // PG 保留 2 小时
    }
  }
}
```

### 任务 2：市场快照采集（每 15 分钟）

```ts
@Cron('*/15 * * * *') // :00, :15, :30, :45
async collectSnapshot() {
  // 直接从内存读取，0 次 API 调用
  const bookData = await this.cacheManager.get('book_summary_BTC_option');
  const indexData = await this.cacheManager.get('index_price_btc_usd');

  if (!bookData || !indexData) {
    this.logger.warn('内存缓存为空，跳过本次快照');
    return;
  }

  // 解析并写入快照表
  // ...
}
```

### 任务 3：过期快照清理（每天凌晨 3 点）

```ts
@Cron('0 3 * * *')
async cleanupOldSnapshots() {
  await this.pool.query(
    'DELETE FROM market_snapshots WHERE snapshot_at < NOW() - INTERVAL \'90 days\''
  );
}
```

## 错误处理

| 场景 | 行为 |
|-----|------|
| 快照时内存为空 | 跳过本次快照，记录 warn log。下次同步任务会补充 PG，后续请求会刷新内存 |
| 部分合约数据缺失 | 写入已有数据，缺失字段留 NULL |
| PostgreSQL 写入失败 | 记录 error log，不中断服务。内存中的数据不受影响 |
| 同一分钟已有快照 | `snapshot_at` 用 `date_trunc('minute', NOW())`，`UNIQUE` 约束防重 |
| 服务重启 | 启动时从 PG 恢复内存缓存，恢复后数据流恢复正常 |

## 存储估算

### cache_entries（PG 缓存）

| 项目 | 估算 |
|-----|------|
| 缓存 key 数量 | 4 个 |
| 单条大小 | 1-5 MB |
| 保留时间 | 2 小时 |
| 总存储 | ~20 MB |

### 快照表

以当前 BTC 期权活跃合约约 **200-400 个**估算：

| 时间范围 | `market_snapshots` | `contract_snapshots` | 总计 |
|---------|-------------------|---------------------|------|
| 30 天 | ~3 MB (2,880 条) | ~2-4 GB (57-115 万条) | ~2-4 GB |
| 90 天 | ~9 MB (8,640 条) | ~6-12 GB (170-345 万条) | ~6-12 GB |

> 单条 `market_snapshots` ~1 KB，单条 `contract_snapshots` ~300-500 bytes。

## 依赖

- `@nestjs/schedule` — 定时任务
- 现有 `DeribitService` — API 调用（只写内存，不直接写 PG）
- 现有 `DatabaseModule` — PostgreSQL 连接池
- 现有 `PersistentCacheService` — PG 缓存读写

## 实施范围

### 修改

1. **`apps/api/src/deribit/deribit.service.ts`**
   - `fetchWithCache`：移除同步 PG 写入逻辑
   - 内存缓存 TTL：普通接口 15 分钟，`historicalVolatility` 15 分钟

2. **`apps/api/src/app.module.ts`**
   - 导入 `ScheduleModule`

### 新增

3. **`apps/api/src/snapshot/snapshot.module.ts`** — Snapshot 模块
4. **`apps/api/src/snapshot/snapshot.service.ts`** — 快照采集逻辑
5. **`apps/api/src/snapshot/snapshot-scheduler.service.ts`** — 定时任务
6. **`apps/api/src/snapshot/cache-sync.service.ts`** — 内存→PG 同步任务
7. 数据库 migration（创建两张快照表 + 索引）

### 前端

本次不涉及修改。

## 向后兼容

- 快照机制是纯新增功能，不影响现有 tRPC 路由和前端组件
- `PersistentCacheService` 的 `cache_entries` 表仍然保留，但改为由同步任务写入
- 即使定时任务全部失败，现有实时数据流不受影响（只是没有历史归档）

## 测试策略

1. **单元测试**：`SnapshotService.collectSnapshot()` 的指标计算逻辑
2. **集成测试**：验证内存→PG 同步任务正确写入/恢复
3. **集成测试**：验证快照任务从内存读取的数据和实时请求一致
4. **定时任务测试**：验证三个 `@Cron` 表达式正确

## 风险

| 风险 | 缓解措施 |
|-----|---------|
| 存储量超出预期 | 90 天清理 + 监控表大小 |
| 每 15 分钟大量写入拖慢 DB | 批量 `INSERT` + 异步执行，不阻塞请求 |
| 内存中数据丢失（服务崩溃） | PG 每 10 分钟同步一次，最坏丢 10 分钟缓存 |
| 快照时内存为空 | 跳过本次，下次请求会刷新内存 |
