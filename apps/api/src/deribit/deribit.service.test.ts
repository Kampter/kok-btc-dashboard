import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Cache } from 'cache-manager'
import { DeribitService } from './deribit.service'
import { rawBookSummaryBTC, rawIndexPriceBTC, rawHistoricalVolatilityBTC, rawTradesBTC } from '@kok/shared-types/fixtures'

const mockGet = vi.fn()
const mockClient = { get: mockGet }

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockClient),
  },
}))

vi.mock('@nestjs/cache-manager', () => ({
  CACHE_MANAGER: 'CACHE_MANAGER',
}))

describe('DeribitService', () => {
  let service: DeribitService
  const mockCacheManager = {
    get: vi.fn<Cache['get']>(),
    set: vi.fn<Cache['set']>(),
  }
  const mockPersistentCache = {
    get: vi.fn(),
    set: vi.fn(),
    cleanupExpired: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCacheManager.get.mockResolvedValue(undefined)
    mockCacheManager.set.mockResolvedValue(undefined)
    mockPersistentCache.get.mockResolvedValue(null)
    mockPersistentCache.set.mockResolvedValue(undefined)
    service = new DeribitService(mockCacheManager as Cache, mockPersistentCache as any)
  })

  describe('getBookSummaryByCurrency', () => {
    it('returns raw book summary data', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawBookSummaryBTC } })
      const result = await service.getBookSummaryByCurrency('BTC', 'option')
      expect(mockGet).toHaveBeenCalledWith('/get_book_summary_by_currency', {
        params: { currency: 'BTC', kind: 'option' },
      })
      expect(result).toHaveLength(4)
      expect(result[0]).toHaveProperty('instrument_name', 'BTC-30MAY26-90000-C')
    })

    it('propagates API errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      await expect(service.getBookSummaryByCurrency('BTC', 'option')).rejects.toThrow('Network error')
    })
  })

  describe('getIndexPrice', () => {
    it('returns index price data', async () => {
      // Deribit API returns { index_price: 89950.5, estimated_delivery_price: 89950.5 }
      mockGet.mockResolvedValueOnce({ data: { result: { index_price: 89950.5, estimated_delivery_price: 89950.5 } } })
      const result = await service.getIndexPrice('btc_usd')
      expect(mockGet).toHaveBeenCalledWith('/get_index_price', {
        params: { index_name: 'btc_usd' },
      })
      expect(result.index_price).toBe(89950.5)
      expect(result.estimated_delivery_price).toBe(89950.5)
    })
  })

  describe('getHistoricalVolatility', () => {
    it('returns historical volatility array', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawHistoricalVolatilityBTC } })
      const result = await service.getHistoricalVolatility('BTC')
      expect(result).toHaveLength(7)
      expect(result[0]).toEqual([1747468800000, 55.32])
    })
  })

  describe('getLastTradesByCurrency', () => {
    it('returns trades with default count', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawTradesBTC } })
      const result = await service.getLastTradesByCurrency('BTC', 'option')
      expect(mockGet).toHaveBeenCalledWith('/get_last_trades_by_currency', {
        params: { currency: 'BTC', kind: 'option', count: 100, sorting: 'desc' },
      })
      expect(result.trades).toHaveLength(3)
    })

    it('accepts custom count', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawTradesBTC } })
      await service.getLastTradesByCurrency('BTC', 'option', 50)
      expect(mockGet).toHaveBeenCalledWith('/get_last_trades_by_currency', {
        params: { currency: 'BTC', kind: 'option', count: 50, sorting: 'desc' },
      })
    })
  })
})
