import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VolatilityOverviewCard } from './VolatilityOverviewCard'

vi.mock('../../../hooks/useDashboardData', () => ({
  useBookSummary: vi.fn(),
}))

import { useBookSummary } from '../../../hooks/useDashboardData'

describe('VolatilityOverviewCard', () => {
  beforeEach(() => {
    vi.mocked(useBookSummary).mockReturnValue({
      data: [
        {
          instrument_name: 'BTC-30MAY26-90000-C',
          strike: 90000,
          expiry: '2026-05-30T08:00:00.000Z',
          option_type: 'C',
          open_interest: 100,
          open_interest_usd: 1000000,
          volume_24h: 10,
          mark_iv: 62.34,
          bid_iv: 0,
          ask_iv: 0,
          underlying_price: 89950,
        },
        {
          instrument_name: 'BTC-30MAY26-96000-C',
          strike: 96000,
          expiry: '2026-05-30T08:00:00.000Z',
          option_type: 'C',
          open_interest: 100,
          open_interest_usd: 1000000,
          volume_24h: 10,
          mark_iv: 64.12,
          bid_iv: 0,
          ask_iv: 0,
          underlying_price: 89950,
        },
        {
          instrument_name: 'BTC-30MAY26-90000-P',
          strike: 90000,
          expiry: '2026-05-30T08:00:00.000Z',
          option_type: 'P',
          open_interest: 100,
          open_interest_usd: 1000000,
          volume_24h: 10,
          mark_iv: 63.80,
          bid_iv: 0,
          ask_iv: 0,
          underlying_price: 89950,
        },
        {
          instrument_name: 'BTC-30MAY26-85000-P',
          strike: 85000,
          expiry: '2026-05-30T08:00:00.000Z',
          option_type: 'P',
          open_interest: 100,
          open_interest_usd: 1000000,
          volume_24h: 10,
          mark_iv: 65.50,
          bid_iv: 0,
          ask_iv: 0,
          underlying_price: 89950,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  it('renders 1M 25Δ Skew value', () => {
    render(<VolatilityOverviewCard onClick={vi.fn()} />)
    // 1M Skew = Put IV(85000-P, ~-0.27 delta) - Call IV(96000-C, ~0.27 delta)
    // = 65.50 - 64.12 = 1.38
    expect(screen.getByText('1.38%')).toBeInTheDocument()
    expect(screen.getByText('偏恐惧')).toBeInTheDocument()
  })
})
