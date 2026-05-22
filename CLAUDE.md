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
