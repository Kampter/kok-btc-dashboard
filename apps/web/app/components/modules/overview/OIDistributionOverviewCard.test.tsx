import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OIDistributionOverviewCard } from './OIDistributionOverviewCard'

vi.mock('../../../hooks/useDashboardData', () => ({
  useOIDistribution: vi.fn(),
}))

import { useOIDistribution } from '../../../hooks/useDashboardData'

describe('OIDistributionOverviewCard', () => {
  beforeEach(() => {
    vi.mocked(useOIDistribution).mockReturnValue({
      data: { selected: { max_pain: 95000, strikes: [], oi_calls: [], oi_puts: [] } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  it('renders max pain', () => {
    render(<OIDistributionOverviewCard onClick={vi.fn()} />)
    expect(screen.getByText('$95.00K')).toBeInTheDocument()
  })
})
