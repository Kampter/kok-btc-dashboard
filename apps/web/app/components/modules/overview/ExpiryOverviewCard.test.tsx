import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExpiryOverviewCard } from './ExpiryOverviewCard'

vi.mock('../../../hooks/useDashboardData', () => ({
  useBookSummary: vi.fn(),
}))

import { useBookSummary } from '../../../hooks/useDashboardData'

describe('ExpiryOverviewCard', () => {
  beforeEach(() => {
    vi.mocked(useBookSummary).mockReturnValue({
      data: [
        { expiry: '2026-05-30', open_interest_usd: 3000000 },
        { expiry: '2026-06-27', open_interest_usd: 7000000 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  it('renders max expiry OI', () => {
    render(<ExpiryOverviewCard onClick={vi.fn()} />)
    expect(screen.getByText(/6月27日/)).toBeInTheDocument()
  })
})
