# apps/api/CLAUDE.md

NestJS 后端应用，代理 Deribit API，暴露类型安全的 tRPC 路由。

## App-level 命令

```bash
cd apps/api
pnpm dev              # NestJS dev + 热重载（端口 3000）
pnpm build            # 编译到 dist/
pnpm start            # 运行编译输出
pnpm test             # Vitest（unplugin-swc）
pnpm test:run         # CI 模式
pnpm typecheck        # tsc --noEmit
```

## 架构决策

### NestJS + tRPC

- tRPC router 通过 `@trpc/server/adapters/express` 挂载到 `/trpc`
- 所有 Deribit API 调用经过缓存层
- CORS 白名单：`http://localhost:5173`（前端开发地址）

### 模块结构

```
src/
├── main.ts              # 应用入口
├── app.module.ts        # 根模块
├── trpc/
│   ├── trpc.module.ts   # tRPC 模块
│   └── trpc.service.ts  # tRPC router + resolver
├── deribit/
│   ├── deribit.module.ts    # Deribit 模块
│   ├── deribit.service.ts   # Deribit HTTP 客户端
│   └── deribit.controller.ts # REST 调试端点
├── chat/                # Agent Chat Panel（NestJS ChatModule）
│   ├── chat.module.ts
│   ├── chat.service.ts
│   ├── chat.router.ts
│   └── prompts/
├── greeks/              # Greeks 风险暴露模块
│   ├── greeks.module.ts
│   ├── greeks.service.ts
│   └── greeks-scheduler.service.ts
├── snapshot/            # 自动市场快照
│   ├── snapshot.module.ts
│   ├── snapshot.service.ts
│   ├── snapshot-scheduler.service.ts
│   └── cache-sync.service.ts
└── database/            # PostgreSQL 缓存层
    ├── database.module.ts
    └── persistent-cache.service.ts
```

## 架构决策记录（ADR）

### ADR-API-001: NestJS + tRPC

**决策**: 使用 NestJS 作为后端框架，tRPC 提供前后端类型安全的 API 契约。

**理由**:
- NestJS 的依赖注入和模块化架构适合构建可维护的后端服务
- tRPC 的端到端类型安全消除了 API 契约维护成本
- `@trpc/server/adapters/express` 适配器使 tRPC router 可直接挂载到 NestJS 的 Express 实例

### ADR-API-002: 统一内存源缓存架构

**决策**: 内存缓存是唯一真相源，PostgreSQL 仅作为服务重启时的恢复备份。

**演进**:
- v1: 仅内存缓存（30s TTL）— 服务重启后丢失
- v2: 内存 + PostgreSQL 同步双写 — `fetchWithCache` 中同时写入内存和 PG
- v3: 统一内存源 — API 返回后只写内存，PG 写入由独立的 `CacheSyncService` 每 10 分钟异步执行

**架构**:
```
Deribit API → DeribitService.fetchWithCache → 内存（L1，15min TTL）→ 返回数据
                                        ↓
CacheSyncService（每10分钟）→ PostgreSQL（L2，2h TTL）→ 服务重启恢复
```

**理由**:
- Dashboard 实时请求、PG 持久化备份、快照任务都从内存读取同一批数据，确保一致性
- 快照任务不额外调 API，直接从内存读取
- 减少 API 调用次数，避免配额浪费

### ADR-API-003: PostgreSQL 作为缓存备份（非主存储）

**决策**: PostgreSQL 仅用于缓存持久化和历史快照归档，不承载实时查询。

**表结构**:
- `cache_entries` — 缓存键值对（JSONB），用于服务重启后恢复内存
- `market_snapshots` — 市场快照（每 15 分钟）
- `contract_snapshots` — 合约级快照

**理由**:
- PG 不适合高频实时查询（内存缓存性能高 2-3 个数量级）
- PG 提供持久化和历史回溯能力

### ADR-API-004: 定时任务架构（@nestjs/schedule）

**决策**: 使用 `@nestjs/schedule` 管理定时任务。

**任务清单**:
| 任务 | Cron | 职责 |
|------|------|------|
| CacheSyncService.syncCacheToPersistentStorage | `*/10 * * * *` | 内存 → PG 同步 |
| SnapshotSchedulerService.collectSnapshot | `*/15 * * * *` | 市场快照采集 |
| SnapshotSchedulerService.cleanupOldSnapshots | `0 3 * * *` | 过期快照清理（90 天） |
| GreeksSchedulerService.computeExposure | `*/5 * * * *` | Greeks 渐进式计算 |

**理由**:
- NestJS 原生集成，无需引入额外调度框架
- Cron 表达式直观，易于调整频率

### ADR-API-005: Greeks 渐进式计算

**决策**: Greeks 风险暴露采用服务端渐进式分批计算，避免一次性调用大量 Deribit API。

**流程**:
1. `GreeksSchedulerService` 每 5 分钟触发 `GreeksService.computeExposure()`
2. `computeExposure()` 分批获取合约 Greeks（通过 `DeribitService.getInstruments` + `getTicker`）
3. 计算 Gamma Exposure (GEX)、Delta Exposure (DEX) 等指标
4. 结果缓存到内存，前端通过 tRPC `greeks.exposure` 获取

**理由**:
- Deribit `ticker` 接口逐个合约返回 Greeks，400+ 合约需分批调用
- 渐进式计算避免单次请求超时
- 5 分钟频率平衡实时性和 API 配额
