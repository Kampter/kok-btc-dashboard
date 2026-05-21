import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VolatilityOverviewCard } from './VolatilityOverviewCard'

vi.mock('../../../hooks/useDashboardData', () => ({
  useBookSummary: vi.fn(),
}))

vi.mock('../../../lib/greeks', () => ({
  optionDelta: vi.fn((item: { strike: number; option_type: string }) => {
    // Deterministic mock: return deltas that match target values for testing
    // 85000-P → -0.25 (nearest to -0.25 target)
    // 96000-C → 0.25 (nearest to +0.25 target)
    // 90000-C → 0.52 (ATM)
    // 90000-P → -0.48 (ATM)
    if (item.strike === 85000 && item.option_type === 'P') return -0.25
    if (item.strike === 96000 && item.option_type === 'C') return 0.25
    if (item.strike === 90000 && item.option_type === 'C') return 0.52
    if (item.strike === 90000 && item.option_type === 'P') return -0.48
    return 0
  }),
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

  it('renders 1M 25Δ Skew value and sentiment label', () => {
    render(<VolatilityOverviewCard onClick={vi.fn()} />)
    // With mocked deltas: 85000-P has delta -0.25, 96000-C has delta 0.25
    // Skew = Put IV(85000-P) - Call IV(96000-C) = 65.50 - 64.12 = 1.38
    expect(screen.getByText('1.38%')).toBeInTheDocument()
    expect(screen.getByText('偏恐惧')).toBeInTheDocument()
  })
})
