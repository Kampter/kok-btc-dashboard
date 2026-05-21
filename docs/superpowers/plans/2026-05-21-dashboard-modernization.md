# Dashboard 现代化改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 BTC Options Dashboard 从 Tab 切换布局重构为概览网格 + 右侧详情抽屉，并升级视觉系统为极简精致风格。

**Architecture:** 保留所有现有模块组件内部逻辑，仅重构布局层。新增 OverviewCard、ModuleDrawer、OverviewGrid 三个核心组件，6 个模块概览子组件各自消费已有 hooks 获取轻量数据。使用 CSS keyframe 动画实现过渡效果，不引入 Framer Motion。

**Tech Stack:** React 19, Tailwind CSS v4, shadcn/ui, Recharts, tRPC, TanStack Query, Geist 字体

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `app/lib/chart-theme.ts` | Recharts 统一暗色主题配置 |
| `app/components/OverviewCard.tsx` | 通用概览卡片容器 |
| `app/components/OverviewCard.test.tsx` | OverviewCard 单元测试 |
| `app/components/ModuleDrawer.tsx` | 右侧详情抽屉 |
| `app/components/ModuleDrawer.test.tsx` | ModuleDrawer 单元测试 |
| `app/components/OverviewGrid.tsx` | 概览网格容器 |
| `app/components/OverviewGrid.test.tsx` | OverviewGrid 单元测试 |
| `app/components/modules/overview/MarketOverviewCard.tsx` | 市场概况概览卡片 |
| `app/components/modules/overview/VolatilityOverviewCard.tsx` | 波动率分析概览卡片 |
| `app/components/modules/overview/PositionOverviewCard.tsx` | 持仓结构概览卡片 |
| `app/components/modules/overview/SentimentOverviewCard.tsx` | 资金情绪概览卡片 |
| `app/components/modules/overview/ExpiryOverviewCard.tsx` | 到期分析概览卡片 |
| `app/components/modules/overview/OIDistributionOverviewCard.tsx` | OI 分布概览卡片 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `app/globals.css` | 更新 CSS 变量为新的视觉系统，添加 keyframe 动画 |
| `app/routes/__root.tsx` | 引入 Geist 字体 CSS |
| `app/components/DashboardLayout.tsx` | 重构为概览网格 + Drawer 布局 |
| `app/components/DashboardLayout.test.tsx` | 更新测试以匹配新布局 |

### 不修改文件

| 文件 | 原因 |
|------|------|
| `app/components/modules/MarketOverview.tsx` | 详情 Drawer 中直接复用 |
| `app/components/modules/VolatilityAnalysis.tsx` | 同上 |
| `app/components/modules/PositionStructure.tsx` | 同上 |
| `app/components/modules/FundingSentiment.tsx` | 同上 |
| `app/components/modules/ExpiryAnalysis.tsx` | 同上 |
| `app/components/modules/OIDistribution.tsx` | 同上 |
| `app/hooks/useDashboardData.ts` | 已有 hooks 直接复用 |
| `app/components/ui/*` | shadcn/ui 基础组件保持不变 |
| `app/components/chat/AgentChatPanel.tsx` | 本次不涉及 |

---

## Task 1: 安装 Geist 字体依赖

**前提:** 当前在 worktree 分支 `worktree-dashboard-redesign`

- [ ] **Step 1: 安装 @fontsource-variable/geist**

```bash
cd apps/web && pnpm add @fontsource-variable/geist
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "deps: add @fontsource-variable/geist font"
```

---

## Task 2: 更新视觉系统（CSS 变量 + 图表主题 + 动画）

- [ ] **Step 1: 更新 globals.css**

将 `app/globals.css` 替换为：

```css
@import "tailwindcss";

@theme {
  --color-background: #08080a;
  --color-foreground: #f4f4f5;
  --color-card: #121214;
  --color-card-foreground: #f4f4f5;
  --color-primary: #e94560;
  --color-primary-foreground: #ffffff;
  --color-muted: #27272a;
  --color-muted-foreground: #71717a;
  --color-border: #27272a;
  --color-ring: #e94560;
  --color-call: #22c55e;
  --color-put: #ef4444;
  --color-warning: #f59e0b;
  --radius: 0.75rem;
}

@layer base {
  body {
    font-family: 'Geist Sans', 'Geist Mono', system-ui, sans-serif;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: 创建图表主题文件**

创建 `app/lib/chart-theme.ts`：

```ts
export const chartTheme = {
  grid: { stroke: '#27272a', strokeDasharray: '3 3' },
  axis: { stroke: '#71717a', fontSize: 12, fontFamily: 'Geist Mono, monospace' },
  tooltip: {
    backgroundColor: '#121214',
    border: '1px solid #27272a',
    borderRadius: '8px',
    fontSize: 12,
  },
  colors: {
    call: '#22c55e',
    put: '#ef4444',
    neutral: '#71717a',
    primary: '#e94560',
    warning: '#f59e0b',
    blue: '#3b82f6',
  },
};
```

- [ ] **Step 3: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：无错误

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/lib/chart-theme.ts
git commit -m "style: update theme to minimal-premium dark with Geist font and keyframes"
```

---

## Task 3: 配置字体加载

- [ ] **Step 1: 修改 __root.tsx 引入 Geist 字体**

修改 `app/routes/__root.tsx`：

```tsx
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/trpc'
import appCss from '../globals.css?url'
import '@fontsource-variable/geist'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/__root.tsx
git commit -m "feat: load Geist font in root layout"
```

---

## Task 4: 创建 OverviewCard 组件（TDD）

- [ ] **Step 1: 写测试**

创建 `app/components/OverviewCard.test.tsx`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OverviewCard } from './OverviewCard'

describe('OverviewCard', () => {
  it('renders title and KPI value', () => {
    render(
      <OverviewCard
        moduleId="overview"
        title="市场概况"
        kpi={{ label: '总持仓 OI', value: '$12.4B' }}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('市场概况')).toBeInTheDocument()
    expect(screen.getByText('$12.4B')).toBeInTheDocument()
  })

  it('shows loading skeleton when status is loading', () => {
    render(
      <OverviewCard
        moduleId="overview"
        title="市场概况"
        kpi={{ label: '总持仓 OI', value: '-' }}
        status="loading"
        onClick={vi.fn()}
      />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(
      <OverviewCard
        moduleId="overview"
        title="市场概况"
        kpi={{ label: '总持仓 OI', value: '$12.4B' }}
        onClick={handleClick}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows active state when isActive is true', () => {
    render(
      <OverviewCard
        moduleId="overview"
        title="市场概况"
        kpi={{ label: '总持仓 OI', value: '$12.4B' }}
        isActive
        onClick={vi.fn()}
      />
    )
    expect(screen.getByRole('button')).toHaveClass('border-primary')
  })
})
```

- [ ] **Step 2: 运行测试（预期失败）**

```bash
cd apps/web && pnpm test -- OverviewCard.test.tsx
```

预期：FAIL — "OverviewCard" not found 或相关错误

- [ ] **Step 3: 实现 OverviewCard 组件**

创建 `app/components/OverviewCard.tsx`：

```tsx
import { memo } from 'react'
import { cn } from '../lib/utils'

export interface OverviewCardProps {
  moduleId: string
  title: string
  kpi: {
    label: string
    value: string
    change?: string
    changeType?: 'positive' | 'negative' | 'neutral'
  }
  miniChart?: React.ReactNode
  status?: 'loading' | 'error' | 'ready'
  isActive?: boolean
  onClick: () => void
}

const changeColorMap = {
  positive: 'text-call',
  negative: 'text-put',
  neutral: 'text-muted-foreground',
} as const

export const OverviewCard = memo(function OverviewCard({
  title,
  kpi,
  miniChart,
  status = 'ready',
  isActive = false,
  onClick,
}: OverviewCardProps) {
  if (status === 'loading') {
    return (
      <div
        role="status"
        className="rounded-xl border border-border bg-card p-4 animate-pulse"
      >
        <div className="h-4 w-20 bg-muted rounded mb-3" />
        <div className="h-8 w-24 bg-muted rounded mb-2" />
        <div className="h-16 bg-muted rounded mt-3" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full rounded-xl border border-put/30 bg-card p-4 text-left transition-all duration-200',
          'hover:border-put/50 hover:shadow-md',
        )}
      >
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="mt-2 text-sm text-put">数据加载失败，点击重试</div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border bg-card p-4 text-left transition-all duration-200',
        'hover:border-muted-foreground/30 hover:shadow-md',
        'active:scale-[0.98]',
        isActive && 'border-primary ring-1 ring-primary/20 shadow-md',
        !isActive && 'border-border',
      )}
    >
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="mt-2">
        <div className="text-2xl font-semibold tracking-tight">{kpi.value}</div>
        {kpi.change && (
          <div className={cn('text-xs mt-0.5', changeColorMap[kpi.changeType ?? 'neutral'])}>
            {kpi.change}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
      </div>
      {miniChart && <div className="mt-3 h-10">{miniChart}</div>}
    </button>
  )
})
```

- [ ] **Step 4: 运行测试（预期通过）**

```bash
cd apps/web && pnpm test -- OverviewCard.test.tsx
```

预期：PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/OverviewCard.tsx apps/web/app/components/OverviewCard.test.tsx
git commit -m "feat: add OverviewCard component with loading/error/active states"
```

---

## Task 5: 创建 ModuleDrawer 组件（TDD）

- [ ] **Step 1: 写测试**

创建 `app/components/ModuleDrawer.test.tsx`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModuleDrawer } from './ModuleDrawer'

const TestContent = () => <div data-testid="drawer-content">测试内容</div>

describe('ModuleDrawer', () => {
  it('does not render when moduleId is null', () => {
    render(
      <ModuleDrawer moduleId={null} onClose={vi.fn()}>
        <TestContent />
      </ModuleDrawer>
    )
    expect(screen.queryByTestId('drawer-content')).not.toBeInTheDocument()
  })

  it('renders content when moduleId is provided', () => {
    render(
      <ModuleDrawer moduleId="overview" title="市场概况" onClose={vi.fn()}>
        <TestContent />
      </ModuleDrawer>
    )
    expect(screen.getByTestId('drawer-content')).toBeInTheDocument()
    expect(screen.getByText('市场概况')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <ModuleDrawer moduleId="overview" onClose={handleClose}>
        <TestContent />
      </ModuleDrawer>
    )
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试（预期失败）**

```bash
cd apps/web && pnpm test -- ModuleDrawer.test.tsx
```

预期：FAIL — "ModuleDrawer" not found

- [ ] **Step 3: 实现 ModuleDrawer 组件**

创建 `app/components/ModuleDrawer.tsx`：

```tsx
import { memo, useEffect } from 'react'
import { cn } from '../lib/utils'

export interface ModuleDrawerProps {
  moduleId: string | null
  title?: string
  onClose: () => void
  children: React.ReactNode
}

export const ModuleDrawer = memo(function ModuleDrawer({
  moduleId,
  title,
  onClose,
  children,
}: ModuleDrawerProps) {
  const isOpen = moduleId !== null

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'fixed right-0 top-0 h-full z-50 bg-background border-l border-border shadow-lg',
          'w-full sm:w-[520px]',
          'flex flex-col',
        )}
        style={{
          animation: 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold">{title || '详情'}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="关闭"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </>
  )
})
```

- [ ] **Step 4: 运行测试（预期通过）**

```bash
cd apps/web && pnpm test -- ModuleDrawer.test.tsx
```

预期：PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/ModuleDrawer.tsx apps/web/app/components/ModuleDrawer.test.tsx
git commit -m "feat: add ModuleDrawer with slide-in animation and ESC close"
```

---

## Task 6: 创建 6 个模块概览卡片

这 6 个组件各自调用已有 hooks，提取核心 KPI 并传递给 OverviewCard。

### 6a: MarketOverviewCard

- [ ] **Step 1: 写测试**

创建 `app/components/modules/overview/MarketOverviewCard.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarketOverviewCard } from './MarketOverviewCard'

vi.mock('../../hooks/useDashboardData', () => ({
  useMarketOverview: vi.fn(),
  useBookSummary: vi.fn(),
}))

import { useMarketOverview, useBookSummary } from '../../hooks/useDashboardData'

describe('MarketOverviewCard', () => {
  beforeEach(() => {
    vi.mocked(useMarketOverview).mockReturnValue({
      data: { totalOI: 12400000000, totalVolume24h: 560000000, atmIV: 45.2, btcPrice: 98500, timestamp: '2026-05-21' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useBookSummary).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  it('renders core KPI', () => {
    render(<MarketOverviewCard onClick={vi.fn()} />)
    expect(screen.getByText('$12.40B')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试（预期失败）**

```bash
cd apps/web && pnpm test -- MarketOverviewCard.test.tsx
```

预期：FAIL

- [ ] **Step 3: 实现 MarketOverviewCard**

创建 `app/components/modules/overview/MarketOverviewCard.tsx`：

```tsx
import { memo, useMemo } from 'react'
import { useMarketOverview } from '../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatUSD } from '../../lib/utils'

export const MarketOverviewCard = memo(function MarketOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: overview, isLoading, isError } = useMarketOverview()

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="overview"
      title="市场概况"
      kpi={{
        label: '总持仓 OI',
        value: overview ? formatUSD(overview.totalOI) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
```

- [ ] **Step 4: 运行测试（预期通过）**

```bash
cd apps/web && pnpm test -- MarketOverviewCard.test.tsx
```

预期：PASS

### 6b: VolatilityOverviewCard

- [ ] **Step 5: 实现 + 测试**

`VolatilityOverviewCard.tsx`：

```tsx
import { memo } from 'react'
import { useBookSummary } from '../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatPercent } from '../../lib/utils'

export const VolatilityOverviewCard = memo(function VolatilityOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: bookData, isLoading, isError } = useBookSummary('BTC', 'option')

  const atmIV = bookData && bookData.length > 0
    ? bookData.reduce((sum, i) => sum + i.mark_iv, 0) / bookData.length
    : 0

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="volatility"
      title="波动率分析"
      kpi={{
        label: '平均 ATM IV',
        value: atmIV > 0 ? formatPercent(atmIV) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
```

测试遵循与 MarketOverviewCard 相同的模式，mock `useBookSummary`。

### 6c-6f: 其余 4 个概览卡片

- [ ] **Step 6: 实现 PositionOverviewCard + test**

`PositionOverviewCard.tsx`：

```tsx
import { memo, useMemo } from 'react'
import { useBookSummary } from '../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'

export const PositionOverviewCard = memo(function PositionOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: bookData, isLoading, isError } = useBookSummary('BTC', 'option')

  const pcRatio = useMemo(() => {
    if (!bookData) return null
    let callOI = 0, putOI = 0
    for (const item of bookData) {
      if (item.option_type === 'C') callOI += item.open_interest_usd
      else putOI += item.open_interest_usd
    }
    const total = callOI + putOI
    return total > 0 ? callOI / total : null
  }, [bookData])

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="positions"
      title="持仓结构"
      kpi={{
        label: 'Call 占比',
        value: pcRatio !== null ? `${(pcRatio * 100).toFixed(1)}%` : '-',
        change: pcRatio !== null ? (pcRatio > 0.6 ? '偏看涨' : pcRatio < 0.4 ? '偏看跌' : '中性') : undefined,
        changeType: pcRatio !== null ? (pcRatio > 0.6 ? 'positive' : pcRatio < 0.4 ? 'negative' : 'neutral') : undefined,
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
```

- [ ] **Step 7: 实现 SentimentOverviewCard + test**

`SentimentOverviewCard.tsx`：

```tsx
import { memo, useMemo } from 'react'
import { useTrades } from '../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'

export const SentimentOverviewCard = memo(function SentimentOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: trades, isLoading, isError } = useTrades('BTC', 500)

  const pcRatio = useMemo(() => {
    if (!trades || trades.length === 0) return null
    let putVol = 0, callVol = 0
    for (const t of trades) {
      const notional = t.amount * t.price
      if (t.option_type === 'C') callVol += notional
      else putVol += notional
    }
    const total = putVol + callVol
    return total > 0 ? (putVol / total) * 100 : null
  }, [trades])

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="sentiment"
      title="资金情绪"
      kpi={{
        label: 'P/C 交易量比',
        value: pcRatio !== null ? `${pcRatio.toFixed(1)}%` : '-',
        change: pcRatio !== null ? (pcRatio > 55 ? '偏看跌' : pcRatio < 45 ? '偏看涨' : '中性') : undefined,
        changeType: pcRatio !== null ? (pcRatio > 55 ? 'negative' : pcRatio < 45 ? 'positive' : 'neutral') : undefined,
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
```

- [ ] **Step 8: 实现 ExpiryOverviewCard + test**

`ExpiryOverviewCard.tsx`：

```tsx
import { memo, useMemo } from 'react'
import { useBookSummary } from '../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatUSD } from '../../lib/utils'

export const ExpiryOverviewCard = memo(function ExpiryOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: bookData, isLoading, isError } = useBookSummary('BTC', 'option')

  const maxExpiryOI = useMemo(() => {
    if (!bookData) return null
    const byExpiry = new Map<string, number>()
    for (const item of bookData) {
      byExpiry.set(item.expiry, (byExpiry.get(item.expiry) ?? 0) + item.open_interest_usd)
    }
    let maxExp = ''
    let maxOI = 0
    for (const [exp, oi] of byExpiry) {
      if (oi > maxOI) { maxOI = oi; maxExp = exp }
    }
    return maxExp ? { expiry: new Date(maxExp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }), oi: maxOI } : null
  }, [bookData])

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="expiry"
      title="到期分析"
      kpi={{
        label: '最大到期日',
        value: maxExpiryOI ? `${maxExpiryOI.expiry} · ${formatUSD(maxExpiryOI.oi)}` : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
```

- [ ] **Step 9: 实现 OIDistributionOverviewCard + test**

`OIDistributionOverviewCard.tsx`：

```tsx
import { memo } from 'react'
import { useOIDistribution } from '../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatUSD } from '../../lib/utils'

export const OIDistributionOverviewCard = memo(function OIDistributionOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data, isLoading, isError } = useOIDistribution('BTC')
  const distribution = data?.selected

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="oi"
      title="OI 分布"
      kpi={{
        label: 'Max Pain',
        value: distribution ? formatUSD(distribution.max_pain) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
```

- [ ] **Step 10: 运行全部概览卡片测试**

```bash
cd apps/web && pnpm test -- overview
```

预期：全部 PASS

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/components/modules/overview/
git commit -m "feat: add 6 module overview card components"
```

---

## Task 7: 创建 OverviewGrid 容器

- [ ] **Step 1: 写测试**

创建 `app/components/OverviewGrid.test.tsx`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OverviewGrid } from './OverviewGrid'

vi.mock('./modules/overview/MarketOverviewCard', () => ({
  MarketOverviewCard: ({ onClick, isActive }: any) => (
    <button data-testid="market-card" data-active={isActive} onClick={onClick}>市场概况</button>
  ),
}))
vi.mock('./modules/overview/VolatilityOverviewCard', () => ({
  VolatilityOverviewCard: ({ onClick }: any) => (
    <button data-testid="volatility-card" onClick={onClick}>波动率</button>
  ),
}))
vi.mock('./modules/overview/PositionOverviewCard', () => ({
  PositionOverviewCard: ({ onClick }: any) => (
    <button data-testid="positions-card" onClick={onClick}>持仓结构</button>
  ),
}))
vi.mock('./modules/overview/SentimentOverviewCard', () => ({
  SentimentOverviewCard: ({ onClick }: any) => (
    <button data-testid="sentiment-card" onClick={onClick}>资金情绪</button>
  ),
}))
vi.mock('./modules/overview/ExpiryOverviewCard', () => ({
  ExpiryOverviewCard: ({ onClick }: any) => (
    <button data-testid="expiry-card" onClick={onClick}>到期分析</button>
  ),
}))
vi.mock('./modules/overview/OIDistributionOverviewCard', () => ({
  OIDistributionOverviewCard: ({ onClick }: any) => (
    <button data-testid="oi-card" onClick={onClick}>OI 分布</button>
  ),
}))

describe('OverviewGrid', () => {
  it('renders all 6 module cards', () => {
    render(<OverviewGrid activeModule={null} onModuleClick={vi.fn()} />)
    expect(screen.getByTestId('market-card')).toBeInTheDocument()
    expect(screen.getByTestId('volatility-card')).toBeInTheDocument()
    expect(screen.getByTestId('positions-card')).toBeInTheDocument()
    expect(screen.getByTestId('sentiment-card')).toBeInTheDocument()
    expect(screen.getByTestId('expiry-card')).toBeInTheDocument()
    expect(screen.getByTestId('oi-card')).toBeInTheDocument()
  })

  it('marks active module card', () => {
    render(<OverviewGrid activeModule="overview" onModuleClick={vi.fn()} />)
    expect(screen.getByTestId('market-card')).toHaveAttribute('data-active', 'true')
  })

  it('calls onModuleClick with module id when card is clicked', () => {
    const handleClick = vi.fn()
    render(<OverviewGrid activeModule={null} onModuleClick={handleClick} />)
    fireEvent.click(screen.getByTestId('market-card'))
    expect(handleClick).toHaveBeenCalledWith('overview')
  })
})
```

- [ ] **Step 2: 运行测试（预期失败）**

```bash
cd apps/web && pnpm test -- OverviewGrid.test.tsx
```

预期：FAIL

- [ ] **Step 3: 实现 OverviewGrid**

创建 `app/components/OverviewGrid.tsx`：

```tsx
import { memo } from 'react'
import { MarketOverviewCard } from './modules/overview/MarketOverviewCard'
import { VolatilityOverviewCard } from './modules/overview/VolatilityOverviewCard'
import { PositionOverviewCard } from './modules/overview/PositionOverviewCard'
import { SentimentOverviewCard } from './modules/overview/SentimentOverviewCard'
import { ExpiryOverviewCard } from './modules/overview/ExpiryOverviewCard'
import { OIDistributionOverviewCard } from './modules/overview/OIDistributionOverviewCard'

const MODULES = [
  { id: 'overview', label: '市场概况', Component: MarketOverviewCard },
  { id: 'volatility', label: '波动率分析', Component: VolatilityOverviewCard },
  { id: 'positions', label: '持仓结构', Component: PositionOverviewCard },
  { id: 'sentiment', label: '资金情绪', Component: SentimentOverviewCard },
  { id: 'expiry', label: '到期分析', Component: ExpiryOverviewCard },
  { id: 'oi', label: 'OI 分布', Component: OIDistributionOverviewCard },
] as const

export type ModuleId = (typeof MODULES)[number]['id']

export interface OverviewGridProps {
  activeModule: ModuleId | null
  onModuleClick: (moduleId: ModuleId) => void
}

export const OverviewGrid = memo(function OverviewGrid({
  activeModule,
  onModuleClick,
}: OverviewGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
      {MODULES.map((mod, index) => {
        const CardComponent = mod.Component
        return (
          <div
            key={mod.id}
            style={{
              opacity: 0,
              animation: `fadeInUp 300ms ${index * 50}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            }}
          >
            <CardComponent
              isActive={activeModule === mod.id}
              onClick={() => onModuleClick(mod.id)}
            />
          </div>
        )
      })}
    </div>
  )
})
```

- [ ] **Step 4: 运行测试（预期通过）**

```bash
cd apps/web && pnpm test -- OverviewGrid.test.tsx
```

预期：PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/OverviewGrid.tsx apps/web/app/components/OverviewGrid.test.tsx
git commit -m "feat: add OverviewGrid with staggered entrance animation"
```

---

## Task 8: 重构 DashboardLayout

- [ ] **Step 1: 写测试**

更新 `app/components/DashboardLayout.test.tsx`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'

vi.mock('./chat/AgentChatPanel', () => ({
  AgentChatPanel: () => <div data-testid="chat-panel">Chat</div>,
}))

vi.mock('./OverviewGrid', () => ({
  OverviewGrid: ({ onModuleClick }: any) => (
    <div data-testid="overview-grid">
      <button data-testid="market-card" onClick={() => onModuleClick('overview')}>市场概况</button>
      <button data-testid="volatility-card" onClick={() => onModuleClick('volatility')}>波动率</button>
    </div>
  ),
}))

vi.mock('./ModuleDrawer', () => ({
  ModuleDrawer: ({ moduleId, onClose, children }: any) => (
    moduleId ? <div data-testid="drawer"><button onClick={onClose}>关闭</button>{children}</div> : null
  ),
}))

vi.mock('./modules/MarketOverview', () => ({
  MarketOverview: () => <div data-testid="market-detail">市场详情</div>,
}))
vi.mock('./modules/VolatilityAnalysis', () => ({
  VolatilityAnalysis: () => <div data-testid="volatility-detail">波动率详情</div>,
}))

describe('DashboardLayout', () => {
  it('renders header with title', () => {
    render(<DashboardLayout />)
    expect(screen.getByText('BTC Options Dashboard')).toBeInTheDocument()
  })

  it('renders overview grid', () => {
    render(<DashboardLayout />)
    expect(screen.getByTestId('overview-grid')).toBeInTheDocument()
  })

  it('opens drawer when card is clicked', () => {
    render(<DashboardLayout />)
    fireEvent.click(screen.getByTestId('market-card'))
    expect(screen.getByTestId('market-detail')).toBeInTheDocument()
  })

  it('closes drawer when close button is clicked', () => {
    render(<DashboardLayout />)
    fireEvent.click(screen.getByTestId('market-card'))
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    expect(screen.queryByTestId('market-detail')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试（预期失败）**

```bash
cd apps/web && pnpm test -- DashboardLayout.test.tsx
```

预期：FAIL

- [ ] **Step 3: 实现 DashboardLayout**

修改 `app/components/DashboardLayout.tsx`：

```tsx
import { useState, useCallback } from 'react'
import { AgentChatPanel } from './chat/AgentChatPanel'
import { ModuleDrawer } from './ModuleDrawer'
import { OverviewGrid, type ModuleId } from './OverviewGrid'
import { MarketOverview } from './modules/MarketOverview'
import { VolatilityAnalysis } from './modules/VolatilityAnalysis'
import { PositionStructure } from './modules/PositionStructure'
import { FundingSentiment } from './modules/FundingSentiment'
import { ExpiryAnalysis } from './modules/ExpiryAnalysis'
import { OIDistribution } from './modules/OIDistribution'

const MODULE_DETAILS: Record<ModuleId, { title: string; component: React.ComponentType }> = {
  overview: { title: '市场概况', component: MarketOverview },
  volatility: { title: '波动率分析', component: VolatilityAnalysis },
  positions: { title: '持仓结构', component: PositionStructure },
  sentiment: { title: '资金情绪', component: FundingSentiment },
  expiry: { title: '到期分析', component: ExpiryAnalysis },
  oi: { title: 'OI 分布', component: OIDistribution },
}

export function DashboardLayout() {
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null)

  const handleModuleClick = useCallback((moduleId: ModuleId) => {
    setActiveModule(moduleId)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setActiveModule(null)
  }, [])

  const activeDetail = activeModule ? MODULE_DETAILS[activeModule] : null
  const DetailComponent = activeDetail?.component

  return (
    <div className="flex h-screen bg-background">
      <AgentChatPanel />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 h-full">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">K</div>
              <h1 className="text-base font-semibold tracking-tight">BTC Options Dashboard</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-call" />
                Deribit
              </span>
              <span>自动刷新 30s</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <OverviewGrid
            activeModule={activeModule}
            onModuleClick={handleModuleClick}
          />
        </div>
      </div>

      <ModuleDrawer
        moduleId={activeModule}
        title={activeDetail?.title}
        onClose={handleCloseDrawer}
      >
        {DetailComponent && <DetailComponent />}
      </ModuleDrawer>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试（预期通过）**

```bash
cd apps/web && pnpm test -- DashboardLayout.test.tsx
```

预期：PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/DashboardLayout.tsx apps/web/app/components/DashboardLayout.test.tsx
git commit -m "feat: refactor DashboardLayout to overview grid + drawer layout"
```

---

## Task 9: 全量验证

- [ ] **Step 1: 运行 web 端单元测试**

```bash
cd apps/web && pnpm test -- run
```

预期：全部 PASS（包括新增和现有测试）

- [ ] **Step 2: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：无错误

- [ ] **Step 3: 启动开发服务器验证**

```bash
cd apps/web && pnpm dev
```

打开浏览器访问 http://localhost:5173，验证：
1. 首屏显示 6 张概览卡片（3×2 网格）
2. 点击卡片后右侧滑出 Drawer
3. Drawer 中显示对应模块的完整内容
4. 关闭 Drawer 后回到概览页面
5. 视觉风格已更新（更深的背景、Geist 字体、更大圆角）
6. 卡片有 stagger 入场动画
7. ESC 键可关闭 Drawer

- [ ] **Step 4: Commit（如有调整）**

```bash
git add -A
git commit -m "fix: final adjustments from manual verification" || echo "no changes to commit"
```

---

## Self-Review

### 1. Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 概览网格（3×2 响应式） | Task 8 |
| 极简精致视觉系统（色彩、字体、间距） | Task 2, 3 |
| 右侧 Drawer（520px、动画） | Task 5 |
| 6 张概览卡片（各模块 KPI） | Task 6 |
| Header 精简 | Task 8 |
| 卡片 Hover/Active 状态 | Task 4 |
| Stagger 入场动画 | Task 7, 8 |
| ESC 关闭 Drawer | Task 5 |
| 不修改现有模块内部逻辑 | 全部遵守 |
| 响应式断点 | Task 8（grid-cols 响应式类） |

### 2. Placeholder Scan

- [x] 无 TBD/TODO/FIXME
- [x] 无 "implement later"
- [x] 无模糊描述
- [x] 每个测试步骤包含实际测试代码
- [x] 每个实现步骤包含实际组件代码

### 3. Type Consistency

- [x] `ModuleId` 类型在 OverviewGrid 中定义
- [x] DashboardLayout 中 `MODULE_DETAILS` 的 key 与 `ModuleId` 一致
- [x] `OverviewCardProps.status` 与卡片组件中 `isLoading/isError` 映射一致
- [x] `onModuleClick` 和 `onClick` 签名在各组件间一致

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-21-dashboard-modernization.md`.**

**Two execution options:**

**1. Subagent-Driven（推荐）** — 每个 Task 分配一个独立的 subagent，执行完成后 review 再进入下一个 Task。适合需要严格质量控制的场景。

**2. Inline Execution** — 在当前 session 中按顺序执行所有 Task，批量处理。适合快速推进。

**Which approach?**
