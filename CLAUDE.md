# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kok is a full-stack TypeScript web application built as a pnpm monorepo. The frontend is a React SPA served by Vite. Backend packages live under `apps/` alongside the web client.

## Monorepo Structure

| Directory | Description |
|-----------|-------------|
| `apps/web/` | React 19 frontend (Vite). Entry: `src/main.tsx` |
| `packages/shared-types/` | TypeScript API contracts shared across apps/packages |

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
# Web frontend
cd apps/web
pnpm dev              # Vite dev server (port 5173 by default)
pnpm build            # Production build to dist/
pnpm preview          # Preview production build
pnpm test             # Vitest
pnpm typecheck        # tsc --noEmit
```

## Architecture Decisions

### Package Boundaries

`packages/shared-types/` is the source of truth for data contracts. Apps import from it using the workspace protocol (`"@kok/shared-types": "workspace:*"`). When adding new API endpoints or data models, define the types in `packages/shared-types/src/` first, then consume them in the apps.

### TypeScript Project References

Apps use composite project references (`tsconfig.json` + `tsconfig.node.json`) so that `tsc --build` can efficiently check the monorepo. If you add a new package that is imported by an app, wire it into `references` in the app's `tsconfig.json`.

### Vite + React

The frontend uses Vite with `@vitejs/plugin-react` for fast HMR. There is no SSR; it is a client-side SPA. Static assets go in `apps/web/public/`.

## Language Requirements

All documentation, comments, and user-facing text output must be written in Chinese (中文). Code identifiers, technical terms, and file paths remain in English, but all explanations, instructions, and prose should be in Chinese.

## Testing Conventions

### Framework Stack

| Layer | Tool | Command |
|-------|------|---------|
| Unit/Integration | Vitest + React Testing Library | `pnpm test` (watch) / `pnpm test:run` (CI) |
| E2E | Playwright | `pnpm test:e2e` / `pnpm test:e2e:ui` |

### TDD Workflow

Follow Red-Green-Refactor strictly:
1. Write failing test first
2. Run `pnpm test:run` to verify it fails correctly
3. Write minimal code to pass
4. Run `pnpm test:run` to verify green
5. Refactor

### Test File Locations

- Unit tests: co-located with source (`Component.tsx` → `Component.test.tsx`)
- E2E tests: `apps/web/e2e/*.spec.ts`
- `packages/shared-types/`: unit tests for runtime logic only, not pure types

### E2E Testing

- Use `baseURL` from `playwright.config.ts` — just `page.goto('/')`, not full URL
- Prefer `getByRole`, `getByText` over CSS selectors
- One `test()` per user flow, use `test.describe()` to group related tests
