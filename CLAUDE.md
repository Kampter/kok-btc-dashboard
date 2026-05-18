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

## Language Requirements

All documentation, comments, and user-facing text output must be written in Chinese (中文). Code identifiers, technical terms, and file paths remain in English, but all explanations, instructions, and prose should be in Chinese.
