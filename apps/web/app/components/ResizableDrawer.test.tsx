import { render, screen, fireEvent, act } from '@testing-library/react'
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
    act(() => {
      vi.advanceTimersByTime(250)
    })
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
