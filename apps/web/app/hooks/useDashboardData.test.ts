import { describe, it, expect, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import {
  useMarketOverview,
  useBookSummary,
  useTrades,
  useHistoricalVolatility,
} from './useDashboardData'

const mockedUseQuery = vi.mocked(useQuery)

// Track the options passed to each query procedure
const capturedOptions: Record<string, unknown> = {}

vi.mock('../lib/trpc', () => ({
  trpc: {
    deribit: {
      marketOverview: {
        queryOptions: () => {
          const opts = { queryKey: ['marketOverview'] }
          capturedOptions.marketOverview = opts
          return opts
        },
      },
      bookSummary: {
        queryOptions: (input: { currency: string; kind: string }) => {
          const opts = { queryKey: ['bookSummary', input], ...input }
          capturedOptions.bookSummary = opts
          return opts
        },
      },
      trades: {
        queryOptions: (input: { currency: string; count?: number }) => {
          const opts = { queryKey: ['trades', input], ...input }
          capturedOptions.trades = opts
          return opts
        },
      },
      historicalVolatility: {
        queryOptions: (input: { currency: string }) => {
          const opts = { queryKey: ['hv', input], ...input }
          capturedOptions.hv = opts
          return opts
        },
      },
    },
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))

describe('useDashboardData hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(capturedOptions).forEach((k) => delete capturedOptions[k])
  })

  describe('useMarketOverview', () => {
    it('calls useQuery with marketOverview options', () => {
      useMarketOverview()
      expect(useQuery).toHaveBeenCalledTimes(1)
      expect(capturedOptions.marketOverview).toEqual({ queryKey: ['marketOverview'] })
    })
  })

  describe('useBookSummary', () => {
    it('calls useQuery with currency and kind parameters', () => {
      useBookSummary('BTC', 'option')
      expect(useQuery).toHaveBeenCalledTimes(1)
      expect(capturedOptions.bookSummary).toMatchObject({
        queryKey: ['bookSummary', { currency: 'BTC', kind: 'option' }],
        currency: 'BTC',
        kind: 'option',
      })
    })

    it('calls useQuery with different currency', () => {
      useBookSummary('ETH', 'future')
      expect(useQuery).toHaveBeenCalledTimes(1)
      expect(capturedOptions.bookSummary).toMatchObject({
        currency: 'ETH',
        kind: 'future',
      })
    })
  })

  describe('useTrades', () => {
    it('calls useQuery with default count (100)', () => {
      useTrades('BTC')
      expect(useQuery).toHaveBeenCalledTimes(1)
      expect(capturedOptions.trades).toMatchObject({
        queryKey: ['trades', { currency: 'BTC', count: 100 }],
        currency: 'BTC',
        count: 100,
      })
    })

    it('calls useQuery with custom count', () => {
      useTrades('ETH', 50)
      expect(useQuery).toHaveBeenCalledTimes(1)
      expect(capturedOptions.trades).toMatchObject({
        queryKey: ['trades', { currency: 'ETH', count: 50 }],
        currency: 'ETH',
        count: 50,
      })
    })
  })

  describe('useHistoricalVolatility', () => {
    it('calls useQuery with currency parameter', () => {
      useHistoricalVolatility('BTC')
      expect(useQuery).toHaveBeenCalledTimes(1)
      expect(capturedOptions.hv).toMatchObject({
        queryKey: ['hv', { currency: 'BTC' }],
        currency: 'BTC',
      })
    })
  })
})
