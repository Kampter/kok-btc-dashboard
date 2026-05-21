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

## 开发规范

所有开发任务遵循 superpowers 技能体系，详见 [docs/SKILLS.md](docs/SKILLS.md)。

## GitHub 操作

所有 GitHub 操作（创建 PR、查看 issue、检查 checks 等）默认使用 GitHub CLI (`gh`)。

## 语言要求

所有文档、注释、用户可见文本使用中文。代码标识符、技术术语、文件路径保持英文。

## 子目录文档

- [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) — 前端架构、UI Stack、文件结构
- [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) — 后端架构、NestJS 模块、API 设计
- [`packages/shared-types/CLAUDE.md`](packages/shared-types/CLAUDE.md) — 共享类型、包边界、Schema 规范
