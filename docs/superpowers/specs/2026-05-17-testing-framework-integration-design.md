# 测试框架集成设计方案

**日期**: 2026-05-17  
**范围**: 将 Vitest + React Testing Library + Playwright 完整融入 Kok 项目的 Claude Code 开发工作流  
**决策**: 采用分层命令方案（方案 B）

---

## 1. 设计目标

1. 补齐 Playwright E2E 测试基础设施
2. 建立清晰的命令分层（开发/提交前/CI）
3. 在 CLAUDE.md 中定义测试约定，使 Claude Code 的 TDD 技能有项目上下文支撑
4. 为 monorepo 提供统一的测试编排
5. 保持简洁，不引入过早抽象

---

## 2. 架构与目录结构

```
kok/
├── apps/
│   └── web/
│       ├── e2e/                    ← Playwright E2E 测试
│       │   └── *.spec.ts           ← E2E 测试文件
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── test/
│       │   │   └── setup.ts        ← Vitest 全局 setup
│       │   └── *.test.tsx          ← 组件/单元测试（与源码同目录）
│       ├── playwright.config.ts    ← Playwright 配置
│       ├── vitest.config.ts        ← Vitest 配置（扩展现有）
│       └── package.json            ← 测试脚本定义
├── packages/shared-types/
│   ├── src/
│   │   └── *.test.ts               ← 运行时逻辑单元测试
│   ├── vitest.config.ts            ← 新增
│   └── package.json                ← 测试脚本
├── package.json                    ← 根目录编排命令
└── CLAUDE.md                       ← 测试开发约定
```

### 设计原则

- **单元测试与源码同目录**：`Component.tsx` 旁放 `Component.test.tsx`，降低维护成本
- **E2E 测试独立目录**：`e2e/` 与 `src/` 平行，E2E 测的是构建产物而非源码
- **`shared-types` 只测运行时逻辑**：纯 TypeScript 接口/类型由编译器检查，不测

---

## 3. 命令分层

### `apps/web/package.json`

| 命令 | 用途 | 运行模式 |
|------|------|----------|
| `pnpm test` | 日常开发单元测试 | Vitest watch（热更新） |
| `pnpm test:run` | 提交前/CI 跑单元测试 | 单次运行，非交互 |
| `pnpm test:e2e` | 跑 E2E 测试 | Playwright headless |
| `pnpm test:e2e:ui` | 调试 E2E 测试 | Playwright UI 模式 |
| `pnpm test:e2e:headed` | 调试时看浏览器窗口 | 有界面浏览器 |

### `packages/shared-types/package.json`

| 命令 | 用途 |
|------|------|
| `pnpm test` | 跑单元测试（`vitest --run`） |

### 根目录 `package.json`

| 命令 | 行为 |
|------|------|
| `pnpm test` | 串行跑所有 workspace 的 `test`（shared-types → web unit → web e2e） |
| `pnpm test:web` | 只跑 web 的单元测试 |
| `pnpm test:e2e` | 只跑 web 的 E2E 测试 |

> `pnpm -r test` 按依赖拓扑顺序执行，确保 `shared-types` 先通过再跑 `web`。

---

## 4. 测试框架配置

### Vitest（`apps/web/vitest.config.ts`）

在现有配置基础上扩展：

- 添加 `@/` 路径别名（与 Vite 共享配置）
- 添加 V8 coverage 报告（text / json / html）
- 保持 `globals: true`（与现有测试兼容）
- 保持 `environment: 'jsdom'`

### Playwright（`apps/web/playwright.config.ts`）— 新增

关键配置项：

| 配置 | 值 | 理由 |
|------|-----|------|
| `testDir` | `./e2e` | E2E 测试目录 |
| `baseURL` | `http://localhost:5173` | 使用 `preview` 模式测试生产构建 |
| `webServer.command` | `pnpm preview` | 自动启动预览服务器 |
| `trace` | `on-first-retry` | 失败时记录 trace，供 AI 分析 |
| `workers` | CI 时 1，本地 undefined | CI 串行保稳定，本地并行提速 |
| `projects` | chromium, firefox, webkit | 跨浏览器覆盖 |

### Vitest（`packages/shared-types/vitest.config.ts`）— 新增

最小配置：`globals: true`，无 DOM 环境。

---

## 5. 测试基础设施

### 现有保留

- `apps/web/src/test/setup.ts`：导入 `@testing-library/jest-dom/vitest`

### 不引入（避免过早设计）

- ~~`renderWithProviders` 封装~~：当前无路由/状态管理，不需要
- ~~fixtures 目录~~：等有具体业务数据再建
- ~~Page Object Model~~：等 E2E 测试数量增加再引入

### 示例测试文件

**单元测试**：

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders hello message', () => {
    render(<App />)
    expect(screen.getByText('Hello Kok')).toBeInTheDocument()
  })
})
```

**E2E 测试**：

```typescript
import { test, expect } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Hello Kok')).toBeVisible()
})
```

---

## 6. CLAUDE.md 测试约定（新增章节）

```markdown
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
```

---

## 7. superpowers:TDD 技能的协同关系

superpowers 的 `test-driven-development` 技能提供**方法论约束**（Red-Green-Refactor、Iron Law、验证清单），本设计方案提供**工程化上下文**（框架选择、命令映射、目录约定）。两者关系：

| 层面 | TDD 技能 | 本设计方案 |
|------|----------|-----------|
| 什么时候写测试 | 功能/修复/重构前必须写 | — |
| 用什么写测试 | — | Vitest + React Testing Library + Playwright |
| 测试命令 | `npm test` | `pnpm test:run` / `pnpm test:e2e` |
| 测试目录 | — | `src/*.test.tsx` + `e2e/*.spec.ts` |
| 验证清单 | 提供 | 结合项目命令执行 |

TDD 技能会在每次实现功能时**自动触发**，本设计确保它运行时有正确的工具链和约定支撑。

---

## 8. 实现范围

### 本次实现

1. 安装 Playwright 到 `apps/web/`
2. 创建 `apps/web/playwright.config.ts`
3. 扩展 `apps/web/vitest.config.ts`（alias + coverage）
4. 创建 `packages/shared-types/vitest.config.ts`
5. 更新所有 `package.json` 的 scripts
6. 更新根目录 `package.json` 的 orchestration scripts
7. 更新 `CLAUDE.md` 添加 Testing Conventions 章节
8. 创建示例 E2E 测试 `apps/web/e2e/smoke.spec.ts`
9. 验证所有命令可执行

### 明确不实现（后续按需添加）

- Coverage 阈值（等团队约定）
- CI 工作流配置（等 CI 就绪）
- `renderWithProviders` 封装（等路由/状态管理引入）
- fixtures / Page Object Model（等测试数量增加）
- `shared-types` 的实际测试文件（等运行时逻辑代码写入）

---

## 9. 验证标准

- [ ] `cd apps/web && pnpm test` 启动 Vitest watch 模式
- [ ] `cd apps/web && pnpm test:run` 完成所有单元测试
- [ ] `cd apps/web && pnpm test:e2e` 启动预览服务器并跑完 E2E 测试
- [ ] `pnpm test:web` 只跑 web 单元测试
- [ ] `pnpm test:e2e` 只跑 web E2E 测试
- [ ] `pnpm test` 串行跑 shared-types + web unit + web e2e
- [ ] TypeScript 编译无错误
- [ ] CLAUDE.md 已更新并提交
