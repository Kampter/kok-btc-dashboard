import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResizableDrawer } from './ResizableDrawer'

// Helper to render ResizableDrawer
function renderDrawer(props: Partial<Parameters<typeof ResizableDrawer>[0]> = {}) {
  return render(
    <ResizableDrawer isOpen={true} onClose={vi.fn()} {...props}>
      <div data-testid="drawer-content">Content</div>
    </ResizableDrawer>,
  )
}

describe('ResizableDrawer localStorage persistence', () => {
  const STORAGE_KEY = 'kok:drawer:width'
  let originalGetItem: Storage['getItem']

  beforeEach(() => {
    originalGetItem = localStorage.getItem.bind(localStorage)
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Ensure localStorage.getItem is always restored, even if a test throws
    localStorage.getItem = originalGetItem
  })

  it('reads width from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, '700')

    renderDrawer()

    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle({ width: '700px' })
  })

  it('uses default width when localStorage is empty', () => {
    renderDrawer()

    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle({ width: '520px' })
  })

  it('uses custom default width when localStorage is empty', () => {
    renderDrawer({ defaultWidth: 600 })

    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle({ width: '600px' })
  })

  it('respects min width from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '100')

    renderDrawer({ minWidth: 480 })

    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle({ width: '480px' })
  })

  it('writes width to localStorage on resize end', async () => {
    renderDrawer()

    const handle = screen.getByTestId('resize-handle')

    // Simulate drag: handle at x=520, drag to x=620 → drawer narrows by 100px
    // Drawer right edge moves 100px right → width decreases by 100: 520 - 100 = 420
    // But minWidth is 480, so it should be clamped to 480
    fireEvent.mouseDown(handle, { clientX: 520 })
    fireEvent.mouseMove(window, { clientX: 620 })
    fireEvent.mouseUp(window)

    // localStorage should contain the exact width (420 clamped to min 480)
    await waitFor(() => {
      const stored = localStorage.getItem(STORAGE_KEY)
      expect(stored).toBe('480')
    })
  })

  it('uses custom storageKey', () => {
    localStorage.setItem('custom-key', '650')

    renderDrawer({ storageKey: 'custom-key' })

    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle({ width: '650px' })
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-number')

    renderDrawer()

    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle({ width: '520px' })
  })

  it('recovers from localStorage error', () => {
    localStorage.getItem = vi.fn(() => {
      throw new Error('localStorage unavailable')
    })

    renderDrawer()

    const drawer = screen.getByTestId('resizable-drawer')
    expect(drawer).toHaveStyle({ width: '520px' })
  })
})
