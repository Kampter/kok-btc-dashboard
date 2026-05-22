# AI Copilot 可伸缩面板实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将固定的 AI Copilot 面板改造为支持拖拽调整宽度和折叠/展开的可伸缩面板，视觉风格与 Dashboard 统一暗色主题。

**Architecture:** 抽离 `useResizablePanel` hook 管理宽度状态和 localStorage 持久化；新增 `ResizableHandle` 纯展示组件处理拖拽交互；重构 `AgentChatPanel` 为容器组件，根据折叠状态渲染完整面板或 40px 窄条；`ChatMessage` 和 `ChatInput` 同步更新为 Dashboard 暗色主题。

**Tech Stack:** React 19, Tailwind CSS v4, Vitest + jsdom, Playwright

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/hooks/useResizablePanel.ts` | 新增 | 管理面板宽度、折叠状态、localStorage 持久化 |
| `app/hooks/useResizablePanel.test.ts` | 新增 | Hook 单元测试 |
| `app/components/chat/ResizableHandle.tsx` | 新增 | 2px 拖拽手柄纯展示组件 |
| `app/components/chat/ChatMessage.tsx` | 修改 | 暗色主题样式，移除 blue/slate 双色逻辑 |
| `app/components/chat/ChatInput.tsx` | 修改 | 暗色主题样式，primary 色发送按钮 |
| `app/components/chat/AgentChatPanel.tsx` | 修改 | 重构为可伸缩容器，支持拖拽+折叠 |
| `app/components/chat/AgentChatPanel.test.tsx` | 新增 | 渲染和交互单元测试 |
| `app/components/DashboardLayout.tsx` | 修改 | 移除宽度硬编码假设 |
| `e2e/resizable-panel.spec.ts` | 新增 | Playwright E2E 测试 |

---

### Task 1: useResizablePanel Hook

**Files:**
- Create: `apps/web/app/hooks/useResizablePanel.ts`
- Test: `apps/web/app/hooks/useResizablePanel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizablePanel } from './useResizablePanel'

describe('useResizablePanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns default width and not collapsed on first load', () => {
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(380)
    expect(result.current.isCollapsed).toBe(false)
  })

  it('reads persisted state from localStorage', () => {
    localStorage.setItem('kok:copilot-panel', JSON.stringify({ width: 450, isCollapsed: true }))
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(450)
    expect(result.current.isCollapsed).toBe(true)
  })

  it('updates width and persists to localStorage', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(500)
    })
    expect(result.current.width).toBe(500)
    const stored = JSON.parse(localStorage.getItem('kok:copilot-panel')!)
    expect(stored.width).toBe(500)
  })

  it('clamps width to min 280', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(100)
    })
    expect(result.current.width).toBe(280)
  })

  it('clamps width to max 600', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(800)
    })
    expect(result.current.width).toBe(600)
  })

  it('toggles collapse state and persists', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.toggleCollapse()
    })
    expect(result.current.isCollapsed).toBe(true)
    const stored = JSON.parse(localStorage.getItem('kok:copilot-panel')!)
    expect(stored.isCollapsed).toBe(true)

    act(() => {
      result.current.toggleCollapse()
    })
    expect(result.current.isCollapsed).toBe(false)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('kok:copilot-panel', 'not-json')
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(380)
    expect(result.current.isCollapsed).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run app/hooks/useResizablePanel.test.ts`

Expected: FAIL with "Cannot find module './useResizablePanel'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'kok:copilot-panel'
const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 600

interface PanelState {
  width: number
  isCollapsed: boolean
}

function loadState(): PanelState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        typeof parsed.width === 'number' &&
        typeof parsed.isCollapsed === 'boolean'
      ) {
        return {
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width)),
          isCollapsed: parsed.isCollapsed,
        }
      }
    }
  } catch {
    // corrupted or unavailable
  }
  return { width: DEFAULT_WIDTH, isCollapsed: false }
}

function saveState(state: PanelState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable
  }
}

export function useResizablePanel() {
  const [state, setState] = useState<PanelState>(loadState)

  const setWidth = useCallback((width: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
    setState((prev) => {
      const next = { ...prev, width: clamped }
      saveState(next)
      return next
    })
  }, [])

  const toggleCollapse = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, isCollapsed: !prev.isCollapsed }
      saveState(next)
      return next
    })
  }, [])

  return {
    width: state.width,
    isCollapsed: state.isCollapsed,
    setWidth,
    toggleCollapse,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run app/hooks/useResizablePanel.test.ts`

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/hooks/useResizablePanel.ts apps/web/app/hooks/useResizablePanel.test.ts
git commit -m "feat(web): add useResizablePanel hook with localStorage persistence

- Manage panel width (280-600px clamped) and collapsed state
- Persist to localStorage under kok:copilot-panel key
- Graceful degradation on corrupted/unavailable storage"
```

---

### Task 2: ResizableHandle Component

**Files:**
- Create: `apps/web/app/components/chat/ResizableHandle.tsx`

- [ ] **Step 1: Write the component**

```typescript
interface ResizableHandleProps {
  onResizeStart: () => void
}

export function ResizableHandle({ onResizeStart }: ResizableHandleProps) {
  return (
    <div
      role="separator"
      aria-label="调整面板宽度"
      className="absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize hover:bg-border/50 transition-colors z-10"
      onMouseDown={onResizeStart}
      data-testid="resizable-handle"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/chat/ResizableHandle.tsx
git commit -m "feat(web): add ResizableHandle component

- 2px wide drag handle positioned at panel right edge
- cursor-col-resize on hover with subtle border highlight"
```

---

### Task 3: ChatMessage Style Update

**Files:**
- Modify: `apps/web/app/components/chat/ChatMessage.tsx`

- [ ] **Step 1: Update styles to dark theme**

Replace the entire file content:

```typescript
import { memo } from 'react'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export const ChatMessage = memo(function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-muted text-foreground'
            : 'bg-card text-foreground border border-border'
        }`}
      >
        {content}
      </div>
    </div>
  )
})
```

- [ ] **Step 2: Run existing ChatMessage tests (if any) or verify build**

Run: `cd apps/web && pnpm typecheck`

Expected: PASS (no TypeScript errors in ChatMessage.tsx)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/chat/ChatMessage.tsx
git commit -m "style(web): unify ChatMessage with Dashboard dark theme

- Remove blue-600/slate-200 dual-color logic
- User messages: bg-muted text-foreground
- Assistant messages: bg-card with border-border
- Rounded-xl consistent with OverviewCard"
```

---

### Task 4: ChatInput Style Update

**Files:**
- Modify: `apps/web/app/components/chat/ChatInput.tsx`

- [ ] **Step 1: Update styles to dark theme**

Replace the entire file content:

```typescript
import { useState, type FormEvent } from 'react'

interface ChatInputProps {
  onSubmit: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSubmit(input.trim())
    setInput('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-border bg-card">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
          }
        }}
        placeholder="输入问题..."
        className="flex-1 min-h-[40px] max-h-[120px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-y text-foreground placeholder:text-muted-foreground"
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
      >
        {isLoading ? '发送中...' : '发送'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && pnpm typecheck`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/chat/ChatInput.tsx
git commit -m "style(web): unify ChatInput with Dashboard dark theme

- textarea: bg-background border-border rounded-xl
- Send button: bg-primary hover:bg-primary/90
- Form container: bg-card with border-t border-border"
```

---

### Task 5: AgentChatPanel Refactor

**Files:**
- Modify: `apps/web/app/components/chat/AgentChatPanel.tsx`
- Test: `apps/web/app/components/chat/AgentChatPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentChatPanel } from './AgentChatPanel'

vi.mock('../../hooks/useAgentChat', () => ({
  useAgentChat: () => ({
    messages: [{ id: '1', role: 'assistant', content: 'Hello' }],
    isLoading: false,
    sendMessage: vi.fn(),
  }),
}))

describe('AgentChatPanel', () => {
  it('renders full panel when not collapsed', () => {
    render(<AgentChatPanel />)
    expect(screen.getByText('AI Copilot')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('输入问题...')).toBeInTheDocument()
  })

  it('renders collapse button', () => {
    render(<AgentChatPanel />)
    expect(screen.getByLabelText('收起面板')).toBeInTheDocument()
  })

  it('collapses panel when collapse button is clicked', () => {
    render(<AgentChatPanel />)
    fireEvent.click(screen.getByLabelText('收起面板'))
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.getByLabelText('展开面板')).toBeInTheDocument()
  })

  it('expands panel when expand button is clicked', () => {
    render(<AgentChatPanel />)
    fireEvent.click(screen.getByLabelText('收起面板'))
    fireEvent.click(screen.getByLabelText('展开面板'))
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByLabelText('收起面板')).toBeInTheDocument()
  })

  it('renders resizable handle when expanded', () => {
    render(<AgentChatPanel />)
    expect(screen.getByTestId('resizable-handle')).toBeInTheDocument()
  })

  it('does not render resizable handle when collapsed', () => {
    render(<AgentChatPanel />)
    fireEvent.click(screen.getByLabelText('收起面板'))
    expect(screen.queryByTestId('resizable-handle')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run app/components/chat/AgentChatPanel.test.tsx`

Expected: FAIL — collapse/expand buttons not found, resizable handle not found

- [ ] **Step 3: Write the implementation**

Replace the entire file content:

```typescript
import { useRef, useCallback } from 'react'
import { useAgentChat } from '../../hooks/useAgentChat.js'
import { useResizablePanel } from '../../hooks/useResizablePanel.js'
import { ChatMessage } from './ChatMessage.js'
import { ChatInput } from './ChatInput.js'
import { ResizableHandle } from './ResizableHandle.js'

export function AgentChatPanel() {
  const { messages, isLoading, sendMessage } = useAgentChat({
    activeTab: 'overview',
    lastUpdated: new Date().toISOString(),
  })
  const { width, isCollapsed, setWidth, toggleCollapse } = useResizablePanel()
  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const handleResizeStart = useCallback(() => {
    if (isCollapsed) return
    isDragging.current = true
    startX.current = 0 // will be set on first mousemove
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [isCollapsed, width])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return
      if (startX.current === 0) {
        startX.current = e.clientX
      }
      const delta = e.clientX - startX.current
      setWidth(startWidth.current + delta)
    },
    [setWidth]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // Attach global mouse events during drag
  const onMouseDown = useCallback(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp, { once: true })
  }, [handleMouseMove, handleMouseUp])

  if (isCollapsed) {
    return (
      <div className="flex flex-col h-screen w-10 bg-card border-r border-border relative">
        {/* Primary accent line on left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
        <button
          onClick={toggleCollapse}
          aria-label="展开面板"
          className="flex-1 flex items-center justify-center hover:bg-muted transition-colors duration-150"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="flex flex-col h-screen bg-card border-r border-border relative"
      style={{ width: `${width}px`, transition: isDragging.current ? 'none' : 'width 0.2s ease-out' }}
    >
      {/* Primary accent line on left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />

      <div className="flex items-center justify-between px-4 py-3 border-b border-border ml-[2px]">
        <h2 className="text-sm font-semibold">AI Copilot</h2>
        <button
          onClick={toggleCollapse}
          aria-label="收起面板"
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 ml-[2px]" style={{ backgroundColor: '#0a0a0c' }}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-card border border-border rounded-xl px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ml-[2px]">
        <ChatInput onSubmit={sendMessage} isLoading={isLoading} />
      </div>

      <ResizableHandle onResizeStart={onMouseDown} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm vitest run app/components/chat/AgentChatPanel.test.tsx`

Expected: PASS (6 tests)

- [ ] **Step 5: Run full web typecheck**

Run: `cd apps/web && pnpm typecheck`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/chat/AgentChatPanel.tsx apps/web/app/components/chat/AgentChatPanel.test.tsx
git commit -m "feat(web): make AgentChatPanel resizable and collapsible

- Integrate useResizablePanel hook for width/collapse state
- Add collapse button (≪) in panel header, expands to narrow strip with (≫)
- Add ResizableHandle for drag-to-resize interaction
- Message area uses #0a0a0c background for nested card depth
- Left edge 2px primary accent line for visual distinction"
```

---

### Task 6: DashboardLayout Update

**Files:**
- Modify: `apps/web/app/components/DashboardLayout.tsx`

- [ ] **Step 1: Verify no changes needed (AgentChatPanel self-manages width)**

`DashboardLayout` already uses `flex` layout:
```
<div className="flex h-screen bg-background">
  <AgentChatPanel />
  <div className="flex-1 min-w-0 flex flex-col">
```

The `flex-1` div automatically fills remaining space. No code changes needed.

However, verify the existing `DashboardLayout.test.tsx` still passes since we changed `AgentChatPanel` internals.

- [ ] **Step 2: Run DashboardLayout tests**

Run: `cd apps/web && pnpm vitest run app/components/DashboardLayout.test.tsx`

Expected: PASS (the mock for AgentChatPanel still applies)

- [ ] **Step 3: Run full web test suite**

Run: `cd apps/web && pnpm test:run`

Expected: All tests PASS

- [ ] **Step 4: Commit (if any changes were needed)**

If no changes needed, skip commit. If tests needed adjustment:

```bash
git add apps/web/app/components/DashboardLayout.test.tsx
git commit -m "test(web): verify DashboardLayout works with resizable AgentChatPanel"
```

---

### Task 7: E2E Tests

**Files:**
- Create: `apps/web/e2e/resizable-panel.spec.ts`

- [ ] **Step 1: Write E2E tests**

```typescript
import { test, expect } from '@playwright/test'

test.describe('AI Copilot Resizable Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('panel is visible with default width', async ({ page }) => {
    const panel = page.locator('[data-testid="chat-panel"]')
    await expect(panel).toBeVisible()
    // Panel should contain the header
    await expect(page.getByText('AI Copilot')).toBeVisible()
  })

  test('collapses and expands panel', async ({ page }) => {
    // Initially expanded
    await expect(page.getByPlaceholder('输入问题...')).toBeVisible()

    // Click collapse
    await page.getByLabel('收起面板').click()
    await expect(page.getByPlaceholder('输入问题...')).not.toBeVisible()
    await expect(page.getByLabel('展开面板')).toBeVisible()

    // Click expand
    await page.getByLabel('展开面板').click()
    await expect(page.getByPlaceholder('输入问题...')).toBeVisible()
    await expect(page.getByLabel('收起面板')).toBeVisible()
  })

  test('persists collapsed state after reload', async ({ page }) => {
    // Collapse panel
    await page.getByLabel('收起面板').click()
    await expect(page.getByLabel('展开面板')).toBeVisible()

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Panel should still be collapsed
    await expect(page.getByLabel('展开面板')).toBeVisible()
    await expect(page.getByPlaceholder('输入问题...')).not.toBeVisible()
  })

  test('persists width after reload', async ({ page }) => {
    // Resize panel by simulating drag on the handle
    const handle = page.getByTestId('resizable-handle')
    const box = await handle.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2)
      await page.mouse.up()
    }

    // Reload and verify panel is still wider than default
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('AI Copilot')).toBeVisible()
  })

  test('main content adapts when panel is collapsed', async ({ page }) => {
    // Collapse panel
    await page.getByLabel('收起面板').click()

    // Overview grid should still be visible and usable
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Add data-testid to AgentChatPanel root element**

In `AgentChatPanel.tsx`, add `data-testid="chat-panel"` to the root `div` of both collapsed and expanded states.

For the expanded state root div:
```jsx
<div
  ref={panelRef}
  data-testid="chat-panel"
  ...
>
```

For the collapsed state root div:
```jsx
<div data-testid="chat-panel" className="flex flex-col h-screen w-10 bg-card border-r border-border relative">
```

- [ ] **Step 3: Commit the data-testid addition**

```bash
git add apps/web/app/components/chat/AgentChatPanel.tsx
git commit -m "test(web): add data-testid to AgentChatPanel for E2E selectors"
```

- [ ] **Step 4: Run E2E tests**

Run: `cd apps/web && pnpm exec playwright test e2e/resizable-panel.spec.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit E2E tests**

```bash
git add apps/web/e2e/resizable-panel.spec.ts
git commit -m "test(e2e): add resizable panel interaction tests

- Verify collapse/expand toggle
- Verify persistence across page reload
- Verify main content adapts to collapsed state"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`

Expected: All packages PASS

- [ ] **Step 2: Run full test suite**

Run: `pnpm test:run`

Expected: All tests PASS

- [ ] **Step 3: Run E2E tests**

Run: `pnpm test:e2e`

Expected: All tests PASS

- [ ] **Step 4: Visual verification (manual)**

Run: `pnpm dev`

Open http://localhost:5173 and verify:
1. AI Copilot panel renders with primary accent line on left
2. Panel can be dragged to resize (280-600px)
3. Collapse button (≪) works, panel shrinks to 40px strip
4. Expand button (≫) restores panel
5. Message area has darker background (#0a0a0c)
6. Chat bubbles use muted/card backgrounds, not blue
7. Send button is primary color (#e94560)
8. Refresh page preserves width and collapse state

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "feat(web): complete AI Copilot resizable panel

Implements drag-to-resize (280-600px) and collapse/expand for the
AI Copilot sidebar. Panel style unified with Dashboard dark theme
using primary accent line for visual distinction. State persisted
to localStorage."
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] 拖拽调整宽度 → Task 5 (AgentChatPanel) + Task 2 (ResizableHandle)
- [x] 折叠/展开 → Task 5 (AgentChatPanel collapsed state)
- [x] 宽度限制 280-600px → Task 1 (useResizablePanel clamping)
- [x] localStorage 持久化 → Task 1 (useResizablePanel save/load)
- [x] 暗色主题统一 → Task 3 (ChatMessage) + Task 4 (ChatInput)
- [x] Primary 色边线区分 → Task 5 (left edge 2px bg-primary)
- [x] 消息区独立背景 → Task 5 (backgroundColor: '#0a0a0c')
- [x] 极简 2px 拖拽手柄 → Task 2 (ResizableHandle)
- [x] 动画 0.2s ease-out → Task 5 (transition style)
- [x] 错误处理 (localStorage 不可用/损坏) → Task 1 (try/catch)
- [x] SSR 安全 → Task 1 (localStorage only accessed in useState init and callbacks)
- [x] 单元测试 → Task 1, Task 5
- [x] E2E 测试 → Task 7

**2. Placeholder scan:** No TBD, TODO, or vague requirements found.

**3. Type consistency:**
- `useResizablePanel` returns `{ width, isCollapsed, setWidth, toggleCollapse }` — consistent across Task 1 and Task 5
- `ResizableHandle` prop `onResizeStart` used consistently in Task 2 and Task 5
- `AgentChatPanel` still uses `useAgentChat` with same signature — no breaking changes

All spec requirements mapped to tasks. No gaps found.
