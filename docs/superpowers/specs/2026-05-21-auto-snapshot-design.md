---
name: auto-snapshot-design
description: 每15分钟自动快照BTC期权市场数据，结构化存储到PostgreSQL，支持历史回溯
metadata:
  type: project
---

# 自动市场快照机制设计

## 背景

当前系统通过 Deribit API 获取实时数据，使用两层缓存（内存 30s + PostgreSQL 10分钟）。但缓存语义是"覆盖旧值"，无法保留历史状态。用户在忙完几小时后无法回溯"刚才发生了什么"。

## 目标

每 15 分钟自动抓取一次完整市场数据，以结构化形式存入 PostgreSQL。保留最近 90 天，供用户事后回溯任意时间点的市场状态。

## 方案：完整快照（聚合指标 + 合约级数据）

### 表结构

#### 1. market_snapshots（市场快照）

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
| `btc_price` | `get_index_price('btc_usd')` | `index_price` 原值 |
| `total_oi_usd` | `get_book_summary_by_currency` | 所有合约 `open_interest * underlying_price` 之和 |
| `total_volume_24h_usd` | `get_book_summary_by_currency` | 所有合约 `volume_usd` 之和 |
| `atm_iv` | `get_book_summary_by_currency` | ±2% spot 范围内合约的 `mark_iv` 加权平均 |
| `pc_ratio` | `get_book_summary_by_currency` | Put OI USD / (Put OI USD + Call OI USD) |

#### 2. contract_snapshots（合约快照）

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
| `instrument_name` | `get_book_summary_by_currency` 返回的 `instrument_name` |
| `strike` / `expiry` / `option_type` | 从 `instrument_name` 解析 |
| `open_interest` | Deribit 返回的 `open_interest` |
| `open_interest_usd` | `open_interest * underlying_price * CONTRACT_MULTIPLIER` |
| `mark_iv` | Deribit 返回的 `mark_iv` |
| `bid_iv` / `ask_iv` | Deribit 返回的 `bid_iv` / `ask_iv` |
| `volume_24h` | Deribit 返回的 `volume_usd` |

### 数据流

```
+---------------------------------------------------------------------+
|  SnapshotCollectorService                                           |
|  1. 调用 getIndexPrice('btc_usd')                                    |
|  2. 调用 getBookSummaryByCurrency('BTC', 'option')                  |
|  3. 计算聚合指标（total_oi, total_volume, atm_iv, pc_ratio）        |
|  4. 先写 market_snapshots，拿到 snapshot_id                         |
|  5. 批量写入 contract_snapshots                                     |
+---------------------------------------------------------------------+
```

### 定时任务

使用 `@nestjs/schedule` 的 `@Cron`：

```ts
@Cron('*/15 * * * *') // 每15分钟
async collectSnapshot() {
  // ...
}
```

触发时间点：`:00`, `:15`, `:30`, `:45`。

### 错误处理

| 场景 | 行为 |
|-----|------|
| Deribit API 失败 | 跳过本次快照，记录 error log，下次 15 分钟后重试 |
| 部分合约数据缺失 | 写入已有数据，缺失字段留 NULL |
| PostgreSQL 写入失败 | 记录 error log，不中断服务 |
| 同一分钟已有快照 | `snapshot_at` 用 `date_trunc('minute', NOW())`，`UNIQUE` 约束防重 |

### 清理策略

保留最近 **90 天**，通过 `market_snapshots.id` 的外键级联删除关联的 `contract_snapshots`：

```sql
DELETE FROM market_snapshots WHERE snapshot_at < NOW() - INTERVAL '90 days';
```

清理频率：每天凌晨 3 点执行一次。

### 存储估算

以当前 BTC 期权活跃合约约 **200-400 个**估算：

| 时间范围 | `market_snapshots` | `contract_snapshots` | 总计 |
|---------|-------------------|---------------------|------|
| 30 天 | ~3 MB (2,880 条) | ~2-4 GB (57-115 万条) | ~2-4 GB |
| 90 天 | ~9 MB (8,640 条) | ~6-12 GB (170-345 万条) | ~6-12 GB |

> 单条 `market_snapshots` ~1 KB，单条 `contract_snapshots` ~300-500 bytes。

### 依赖

- `@nestjs/schedule` — 定时任务
- 现有 `DeribitService` — API 调用（复用缓存）
- 现有 `DatabaseModule` — PostgreSQL 连接池

### 实施范围

**新增：**
- `apps/api/src/snapshot/snapshot.module.ts`
- `apps/api/src/snapshot/snapshot.service.ts`
- `apps/api/src/snapshot/snapshot-scheduler.service.ts`
- 数据库 migration（创建两张表 + 索引）

**修改：**
- `apps/api/src/app.module.ts` — 导入 `SnapshotModule`

**前端：** 本次不涉及修改。

### 向后兼容

快照机制是**纯新增**功能，不影响现有缓存逻辑、tRPC 路由、前端组件。即使定时任务失败，现有实时数据流不受影响。

### 测试策略

1. **单元测试**：`SnapshotService.collectSnapshot()` 的指标计算逻辑
2. **集成测试**：验证写入的数据能通过 `snapshot_id` 正确 JOIN 查询
3. **定时任务测试**：验证 `@Cron` 表达式正确

### 风险

| 风险 | 缓解措施 |
|-----|---------|
| 存储量超出预期 | 90 天清理 + 监控表大小 |
| 每 15 分钟大量写入拖慢 DB | 批量 `INSERT` + 异步执行，不阻塞请求 |
| Deribit API 限流 | 复用现有缓存层，快照任务走缓存不额外调 API |
