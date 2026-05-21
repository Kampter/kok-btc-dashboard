import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarketOverviewCard } from './MarketOverviewCard'

vi.mock('../../../hooks/useDashboardData', () => ({
  useMarketOverview: vi.fn(),
}))

import { useMarketOverview } from '../../../hooks/useDashboardData'

describe('MarketOverviewCard', () => {
  beforeEach(() => {
    vi.mocked(useMarketOverview).mockReturnValue({
      data: { totalOI: 12400000000, totalVolume24h: 560000000, atmIV: 45.2, btcPrice: 98500, timestamp: '2026-05-21' },
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
