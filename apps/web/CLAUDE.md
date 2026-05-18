# apps/web/CLAUDE.md

TanStack Start 前端应用，基于 Vite + React 19，使用文件路由和 SSR。

## App-level 命令

```bash
cd apps/web
pnpm dev              # Vite dev server + SSR（端口 5173）
pnpm build            # Client + SSR 构建到 dist/
pnpm preview          # 预览生产构建
pnpm test             # Vitest（jsdom）
pnpm typecheck        # tsc --noEmit
```

> **E2E 测试**：通过根目录 `pnpm test:e2e` 运行（Playwright 配置在 `apps/web/playwright.config.ts`）
```

## 架构决策

### TanStack Start + Vite

- 文件路由：`app/routes/` 下的文件自动生成路由树
- SSR 默认开启，流式渲染
- 路由树自动生成：`app/routeTree.gen.ts`

### UI Stack

- **组件库**：shadcn/ui v4（基于 Radix UI 基础组件）
- **样式**：Tailwind CSS v4（`@import "tailwindcss"` + `@theme` 语法）
- **图表**：Recharts（直接使用，不通过 Tremor 包装）
- **数据获取**：tRPC client + TanStack Query

### 文件结构

```
app/
├── routes/
│   ├── __root.tsx       # 根布局（暗色主题、全局 Provider）
│   └── index.tsx        # Dashboard 页面
├── components/
│   ├── ui/              # shadcn/ui 组件
│   ├── metrics/         # KPI 卡片
│   └── modules/         # 5 个 Dashboard 模块
├── hooks/               # tRPC 数据 hooks
├── lib/                 # utils、trpc client
├── router.tsx           # Router 工厂
├── routeTree.gen.ts     # 自动生成
└── globals.css          # Tailwind v4 主题变量
```
