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
        { mark_iv: 45.0 },
        { mark_iv: 47.0 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  it('renders average ATM IV', () => {
    render(<VolatilityOverviewCard onClick={vi.fn()} />)
    expect(screen.getByText('46.00%')).toBeInTheDocument()
  })
})
