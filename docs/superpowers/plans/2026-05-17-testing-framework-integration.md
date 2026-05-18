# 测试框架集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Kok monorepo 中完整集成 Vitest + React Testing Library + Playwright 测试框架，建立分层命令体系和 CLAUDE.md 测试约定。

**Architecture:** 采用"命令分层"方案——apps/web 内部分为 watch/CI/E2E 三层命令，根目录提供 monorepo 统一编排。Playwright 配置自动启动 preview 服务器，E2E 测试使用生产构建产物。

**Tech Stack:** Vitest v2, React Testing Library v16, Playwright, @vitest/coverage-v8, pnpm workspaces

---

## 文件映射

| 文件 | 动作 | 职责 |
|------|------|------|
| `apps/web/package.json` | 修改 | 添加 E2E 测试脚本、Playwright 和 coverage 依赖 |
| `apps/web/playwright.config.ts` | 创建 | Playwright 配置：E2E 目录、baseURL、webServer、多浏览器 projects |
| `apps/web/vitest.config.ts` | 修改 | 添加 `@/` 路径别名、V8 coverage 报告配置 |
| `apps/web/e2e/smoke.spec.ts` | 创建 | 示例 E2E 测试：验证首页渲染 |
| `packages/shared-types/package.json` | 修改 | 添加 `test` 脚本、vitest 依赖 |
| `packages/shared-types/vitest.config.ts` | 创建 | 最小 Vitest 配置（globals: true） |
| `package.json` (根目录) | 修改 | 添加 `test:web`、`test:e2e` 编排脚本 |
| `CLAUDE.md` | 修改 | 新增 Testing Conventions 章节 |

---

### Task 1: 安装 apps/web 的测试依赖

**Files:**
- Modify: `apps/web/package.json`（pnpm 自动更新）

- [ ] **Step 1: 安装 Playwright 和 coverage 插件**

```bash
cd apps/web
pnpm add -D @playwright/test @vitest/coverage-v8
```

- [ ] **Step 2: 安装 Playwright 浏览器二进制文件**

```bash
cd apps/web
pnpm exec playwright install
```

Expected: 下载 Chromium、Firefox、WebKit 浏览器。输出包含 `Downloading Chromium...`、`Downloading Firefox...`、`Downloading WebKit...`。

- [ ] **Step 3: 验证安装**

```bash
cd apps/web
pnpm exec playwright --version
```

Expected: 输出版本号，如 `Version 1.52.0`

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
# 若存在 pnpm-workspace.yaml 变更也一并添加
git add -A
git commit -m "chore: install Playwright and Vitest coverage for apps/web"
```

---

### Task 2: 安装 shared-types 的 Vitest 依赖

**Files:**
- Modify: `packages/shared-types/package.json`（pnpm 自动更新）

- [ ] **Step 1: 安装 Vitest**

```bash
cd packages/shared-types
pnpm add -D vitest
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared-types/package.json packages/shared-types/pnpm-lock.yaml
git add -A
git commit -m "chore: install vitest for shared-types"
```

---

### Task 3: 创建 Playwright 配置

**Files:**
- Create: `apps/web/playwright.config.ts`

- [ ] **Step 1: 编写配置文件**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

> 说明：`webServer.command` 使用 `pnpm preview` 而非 `pnpm dev`，确保 E2E 测试运行在生产构建产物上。`reuseExistingServer` 在本地允许手动启动的服务复用。

- [ ] **Step 2: Commit**

```bash
git add apps/web/playwright.config.ts
git commit -m "config: add Playwright configuration for E2E testing"
```

---

### Task 4: 扩展 apps/web Vitest 配置

**Files:**
- Modify: `apps/web/vitest.config.ts`

当前内容：
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 1: 添加路径别名和 coverage 配置**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
})
```

> 说明：`@/` 别名当前未被代码使用，为未来组件引入预留。当项目开始使用 `@/` 导入时，需同步在 `vite.config.ts` 中添加相同 alias。

- [ ] **Step 2: Commit**

```bash
git add apps/web/vitest.config.ts
git commit -m "config: extend Vitest config with alias and coverage"
```

---

### Task 5: 创建 shared-types Vitest 配置

**Files:**
- Create: `packages/shared-types/vitest.config.ts`

- [ ] **Step 1: 编写最小配置**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

> 说明：无 DOM 环境，仅用于运行时逻辑函数（如类型守卫、验证 schema、工具函数）的单元测试。纯 TypeScript 接口/类型不测试。

- [ ] **Step 2: Commit**

```bash
git add packages/shared-types/vitest.config.ts
git commit -m "config: add Vitest config for shared-types"
```

---

### Task 6: 更新 apps/web/package.json 脚本

**Files:**
- Modify: `apps/web/package.json`

当前 scripts：
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 1: 添加 E2E 测试脚本**

将 `scripts` 修改为：
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest --run",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json
git commit -m "chore: add E2E test scripts to apps/web"
```

---

### Task 7: 更新 packages/shared-types/package.json 脚本

**Files:**
- Modify: `packages/shared-types/package.json`

当前 scripts：
```json
"scripts": {
  "build": "tsc",
  "dev": "tsc --watch",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 1: 添加 test 脚本**

将 `scripts` 修改为：
```json
"scripts": {
  "build": "tsc",
  "dev": "tsc --watch",
  "test": "vitest --run",
  "test:run": "vitest --run",
  "typecheck": "tsc --noEmit"
}
```

> 说明：`test:run` 与 `test` 当前相同，但为根目录统一编排预留。当 shared-types 有 watch 模式需求时，`test` 可改为 `vitest` 而不影响 CI。

- [ ] **Step 2: Commit**

```bash
git add packages/shared-types/package.json
git commit -m "chore: add test script to shared-types"
```

---

### Task 8: 更新根目录 package.json 编排脚本

**Files:**
- Modify: `package.json` (根目录)

当前 scripts：
```json
"scripts": {
  "build": "pnpm -r build",
  "dev": "pnpm -r --parallel dev",
  "test": "pnpm -r test",
  "lint": "pnpm -r lint",
  "typecheck": "pnpm -r typecheck"
}
```

- [ ] **Step 1: 添加分层编排脚本**

将 `scripts` 修改为：
```json
"scripts": {
  "build": "pnpm -r build",
  "dev": "pnpm -r --parallel dev",
  "test": "pnpm --filter @kok/shared-types test:run && pnpm --filter @kok/web test:run && pnpm test:e2e",
  "test:web": "pnpm --filter @kok/web test:run",
  "test:e2e": "pnpm --filter @kok/web test:e2e",
  "lint": "pnpm -r lint",
  "typecheck": "pnpm -r typecheck"
}
```

> 说明：`pnpm test` 串行执行三层：shared-types 单元测试 → web 单元测试 → web E2E 测试。`pnpm test:web` 只跑 web 单元测试。`pnpm test:e2e` 只跑 web E2E 测试。

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add test orchestration scripts at root"
```

---

### Task 9: 创建 E2E 测试目录和示例测试

**Files:**
- Create: `apps/web/e2e/smoke.spec.ts`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p apps/web/e2e
```

- [ ] **Step 2: 编写示例 E2E 测试**

```typescript
import { test, expect } from '@playwright/test'

test('homepage loads and displays hello message', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Hello Kok')).toBeVisible()
})
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/smoke.spec.ts
git commit -m "test: add Playwright smoke E2E test"
```

---

### Task 10: 更新 CLAUDE.md 添加测试约定

**Files:**
- Modify: `CLAUDE.md`

在文件末尾（Language Requirements 章节之后）新增 Testing Conventions 章节。

- [ ] **Step 1: 追加 Testing Conventions 章节**

在 `CLAUDE.md` 末尾添加：

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

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Testing Conventions to CLAUDE.md"
```

---

### Task 11: 验证所有命令

- [ ] **Step 1: 验证 TypeScript 编译无错误**

```bash
pnpm typecheck
```

Expected: 所有 workspace 通过 `tsc --noEmit`，无类型错误。

- [ ] **Step 2: 验证 apps/web 单元测试可运行**

```bash
cd apps/web
pnpm test:run
```

Expected: Vitest 以非交互模式运行，`App.test.tsx` 通过，输出类似：
```
✓ src/App.test.tsx (1)
   ✓ App > renders hello message

Test Files  1 passed (1)
```

- [ ] **Step 3: 验证 apps/web E2E 测试可运行**

```bash
cd apps/web
pnpm test:e2e
```

Expected: Playwright 自动启动 preview 服务器，在 Chromium/Firefox/WebKit 中运行 `smoke.spec.ts`，全部通过。输出包含：
```
Running 3 tests using 3 workers
  ✓  1 [chromium] › smoke.spec.ts:3:1 › homepage loads and displays hello message
  ✓  2 [firefox] › smoke.spec.ts:3:1 › homepage loads and displays hello message
  ✓  3 [webkit] › smoke.spec.ts:3:1 › homepage loads and displays hello message
3 passed
```

- [ ] **Step 4: 验证根目录分层命令**

```bash
# 只跑 web 单元测试
pnpm test:web
```

Expected: 仅 `@kok/web` 的单元测试运行，不触发 E2E。

```bash
# 只跑 web E2E 测试
pnpm test:e2e
```

Expected: 仅 `@kok/web` 的 E2E 测试运行。

- [ ] **Step 5: 验证根目录完整测试链路**

```bash
pnpm test
```

Expected: 串行执行三层：
1. `@kok/shared-types` 的 `vitest --run`（当前无测试文件，应快速通过）
2. `@kok/web` 的 `vitest --run`（单元测试通过）
3. `@kok/web` 的 `playwright test`（E2E 测试通过）

最终输出应显示所有测试通过。

- [ ] **Step 6: 验证 coverage 报告生成**

```bash
cd apps/web
pnpm exec vitest --run --coverage
```

Expected: 输出 coverage 表格（文本格式），并在 `apps/web/coverage/` 目录生成 HTML 报告。

- [ ] **Step 7: Final commit（如有验证中的修复）**

```bash
git add -A
git commit -m "test: verify testing framework integration"
```

---

## 自检清单

### Spec 覆盖度检查

| 设计方案章节 | 实现任务 | 状态 |
|-------------|---------|------|
| 安装 Playwright | Task 1 | ✅ |
| 安装 shared-types vitest | Task 2 | ✅ |
| Playwright 配置 | Task 3 | ✅ |
| Vitest 配置扩展（alias + coverage） | Task 4 | ✅ |
| shared-types Vitest 配置 | Task 5 | ✅ |
| apps/web package.json 脚本 | Task 6 | ✅ |
| shared-types package.json 脚本 | Task 7 | ✅ |
| 根目录 package.json 脚本 | Task 8 | ✅ |
| E2E 示例测试 | Task 9 | ✅ |
| CLAUDE.md 测试约定 | Task 10 | ✅ |
| 验证所有命令 | Task 11 | ✅ |

### 占位符扫描

- 无 "TBD"、"TODO"、"implement later"
- 无 "add appropriate error handling" 等模糊描述
- 所有代码步骤包含完整代码块
- 所有命令包含预期输出

### 类型一致性

- `vitest.config.ts` 统一使用 `defineConfig` from `vitest/config`
- Playwright 配置使用 `defineConfig` from `@playwright/test`
- `globals: true` 在两个 vitest 配置中一致
- `@playwright/test` 版本与安装的浏览器二进制文件匹配
