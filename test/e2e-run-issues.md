# E2E 与单元测试运行问题总结

> 日期：2026-05-19
> 运行环境：macOS, PostgreSQL@17, Node.js

## 问题总览

运行 `pnpm test:run`（单元测试）和 `pnpm test:e2e`（Playwright E2E）时遇到 5 个问题，修复后全部测试通过：

- **单元测试**：19 个文件 128 个测试全部通过
- **E2E 测试**：42 个测试（chromium + firefox + webkit）全部通过

---

## 问题 1：E2E 测试脚本缺失

### 现象

```bash
$ pnpm test:e2e
> pnpm --filter @kok/web test:e2e
None of the selected packages has a "test:e2e" script
```

### 根因

`apps/web/package.json` 的 `scripts` 中缺少 `test:e2e` 定义。根目录的 `package.json` 中 `"test:e2e": "pnpm --filter @kok/web test:e2e"` 依赖子包的同名脚本，但子包未定义。

### 修复

在 `apps/web/package.json` 的 `scripts` 中添加：

```json
"test:e2e": "playwright test"
```

### Harness 改进

CI workflow 已添加 E2E 测试步骤（见下文），确保此问题在 CI 中被发现。

---

## 问题 2：shared-types 包未构建导致单元测试失败

### 现象

`pnpm test:run` 时 9 个测试文件失败，错误信息：

```
Error: Failed to resolve entry for package "@kok/shared-types".
       The package may have incorrect main/module/exports specified in its package.json.
```

以及：

```
Error: Failed to resolve import "@kok/shared-types/fixtures" from "..."
```

### 根因

`@kok/shared-types` 的 `package.json` 使用 `exports` 字段指向 `./dist/` 下的编译产物：

```json
"exports": {
  ".": { "import": "./dist/index.js", ... },
  "./fixtures": { "import": "./dist/fixtures/index.js", ... },
  ...
}
```

在干净的 worktree 环境中，`packages/shared-types/dist/` 目录不存在，Vitest 无法解析 workspace 包的入口点。

### 修复

运行构建命令生成 dist：

```bash
pnpm --filter @kok/shared-types build
```

根目录 `package.json` 已配置 `pretest` 钩子会自动执行此构建：

```json
"pretest": "pnpm --filter @kok/shared-types build"
```

> 注意：`pnpm test:run` 不会自动触发 `pretest`，需要手动构建或使用 `pnpm test`。

### Harness 改进

CI 中运行 `pnpm build` 在 `pnpm test:run` 之前，确保 dist 始终存在。

---

## 问题 3：API 启动缺少 DATABASE_URL

### 现象

启动 API dev server（`pnpm dev:api`）时 NestJS 抛出异常：

```
[ExceptionHandler] Error: DATABASE_URL environment variable is not set
    at InstanceWrapper.useFactory (src/database/database.module.ts:12:17)
```

### 根因

`apps/api/src/database/database.module.ts` 在 `useFactory` 中直接读取 `process.env.DATABASE_URL`，未设置时抛出错误：

```ts
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}
```

### 修复

1. 创建 PostgreSQL 数据库：

```bash
createdb kok_cache
```

2. 启动 API 时设置环境变量：

```bash
export DATABASE_URL="postgresql://localhost:5432/kok_cache"
export FRONTEND_URL="http://localhost:5173"
pnpm dev:api
```

### Harness 改进

Playwright 配置已修改为自动启动 API，并在 `env` 中注入 `DATABASE_URL` 和 `FRONTEND_URL`。E2E 测试不再需要手动启动 API。

---

## 问题 4：Playwright 测试因 TanStack Query 缓存超时

### 现象

E2E 测试 `Dashboard › switching tab updates visible content` 在 chromium 和 firefox 中失败：

```
TimeoutError: page.waitForResponse: Timeout 10000ms exceeded
```

### 根因

测试代码在点击 tab 后等待新的 `/trpc/` 网络请求：

```ts
await page.getByRole('button', { name: '波动率分析' }).click()
await page.waitForResponse((resp) => resp.url().includes('/trpc/'), { timeout: 10000 })
```

但前端使用 TanStack Query（tRPC 客户端），在初始页面加载时已经获取了所有 tab 的数据并缓存。切换 tab 只是切换 UI 显示，不会触发新的网络请求，因此 `waitForResponse` 永远等不到响应。

### 修复

移除 `waitForResponse` 调用，直接断言目标内容可见：

```ts
await page.getByRole('button', { name: '波动率分析' }).click()
// 数据已缓存，不依赖新请求，直接断言渲染结果
await expect(page.getByText('IV 期限结构').first()).toBeVisible({ timeout: 10000 })
```

### Harness 改进

CI 中运行 E2E 测试，确保此类测试逻辑错误在合并前被发现。

---

## 问题 5：API 编译找不到 `pg` 模块类型声明

### 现象

API 在 watch 模式（`nest start --watch`）编译时报错：

```
src/database/database.module.ts:2:22 - error TS2307: Cannot find module 'pg'
src/database/persistent-cache.service.ts:2:27 - error TS2307: Cannot find module 'pg'
src/database/database.module.ts:15:27 - error TS7006: Parameter 'err' implicitly has an 'any' type.
```

### 根因

1. `@types/pg` 只在根目录 `package.json` 的 `devDependencies` 中声明，不在 `apps/api/package.json` 中
2. `apps/api/tsconfig.json` 使用 `NodeNext` 模块解析策略，不会自动查找 workspace root 的 `@types`
3. `pool.on('error', (err) => { ... })` 中的 `err` 没有类型注解

### 修复

1. 在 `apps/api/package.json` 的 `devDependencies` 中添加：

```json
"@types/pg": "^8.20.0"
```

2. 在 `database.module.ts` 中给 `err` 添加类型注解：

```ts
pool.on('error', (err: Error) => {
  Logger.error(`Unexpected PostgreSQL pool error: ${err.message}`, err.stack, 'DatabaseModule')
})
```

### Harness 改进

CI workflow 已确保 `pnpm typecheck` 和 `pnpm build` 覆盖 API 包。`@types/pg` 声明为 API 包的直接依赖后，TypeScript 编译器能正确解析类型。

---

## Harness 改进汇总

以下改进确保上述问题不会在回归中出现：

### 1. Playwright 自动启动 API（`apps/web/playwright.config.ts`）

修改前：只启动前端 `pnpm preview`，不启动后端 API。E2E 测试需要手动启动 API。

修改后：使用 `webServer` 数组同时启动 API 和前端：

```ts
webServer: [
  {
    command: 'node dist/main.js',
    cwd: path.resolve(__dirname, '../api'),
    stdout: 'API server running on http://localhost:3000',
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/kok_cache',
      FRONTEND_URL: 'http://localhost:5173',
    },
    timeout: 120000,
  },
  {
    command: 'pnpm preview --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
]
```

### 2. CI 运行 E2E 测试（`.github/workflows/ci.yml`）

修改前：CI 只运行单元测试，不运行 E2E。E2E 脚本缺失、测试逻辑错误等问题在 CI 中不会暴露。

修改后：CI 添加 PostgreSQL 服务和 E2E 测试步骤：

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: kok_cache
    ports:
      - 5432:5432

steps:
  # ... install, build, typecheck, test:run, lint ...
  - name: Install Playwright (chromium only)
    run: cd apps/web && npx playwright install --with-deps chromium
  - name: E2E Tests
    run: cd apps/web && npx playwright test --project=chromium
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/kok_cache
      FRONTEND_URL: http://localhost:5173
```

### 3. API 包声明 `@types/pg`（`apps/api/package.json`）

确保 API 的 TypeScript 编译器能正确解析 `pg` 模块的类型声明，不依赖 workspace root 的间接依赖。

---

## 运行测试的正确步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 构建共享包（单元测试需要）
pnpm --filter @kok/shared-types build

# 3. 创建数据库并启动 API（E2E 需要）
createdb kok_cache  # 如尚未创建
export DATABASE_URL="postgresql://localhost:5432/kok_cache"
export FRONTEND_URL="http://localhost:5173"
pnpm dev:api        # 后台运行

# 4. 构建前端（E2E preview 需要）
pnpm build

# 5. 运行测试
pnpm test:run       # 单元测试
pnpm test:e2e       # E2E 测试
```

## 本地开发快捷方式

Playwright 已配置自动启动 API，因此本地运行 E2E 的最简步骤：

```bash
# 确保数据库存在
export DATABASE_URL="postgresql://localhost:5432/kok_cache"

# 构建前后端
pnpm build

# E2E 测试会自动启动 API 和前端
pnpm test:e2e
```
