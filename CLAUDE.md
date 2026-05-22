# CLAUDE.md

Kok 是一个全栈 TypeScript monorepo。前端使用 TanStack Start（SSR），后端使用 NestJS + tRPC。

## Monorepo 结构

| 目录 | 说明 |
|-----------|-------------|
| `apps/web/` | React 19 前端（TanStack Start + Vite） |
| `apps/api/` | NestJS 后端（tRPC + Deribit 代理） |
| `packages/shared-types/` | Zod schema + tRPC router 共享包 |

各目录的详细配置和架构决策，见对应子目录下的 `CLAUDE.md`。

## 根级命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 并行启动所有 dev server
pnpm build            # 构建所有包
pnpm test             # 运行所有测试（Vitest workspace）
pnpm test:run         # CI 模式运行测试
pnpm test:e2e         # Playwright E2E（通过 apps/web 运行）
pnpm lint             # 全量 lint
pnpm typecheck        # 全量类型检查
```

## 架构决策记录（ADR）

### ADR-001: Monorepo 结构（pnpm workspace）

**决策**: 使用 pnpm workspace + TypeScript Project References 组织三目录结构。

**包边界**:
- `packages/shared-types` — 前后端共享的 Zod Schema + tRPC router 类型定义
- `apps/web` — TanStack Start 前端（Vite + React 19 + SSR）
- `apps/api` — NestJS 后端（tRPC + Deribit 代理）

**理由**:
- shared-types 作为类型单一真相源，避免前后端类型漂移
- pnpm workspace 提供高效的包间链接和依赖去重
- Project References 使 `tsc --build` 能增量编译，CI 更快

### ADR-002: 前后端类型契约（tRPC + Zod）

**决策**: 前后端通过 tRPC 共享类型安全的 API 契约，Zod Schema 定义运行时验证。

**流程**: 添加新端点时，先在 `packages/shared-types` 定义 Zod Schema 和 router 类型 → 后端实现 resolver → 前端消费 hook。

**理由**:
- 端到端类型安全：修改 Schema 后，前后端同时获得编译错误
- 运行时验证防止 Deribit API 响应格式变化导致的数据污染


## 测试策略

基于风险分层，而非覆盖率导向。

### 核心原则

1. **测试行为，不测试实现** — 验证"输入 X 输出 Y"，而非"调用了哪个函数"
2. **风险导向** — 金融计算错误（Greeks、OI）最高优先级，展示层最低
3. **Mostly Integration** — 业务逻辑用集成测试，纯数学用单元测试
4. **删除比添加重要** — 低价值测试的维护成本拖累整个套件

### 风险分层

| 风险 | 模块 | 测试类型 | 示例 |
|------|------|----------|------|
| 高 | Greeks、OI Distribution、Volatility | 精确数值 Unit | total_gex=117000、resistance=81250 |
| 中 | Drawer、Chat、Dashboard 切换 | Integration / E2E | localStorage 持久化、流式响应、错误恢复 |
| 低 | 静态文本、shadcn 组件、样式 | Snapshot 或不测 | — |

### 反模式（禁止）

- 纯委托测试（Controller 转发参数、Scheduler 调用方法、AppModule 编译）
- 过度 Mock（mock 所有子组件只验证 testid、mock hook 只验证文本）
- 无数值断言（toBeDefined() 替代 toBe(80000)）
- 模板化重复（5 个模块组件测试结构完全相同）


## 开发规范

所有开发任务遵循 superpowers 技能体系，详见 [docs/SKILLS.md](docs/SKILLS.md)。

## GitHub 操作

所有 GitHub 操作（创建 PR、查看 issue、检查 checks 等）默认使用 GitHub CLI (`gh`)。

## 语言要求

所有文档、注释、用户可见文本使用中文。代码标识符、技术术语、文件路径保持英文。

## 子目录文档

各目录的详细架构决策通过以下方式获取：

- **Skills**（按需加载）：
  - `/web-frontend` — 前端架构、UI Stack、文件结构
  - `/api-backend` — 后端架构、NestJS 模块、API 设计
  - `/shared-types` — 共享类型、包边界、Schema 规范

- **子目录 `CLAUDE.md`**（自动加载）：
  - [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md)
  - [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md)
  - [`packages/shared-types/CLAUDE.md`](packages/shared-types/CLAUDE.md)
