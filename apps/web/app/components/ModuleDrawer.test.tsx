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
    expect(screen.queryByTestId('resizable-drawer')).not.toBeInTheDocument()
  })

  it('renders content when moduleId is provided', () => {
    render(
      <ModuleDrawer moduleId="overview" title="市场概况" onClose={vi.fn()}>
        <TestContent />
      </ModuleDrawer>
    )
    expect(screen.getByTestId('drawer-content')).toBeInTheDocument()
    expect(screen.getByText('市场概况')).toBeInTheDocument()
    expect(screen.getByTestId('resizable-drawer')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn()
    render(
      <ModuleDrawer moduleId="overview" onClose={handleClose}>
        <TestContent />
      </ModuleDrawer>
    )
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    // Close is delayed by 200ms for animation in ResizableDrawer
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
    // Cleanup restores original overflow
    document.body.style.overflow = originalOverflow
  })

  it('renders resize handle from ResizableDrawer', () => {
    render(
      <ModuleDrawer moduleId="overview" onClose={vi.fn()}>
        <TestContent />
      </ModuleDrawer>
    )
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument()
  })
})
