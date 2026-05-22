# Drawer 拖拽调整宽度实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ModuleDrawer 改造为可拖拽调整宽度的 ResizableDrawer，支持 localStorage 记忆，最小 480px，最大 80% 视口宽。

**Architecture:** 新建通用 `ResizableDrawer` 组件封装所有拖拽逻辑和宽度管理。`ModuleDrawer` 退化为业务 wrapper，只负责 `moduleId → 详情组件` 映射。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + Recharts (ResponsiveContainer) + Vitest (jsdom) + Playwright

---

## 文件结构

| 文件 | 变更 | 职责 |
|------|------|------|
| `apps/web/app/components/ResizableDrawer.tsx` | 新建 | 通用可拖拽面板，管理宽度、拖拽事件、localStorage |
| `apps/web/app/components/ResizableDrawer.test.tsx` | 新建 | ResizableDrawer 单元测试 |
| `apps/web/app/components/ModuleDrawer.tsx` | 修改 | 退化为业务 wrapper，只负责 moduleId → 组件映射 |
| `apps/web/app/components/ModuleDrawer.test.tsx` | 修改 | 适配新接口，验证 wrapper 行为 |
| `apps/web/e2e/dashboard.spec.ts` | 修改 | 添加拖拽宽度调整、边界限制、持久化的 E2E 测试 |

---

## Task 1: ResizableDrawer 组件

**Files:**
- Create: `apps/web/app/components/ResizableDrawer.tsx`
- Test: `apps/web/app/components/ResizableDrawer.test.tsx`

**设计文档对应章节：** 架构、ResizableDrawer API、交互细节

### Step 1: 编写 ResizableDrawer 组件

创建 `apps/web/app/components/ResizableDrawer.tsx`：

```tsx
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

export interface ResizableDrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  storageKey?: string
}

const DEFAULT_WIDTH = 520
const MIN_WIDTH = 480
const STORAGE_KEY = 'kok:drawer:width'

function readStoredWidth(key: string, defaultValue: number): number {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!Number.isNaN(parsed)) return parsed
    }
  } catch {
    // localStorage may be unavailable
  }
  return defaultValue
}

function writeStoredWidth(key: string, width: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, String(width))
  } catch {
    // localStorage may be unavailable
  }
}

export const ResizableDrawer = memo(function ResizableDrawer({
  isOpen,
  onClose,
  title,
  children,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth,
  storageKey = STORAGE_KEY,
}: ResizableDrawerProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(0)

  // Read stored width on mount
  useEffect(() => {
    const stored = readStoredWidth(storageKey, defaultWidth)
    const viewportMax = maxWidth ?? Math.floor(window.innerWidth * 0.8)
    const clamped = Math.max(minWidth, Math.min(viewportMax, stored))
    setDrawerWidth(clamped)
  }, [defaultWidth, maxWidth, minWidth, storageKey])

  // Update max width when viewport changes
  useEffect(() => {
    if (maxWidth !== undefined) return
    const handleResize = () => {
      setDrawerWidth((current) => {
        const viewportMax = Math.floor(window.innerWidth * 0.8)
        return Math.min(current, viewportMax)
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [maxWidth])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, handleClose])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      setIsDragging(true)

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      dragStartXRef.current = clientX
      dragStartWidthRef.current = drawerWidth

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [drawerWidth]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const delta = dragStartXRef.current - clientX
      const newWidth = dragStartWidthRef.current + delta
      const viewportMax = maxWidth ?? Math.floor(window.innerWidth * 0.8)
      const clamped = Math.max(minWidth, Math.min(viewportMax, newWidth))
      setDrawerWidth(clamped)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      writeStoredWidth(storageKey, drawerWidth)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleMouseMove)
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [isDragging, drawerWidth, maxWidth, minWidth, storageKey])

  if (!isOpen && !isClosing) return null

  const animationName = isClosing ? 'slideOutRight' : 'slideInRight'
  const animationDuration = isClosing ? '200ms' : '300ms'

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40',
          isClosing ? 'opacity-0' : 'bg-black/40',
        )}
        style={{
          transition: 'opacity 200ms ease',
        }}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'fixed right-0 top-0 h-full z-50 bg-background border-l border-border shadow-lg',
          'flex flex-col',
        )}
        style={{
          width: `${drawerWidth}px`,
          animation: `${animationName} ${animationDuration} cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
        role="dialog"
        aria-modal="true"
        data-testid="resizable-drawer"
      >
        {/* Resize handle */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-3 -translate-x-1/2 z-50',
            'cursor-col-resize touch-none',
            'bg-muted/30 hover:bg-primary/40 transition-colors',
            'flex items-center justify-center',
          )}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          role="separator"
          aria-label="调整面板宽度"
          data-testid="resize-handle"
        >
          <div className="w-0.5 h-6 bg-muted-foreground/50 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold">{title || '详情'}</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="关闭"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
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

### Step 2: 编写单元测试

创建 `apps/web/app/components/ResizableDrawer.test.tsx`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResizableDrawer } from './ResizableDrawer'

const TestContent = () => <div data-testid="drawer-content">测试内容</div>

describe('ResizableDrawer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('does not render when isOpen is false', () => {
    render(
      <ResizableDrawer isOpen={false} onClose={vi.fn()}>
        <TestContent />
      </ResizableDrawer>
    )
    expect(screen.queryByTestId('drawer-content')).not.toBeInTheDocument()
  })

  it('renders content when isOpen is true', () => {
    render(
      <ResizableDrawer isOpen={true} onClose={vi.fn()} title="测试标题">
        <TestContent />
      </ResizableDrawer>
    )
    expect(screen.getByTestId('drawer-content')).toBeInTheDocument()
    expect(screen.getByText('测试标题')).toBeInTheDocument()
  })

  it('renders with default width', () => {
    render(
      <ResizableDrawer isOpen={true} onClose={vi.fn()}>
        <TestContent />
      </ResizableDrawer>
    )
    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle('width: 520px')
  })

  it('renders with stored width from localStorage', () => {
    localStorage.setItem('kok:drawer:width', '720')
    render(
      <ResizableDrawer isOpen={true} onClose={vi.fn()}>
        <TestContent />
      </ResizableDrawer>
    )
    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle('width: 720px')
  })

  it('clamps stored width to min width', () => {
    localStorage.setItem('kok:drawer:width', '300')
    render(
      <ResizableDrawer isOpen={true} onClose={vi.fn()} minWidth={480}>
        <TestContent />
      </ResizableDrawer>
    )
    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle('width: 480px')
  })

  it('clamps stored width to max width', () => {
    localStorage.setItem('kok:drawer:width', '2000')
    render(
      <ResizableDrawer isOpen={true} onClose={vi.fn()} maxWidth={800}>
        <TestContent />
      </ResizableDrawer>
    )
    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle('width: 800px')
  })

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn()
    render(
      <ResizableDrawer isOpen={true} onClose={handleClose}>
        <TestContent />
      </ResizableDrawer>
    )
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    vi.advanceTimersByTime(250)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('prevents body scroll when open', () => {
    const originalOverflow = document.body.style.overflow
    render(
      <ResizableDrawer isOpen={true} onClose={vi.fn()}>
        <TestContent />
      </ResizableDrawer>
    )
    expect(document.body.style.overflow).toBe('hidden')
    document.body.style.overflow = originalOverflow
  })

  it('renders resize handle', () => {
    render(
      <ResizableDrawer isOpen={true} onClose={vi.fn()}>
        <TestContent />
      </ResizableDrawer>
    )
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-label',
      '调整面板宽度'
    )
  })
})
```

### Step 3: 运行测试确认通过

```bash
cd apps/web && pnpm test ResizableDrawer.test.tsx
```

Expected: 8 tests passing

### Step 4: Commit

```bash
git add apps/web/app/components/ResizableDrawer.tsx apps/web/app/components/ResizableDrawer.test.tsx
git commit -m "feat: add ResizableDrawer component with drag-to-resize and localStorage persistence"
```

---

## Task 2: ModuleDrawer 改造

**Files:**
- Modify: `apps/web/app/components/ModuleDrawer.tsx`
- Modify: `apps/web/app/components/ModuleDrawer.test.tsx`

**设计文档对应章节：** ModuleDrawer 改造

### Step 1: 修改 ModuleDrawer 为业务 wrapper

重写 `apps/web/app/components/ModuleDrawer.tsx`：

```tsx
import { memo, useCallback } from 'react'
import { ResizableDrawer } from './ResizableDrawer'

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

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <ResizableDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
    >
      {children}
    </ResizableDrawer>
  )
})
```

### Step 2: 更新 ModuleDrawer 测试

修改 `apps/web/app/components/ModuleDrawer.test.tsx`：

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ModuleDrawer } from './ModuleDrawer'

const TestContent = () => <div data-testid="drawer-content">测试内容</div>

describe('ModuleDrawer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn()
    render(
      <ModuleDrawer moduleId="overview" onClose={handleClose}>
        <TestContent />
      </ModuleDrawer>
    )
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    vi.advanceTimersByTime(250)
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  it('prevents body scroll when open', () => {
    const originalOverflow = document.body.style.overflow
    render(
      <ModuleDrawer moduleId="overview" onClose={vi.fn()}>
        <TestContent />
      </ModuleDrawer>
    )
    expect(document.body.style.overflow).toBe('hidden')
    document.body.style.overflow = originalOverflow
  })

  it('uses ResizableDrawer with resize handle', () => {
    render(
      <ModuleDrawer moduleId="overview" onClose={vi.fn()}>
        <TestContent />
      </ModuleDrawer>
    )
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument()
  })
})
```

### Step 3: 运行测试确认通过

```bash
cd apps/web && pnpm test ModuleDrawer.test.tsx
```

Expected: 5 tests passing

### Step 4: Commit

```bash
git add apps/web/app/components/ModuleDrawer.tsx apps/web/app/components/ModuleDrawer.test.tsx
git commit -m "refactor: simplify ModuleDrawer to business wrapper using ResizableDrawer"
```

---

## Task 3: E2E 测试

**Files:**
- Modify: `apps/web/e2e/dashboard.spec.ts`

**设计文档对应章节：** 测试

### Step 1: 添加 E2E 测试用例

在 `apps/web/e2e/dashboard.spec.ts` 末尾添加新的 test.describe 块：

```typescript
test.describe('Dashboard - Drawer Resize', () => {
  test('can resize drawer by dragging handle', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Get initial width
    const initialWidth = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(initialWidth).toBe(520)

    // Drag handle to the left to widen drawer
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x - 200, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    // Verify width increased
    const newWidth = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(newWidth).toBeGreaterThan(520)
  })

  test('drawer width respects minimum boundary', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Drag handle far to the right to shrink beyond min
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x + 500, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    // Verify width is not below 480
    const width = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBeGreaterThanOrEqual(480)
  })

  test('drawer width respects maximum boundary', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Drag handle far to the left to expand beyond 80%
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x - 800, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    // Verify width is not above 80% of 1440 = 1152
    const width = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBeLessThanOrEqual(1152)
  })

  test('remembers drawer width after close and reopen', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Resize to a custom width
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x - 300, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    const customWidth = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(customWidth).toBeGreaterThan(520)

    // Close and reopen
    await closeModule(page)
    await openModule(page, '市场概况')

    // Verify width persisted
    const persistedWidth = await page.getByTestId('resizable-drawer').evaluate(
      (el) => el.getBoundingClientRect().width
    )
    expect(persistedWidth).toBe(customWidth)
  })
})
```

### Step 2: 运行 E2E 测试

```bash
pnpm test:e2e --grep "Drawer Resize"
```

Expected: 4 tests passing

### Step 3: Commit

```bash
git add apps/web/e2e/dashboard.spec.ts
git commit -m "test: add E2E tests for drawer resize functionality"
```

---

## Task 4: 全量验证

### Step 1: 运行单元测试

```bash
cd apps/web && pnpm test
```

Expected: 所有现有测试 + 新增测试全部通过

### Step 2: 运行类型检查

```bash
cd apps/web && pnpm typecheck
```

Expected: 无类型错误

### Step 3: 运行 E2E 测试

```bash
pnpm test:e2e
```

Expected: 所有现有测试 + 新增测试全部通过

### Step 4: Commit（如有修改）

---

## Self-Review

### 1. Spec coverage

| 设计文档要求 | 对应任务/步骤 |
|-------------|--------------|
| ResizableDrawer 通用组件 | Task 1, Step 1 |
| Props 接口（isOpen, onClose, title, children, defaultWidth, minWidth, maxWidth, storageKey） | Task 1, Step 1 |
| 最小 480px，最大 80% 视口宽 | Task 1, Step 1（clamp 逻辑） |
| localStorage 记忆上次宽度 | Task 1, Step 1（readStoredWidth / writeStoredWidth） |
| 拖拽 handle 样式与交互 | Task 1, Step 1 |
| 窗口 resize 自动收缩 | Task 1, Step 1（useEffect） |
| SSR 安全（localStorage 在 useEffect） | Task 1, Step 1 |
| ModuleDrawer 退化为 wrapper | Task 2, Step 1 |
| 保留动画 | Task 1, Step 1（style animation） |
| Vitest 单元测试 | Task 1, Step 2 |
| Playwright E2E 测试 | Task 3 |

✅ 全覆盖

### 2. Placeholder scan

- 无 "TBD", "TODO", "implement later"
- 所有代码步骤包含完整代码块
- 所有测试包含完整断言
- 无 "similar to Task N"

✅ 无 placeholder

### 3. Type consistency

- `ResizableDrawerProps` 接口在组件文件和测试中一致
- `storageKey` 默认值 `'kok:drawer:width'` 一致
- `minWidth` 默认 480 一致
- `defaultWidth` 默认 520 一致

✅ 类型一致
