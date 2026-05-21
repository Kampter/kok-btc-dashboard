import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PositionOverviewCard } from './PositionOverviewCard'

vi.mock('../../../hooks/useDashboardData', () => ({
  useBookSummary: vi.fn(),
}))

import { useBookSummary } from '../../../hooks/useDashboardData'

describe('PositionOverviewCard', () => {
  beforeEach(() => {
    vi.mocked(useBookSummary).mockReturnValue({
      data: [
        { option_type: 'C', open_interest_usd: 6000000 },
        { option_type: 'P', open_interest_usd: 4000000 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  it('renders call ratio and sentiment', () => {
    render(<PositionOverviewCard onClick={vi.fn()} />)
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    expect(screen.getByText('中性')).toBeInTheDocument()
  })
})
