import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SentimentOverviewCard } from './SentimentOverviewCard'

vi.mock('../../../hooks/useDashboardData', () => ({
  useTrades: vi.fn(),
}))

import { useTrades } from '../../../hooks/useDashboardData'

describe('SentimentOverviewCard', () => {
  beforeEach(() => {
    vi.mocked(useTrades).mockReturnValue({
      data: [
        { option_type: 'P', amount: 2, price: 50000 },
        { option_type: 'C', amount: 1, price: 50000 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  it('renders P/C ratio and sentiment', () => {
    render(<SentimentOverviewCard onClick={vi.fn()} />)
    expect(screen.getByText('66.7%')).toBeInTheDocument()
    expect(screen.getByText('偏看跌')).toBeInTheDocument()
  })
})
