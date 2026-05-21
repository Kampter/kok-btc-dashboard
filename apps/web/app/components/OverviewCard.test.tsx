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
