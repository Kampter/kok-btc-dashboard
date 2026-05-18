import { describe, it, expect, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import {
  useMarketOverview,
  useBookSummary,
  useTrades,
  useHistoricalVolatility,
} from './useDashboardData'

vi.mock('../lib/trpc', () => ({
  trpc: {
    deribit: {
      marketOverview: { queryOptions: () => ({ queryKey: ['marketOverview'] }) },
      bookSummary: { queryOptions: () => ({ queryKey: ['bookSummary'] }) },
      trades: { queryOptions: () => ({ queryKey: ['trades'] }) },
      historicalVolatility: { queryOptions: () => ({ queryKey: ['hv'] }) },
    },
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))

describe('useMarketOverview', () => {
  it('calls useQuery with marketOverview options', () => {
    useMarketOverview()
    expect(useQuery).toHaveBeenCalledWith({ queryKey: ['marketOverview'] })
  })
})

describe('useBookSummary', () => {
  it('calls useQuery with bookSummary options and parameters', () => {
    useBookSummary('BTC', 'option')
    expect(useQuery).toHaveBeenCalledWith({ queryKey: ['bookSummary'] })
  })
})

describe('useTrades', () => {
  it('calls useQuery with trades options and default count', () => {
    useTrades('BTC')
    expect(useQuery).toHaveBeenCalledWith({ queryKey: ['trades'] })
  })

  it('calls useQuery with trades options and custom count', () => {
    useTrades('ETH', 50)
    expect(useQuery).toHaveBeenCalledWith({ queryKey: ['trades'] })
  })
})

describe('useHistoricalVolatility', () => {
  it('calls useQuery with historicalVolatility options', () => {
    useHistoricalVolatility('BTC')
    expect(useQuery).toHaveBeenCalledWith({ queryKey: ['hv'] })
  })
})
