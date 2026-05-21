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
