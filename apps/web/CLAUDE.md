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
│   ├── chat/            # Agent Chat Panel（固定分栏）
│   ├── metrics/         # KPI 卡片
│   ├── modules/         # 7 个 Dashboard 详情模块
│   │   ├── overview/    # 7 个概览卡片
│   │   └── ...          # 详情组件
│   └── OverviewGrid.tsx # 概览网格容器
├── hooks/               # tRPC 数据 hooks
├── lib/                 # utils、trpc client、chart-theme
├── router.tsx           # Router 工厂
├── routeTree.gen.ts     # 自动生成
└── globals.css          # Tailwind v4 主题变量（暗色主题）
```

## 架构决策记录（ADR）

### ADR-WEB-001: TanStack Start + Vite

**决策**: 使用 TanStack Start（基于 Vite）作为前端框架，替代 Next.js。

**理由**:
- TanStack Start 提供更灵活的文件路由和 API 路由，适合 tRPC 集成
- Vite 构建速度显著快于 Next.js 的 Webpack
- SSR + 流式渲染支持，首屏性能优于纯 CSR

### ADR-WEB-002: shadcn/ui v4 + Tailwind CSS v4

**决策**: 使用 shadcn/ui v4（基于 Radix UI）作为基础组件库，Tailwind CSS v4 处理样式。

**理由**:
- shadcn/ui 组件代码直接存在于项目中，易于定制和扩展
- Tailwind v4 的 `@theme` 语法提供更清晰的 CSS 变量管理
- Radix UI 的无障碍支持完善

### ADR-WEB-003: Dashboard 布局演进（概览网格 + 详情抽屉）

**决策**: 从 Tab 切换布局重构为"概览网格 + 右侧详情抽屉"布局。

**演进**:
- v1: Tab 切换组织 5 个分析模块 —— 信息分散，无法一眼掌握全局
- v2: 概览网格（OverviewGrid）展示所有模块核心指标 + 点击展开 ModuleDrawer 详情

**理由**:
- 一屏概览所有模块核心指标
- 点击卡片展开详情，上下文不丢失
- 使用 CSS keyframe 动画实现过渡，不引入 Framer Motion

### ADR-WEB-004: Recharts 图表库

**决策**: 使用 Recharts 作为数据可视化库（直接使用，不通过 Tremor 包装）。

**理由**:
- Recharts 声明式 API 与 React 组件模型天然契合
- 暗色主题通过 `chart-theme.ts` 统一配置，避免每个图表硬编码颜色
- 金融数据可视化（K 线、IV 曲面、OI 分布）均有成熟实现

### ADR-WEB-005: Agent Chat Panel 固定分栏

**决策**: Dashboard 页面左侧固定 380px 分栏展示 AI 对话面板。

**架构**:
- `AgentChatPanel` — 对话面板主组件，管理消息列表和输入
- `ChatMessage` / `ChatInput` — 消息和输入子组件
- 后端通过 tRPC streaming mutation 返回流式响应

**理由**:
- 用户在浏览看板时可同时进行 AI 对话，无需切换页面
- 固定分栏保持对话上下文始终可见

## 视觉系统

色彩、字体、间距、动画等视觉规范，详见设计文档 `docs/superpowers/specs/2026-05-21-dashboard-modernization-design.md`。
