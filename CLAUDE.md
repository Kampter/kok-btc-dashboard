# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kok is a full-stack TypeScript web application built as a pnpm monorepo. The frontend is a React application powered by TanStack Start (SSR-enabled, file-based routing). Backend packages live under `apps/` alongside the web client.

## Monorepo Structure

| Directory | Description |
|-----------|-------------|
| `apps/web/` | React 19 frontend (TanStack Start + Vite). Entry: `app/routes/__root.tsx` |
| `apps/api/` | NestJS backend. Entry: `src/main.ts` (port 3000) |
| `packages/shared-types/` | TypeScript API contracts + tRPC router shared across apps |

## Root-level Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all dev servers in parallel
pnpm build            # Build all packages/apps
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all TypeScript
```

## App-level Commands

```bash
# Web frontend (TanStack Start)
cd apps/web
pnpm dev              # Vite dev server with SSR (port 5173)
pnpm build            # Client + SSR build to dist/
pnpm preview          # Preview production build
pnpm test             # Vitest
pnpm typecheck        # tsc --noEmit

# API backend (NestJS)
cd apps/api
pnpm dev              # NestJS dev server with hot reload (port 3000)
pnpm build            # Compile to dist/
pnpm start            # Run compiled output
```

## Architecture Decisions

### Package Boundaries

`packages/shared-types/` is the source of truth for data contracts. Apps import from it using the workspace protocol (`"@kok/shared-types": "workspace:*"`). When adding new API endpoints or data models, define the types in `packages/shared-types/src/` first, then consume them in the apps.

### TypeScript Project References

Apps use composite project references (`tsconfig.json`) so that `tsc --build` can efficiently check the monorepo. If you add a new package that is imported by an app, wire it into `references` in the app's `tsconfig.json`.

### TanStack Start + Vite

The frontend uses TanStack Start with the Vite plugin (`@tanstack/react-start/plugin/vite`). It provides:
- File-based routing (`app/routes/`)
- SSR with streaming
- Automatic route tree generation (`app/routeTree.gen.ts`)

TanStack Start uses Vite as the underlying build tool. Do not confuse this with a plain Vite SPA — SSR is enabled by default.

### NestJS + tRPC Backend

The backend uses NestJS with a tRPC router exposed via `@trpc/server/adapters/express`. All Deribit API calls go through the backend with a 30-second in-memory cache (`@nestjs/cache-manager`).

### UI Stack

- **Components**: shadcn/ui v4 with Radix UI primitives
- **Styling**: Tailwind CSS v4 (uses `@import "tailwindcss"` and `@theme` syntax)
- **Charts**: Recharts (directly, not through Tremor)
- **Data fetching**: tRPC client + TanStack Query

### Frontend File Structure

```
apps/web/
├── app/
│   ├── routes/
│   │   ├── __root.tsx       # Root layout (dark theme, global providers)
│   │   └── index.tsx        # Dashboard page
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (card, tabs, etc.)
│   │   ├── metrics/         # KPI cards
│   │   └── modules/         # 5 dashboard modules
│   ├── hooks/               # tRPC data hooks
│   ├── lib/                 # utils, trpc client
│   ├── router.tsx           # Router factory
│   ├── routeTree.gen.ts     # Auto-generated route tree
│   └── globals.css          # Tailwind v4 theme variables
├── vite.config.ts           # Vite + TanStack Start plugin
├── index.html               # HTML entry
└── components.json          # shadcn/ui configuration
```

## GitHub Operations

All GitHub operations (creating pull requests, viewing issues, checking checks, etc.) must use the GitHub CLI (`gh`) by default instead of the Web API or web interface.

## Language Requirements

All documentation, comments, and user-facing text output must be written in Chinese (中文). Code identifiers, technical terms, and file paths remain in English, but all explanations, instructions, and prose should be in Chinese.

## Documentation Safety Rules

### Plan / Spec 文档必须立即提交

使用 superpowers 技能创建 `docs/superpowers/plans/` 或 `docs/superpowers/specs/` 文档后，**必须立即执行 `git add && git commit`**，然后才能继续下一步（如创建 worktree、切换分支）。

```bash
# 创建 plan 或 spec 后立即提交
git add docs/superpowers/
git commit -m "docs: add [feature] plan/spec"
```

**原因**：这些文档在 worktree 切换时极易丢失（worktree 切换不会自动携带未提交的更改），且 `.claude/` 和 `.superpowers/` 已在 `.gitignore` 中。

### Worktree 切换前检查

切换 worktree 前，运行以下脚本检查是否有未提交的 docs：

```bash
source .claude/hooks/pre-worktree-switch.sh
```

若检测到未提交的 `docs/superpowers/` 更改，脚本会阻止切换并提供处理选项（commit / stash / bypass）。

### Dangling Commit 恢复

若怀疑文档已丢失在 dangling commit 中：

```bash
# 扫描丢失的文档
./scripts/check-dangling-docs.sh

# 自动恢复到 docs/superpowers/recovered/
./scripts/check-dangling-docs.sh --recover
```
