# 统一测试框架设计规格

## 目标

为 Kok（BTC 期权数据看板）全栈 monorepo 建立统一的 Vitest 测试框架，覆盖前端（`apps/web`）、后端（`apps/api`）和共享类型（`packages/shared-types`）。要求：

- **TDD 开发**：所有功能先写测试再写实现
- **共享 Fixtures**：Deribit API mock 数据前后端复用
- **边界值覆盖**：缓存、错误、空数据、API 降级
- **E2E 覆盖**：Tab 切换、响应式、控制台错误、快速交互稳定性

---

## 架构决策

### ADR-1：统一 Vitest Workspace

**决策**：根级 `vitest.workspace.ts` 调度 3 个项目，单条 `pnpm test:run` 跑完全部。

**理由**：
- 避免 `pnpm --filter` 链式调用的配置重复
- 共享 Vitest 进程，启动更快
- 统一 reporter 和覆盖率报告

**配置**：
```ts
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config'
export default defineWorkspace([
  'apps/web',
  'apps/api',
  'packages/shared-types',
])
```

### ADR-2：NestJS + unplugin-swc

**决策**：API 测试使用 `unplugin-swc` 编译 TypeScript 装饰器，而非 ts-node 或 ts-jest。

**理由**：
- NestJS 大量使用 `@Injectable`、`@Controller` 等装饰器
- `unplugin-swc` 利用 SWC 原生编译，比 ts-jest 快 10x+
- Vitest 原生支持 Vite 插件生态

### ADR-3：tRPC Caller 集成测试

**决策**：tRPC v11 通过 `trpcService.appRouter.createCaller({})` 创建 caller 进行集成测试，而非 HTTP 层。

**理由**：
- 绕过 HTTP 序列化，测试更接近业务逻辑
- 无需启动 NestJS 应用实例，速度更快
- 错误处理（TRPCError）可直接断言

### ADR-4：Fixtures 三层分层

**决策**：共享 fixtures 分为 raw → derived → factories 三层。

| 层级 | 格式 | 用途 | 示例 |
|------|------|------|------|
| `raw/` | Deribit API 原始格式 | 后端 mock axios 响应 | `volume`（非 `volume_24h`），时间戳毫秒 |
| `derived/` | Zod schema 验证后格式 | 前端组件 mock 数据 | `expiry` 为 ISO 字符串，`bid_iv`/`ask_iv` 为 0 |
| `factories.ts` | 工厂函数 | 生成变体数据 | `makeOptionSummary({ strike: 95000 })` |

**理由**：
- raw 层确保后端测试与真实 API 响应一致
- derived 层确保前端测试与 Zod schema 一致
- factories 层支持参数化测试（不同行权价、到期日）

---

## 测试策略

### 单元测试（Unit）

**范围**：单个函数/类，无外部依赖。

| 测试文件 | 被测对象 | 断言数 |
|----------|----------|--------|
| `apps/web/app/lib/utils.test.ts` | `cn()` 工具函数 | 13 |
| `packages/shared-types/src/schemas/option.test.ts` | Zod schema 边界值 | 9 |
| `packages/shared-types/src/schemas/trade.test.ts` | Trade schema 边界值 | 5 |
| `packages/shared-types/src/fixtures/consistency.test.ts` | Fixtures 通过 Zod 验证 | 3 |

**边界值覆盖**：
- `OptionSummarySchema`：空字符串 instrument_name、负数 strike、无效 option_type
- `MarketOverviewSchema`：负数 totalOI、非数字 btcPrice

### 集成测试（Integration）

**范围**：多个组件协作，mock 外部依赖。

#### API 层

| 测试文件 | 被测对象 | 核心场景 |
|----------|----------|----------|
| `apps/api/src/deribit/deribit.service.test.ts` | DeribitService HTTP 调用 | 参数传递、错误传播 |
| `apps/api/src/deribit/deribit.service.edge.test.ts` | DeribitService 缓存边界 | cache hit、stale fallback、429 降级、TTL 验证 |
| `apps/api/src/deribit/deribit.controller.test.ts` | DeribitController REST 端点 | GET 路由、服务调用 |
| `apps/api/src/trpc/trpc.service.test.ts` | tRPC router 集成 | marketOverview/bookSummary/trades/historicalVolatility + 错误处理 |

**缓存策略边界值**：

| 场景 | TTL | 测试 |
|------|-----|------|
| book_summary | 30s | `uses 30s TTL for book summary` |
| index_price | 30s | `uses 30s TTL for index price` |
| historical_volatility | 5min | `uses 5min TTL for historical volatility` |
| trades | 30s | `uses 30s TTL for trades` |

**429 降级**：
- API 返回 429 → 返回 stale cache（即使已过期）
- 无 stale cache → 抛出错误

#### 前端层

| 测试文件 | 被测对象 | 断言数 |
|----------|----------|--------|
| `apps/web/app/hooks/useDashboardData.test.ts` | tRPC hooks 参数传递 | 8 |
| `apps/web/app/components/DashboardLayout.test.tsx` | 布局组件 | 9 |
| `apps/web/app/components/ui/error-fallback.test.tsx` | ErrorFallback UI | 7 |
| `apps/web/app/components/modules/VolatilityAnalysis.test.tsx` | 波动率分析模块 | 8 |
| `apps/web/app/components/modules/PositionStructure.test.tsx` | 持仓结构模块 | 9 |
| `apps/web/app/components/modules/FundingSentiment.test.tsx` | 资金情绪模块 | 6 |
| `apps/web/app/components/modules/ExpiryAnalysis.test.tsx` | 到期分析模块 | 6 |

**Mock 策略**：
- 所有模块组件使用 `vi.mock('../../hooks/useDashboardData')` mock hooks
- hooks 测试使用 captured options 验证参数（currency、kind、count）

### E2E 测试（Playwright）

**范围**：完整用户流程，真实浏览器。

| 测试文件 | 场景 |
|----------|------|
| `apps/web/e2e/dashboard.spec.ts` | Tab 切换、响应式视口、控制台错误、快速交互 |

**响应式视口覆盖**：

| 视口 | 尺寸 | 验证 |
|------|------|------|
| Mobile | 375×667 | Tab 可见、标题可见 |
| Tablet | 768×1024 | OI 数据可见 |
| Desktop | 1920×1080 | OI 数据可见 |

**快速交互稳定性**：
- 10 次快速 Tab 切换后页面仍正常
- 所有 Tab 切换不产生控制台错误（排除 favicon）

---

## 错误处理策略

### 后端

| 场景 | 行为 | 测试 |
|------|------|------|
| API 网络错误 | stale cache fallback | `falls back to stale cache on API error` |
| API 返回 429 | stale cache fallback（优先级最高） | `returns stale cache on 429 rate limit` |
| 无 stale cache + API 失败 | 抛出原始错误 | `propagates error when both API and stale cache fail` |
| DeribitService 失败 | tRPC 抛出 TRPCError | `all procedures throw TRPCError on DeribitService failure` |
| 零 btcPrice | marketOverview 返回零值 | `marketOverview handles zero btcPrice` |

### 前端

| 场景 | 行为 | 测试 |
|------|------|------|
| tRPC 请求被拦截 | ErrorFallback 显示"加载失败" | `retry button appears on error` |
| 初始加载 | Skeleton 动画可见 | `shows loading skeleton on initial load` |

---

## CI 集成

### Pretest 构建

```json
// package.json (root)
"pretest": "pnpm --filter @kok/shared-types build"
```

确保 `shared-types` 先构建，供 `apps/api` 和 `apps/web` 使用。

### 测试命令

```bash
pnpm test:run      # 全部 105 个测试
pnpm test:e2e      # Playwright E2E
pnpm test:coverage # 覆盖率报告
```

### jsdom 尺寸模拟

```ts
// apps/web/app/test/setup.ts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock

Object.defineProperty(globalThis.Element.prototype, 'getBoundingClientRect', {
  value: () => ({ width: 800, height: 600, ... }),
})
```

消除 Recharts 在 jsdom 中的尺寸警告。

---

## 文件清单

### 新增文件（24 个）

```
vitest.workspace.ts
apps/api/vitest.config.ts
apps/web/app/test/setup.ts
apps/web/playwright.config.ts
apps/web/e2e/dashboard.spec.ts
apps/api/src/deribit/deribit.service.test.ts
apps/api/src/deribit/deribit.service.edge.test.ts
apps/api/src/deribit/deribit.controller.test.ts
apps/api/src/trpc/trpc.service.test.ts
apps/api/src/app.module.test.ts
apps/web/app/hooks/useDashboardData.test.ts
apps/web/app/lib/utils.test.ts
apps/web/app/components/DashboardLayout.test.tsx
apps/web/app/components/ui/error-fallback.test.tsx
apps/web/app/components/modules/VolatilityAnalysis.test.tsx
apps/web/app/components/modules/PositionStructure.test.tsx
apps/web/app/components/modules/FundingSentiment.test.tsx
apps/web/app/components/modules/ExpiryAnalysis.test.tsx
packages/shared-types/src/fixtures/raw/bookSummary.ts
packages/shared-types/src/fixtures/raw/indexPrice.ts
packages/shared-types/src/fixtures/raw/historicalVolatility.ts
packages/shared-types/src/fixtures/raw/trades.ts
packages/shared-types/src/fixtures/derived/optionSummary.ts
packages/shared-types/src/fixtures/derived/marketOverview.ts
packages/shared-types/src/fixtures/derived/expirySummary.ts
packages/shared-types/src/fixtures/derived/optionTrades.ts
packages/shared-types/src/fixtures/factories.ts
packages/shared-types/src/fixtures/index.ts
packages/shared-types/src/fixtures/consistency.test.ts
packages/shared-types/src/schemas/option.test.ts
packages/shared-types/src/schemas/trade.test.ts
```

### 修改文件（5 个）

```
package.json (root) — 添加 workspace、pretest 脚本
apps/api/package.json — 移除 jest，添加 vitest/unplugin-swc
apps/web/package.json — 添加 preview 端口
apps/web/vitest.config.ts — 添加 setup.ts 路径、排除 e2e
packages/shared-types/package.json — 添加 fixtures 导出
```

---

## 验收标准

- [x] `pnpm test:run` 在 12 秒内跑完 105 个测试，全部通过
- [x] `pnpm test:e2e` 覆盖 Tab 切换、响应式、控制台错误
- [x] Fixtures 前后端复用，raw/derived/factories 三层清晰
- [x] 缓存 TTL 验证（30s / 5min）
- [x] 429 降级 + stale cache fallback 覆盖
- [x] CI 自动构建 shared-types（pretest）
- [x] Recharts jsdom 警告消除
