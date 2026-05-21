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

describe('DeribitService edge cases', () => {
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
    mockGet.mockReset()
    mockCacheManager.get.mockResolvedValue(undefined)
    mockCacheManager.set.mockResolvedValue(undefined)
    mockPersistentCache.get.mockResolvedValue(null)
    mockPersistentCache.set.mockResolvedValue(undefined)
    service = new DeribitService(mockCacheManager as Cache, mockPersistentCache as any)
  })

  describe('fetchWithCache cache hit', () => {
    it('returns cached data when available (cache hit)', async () => {
      const cachedData = [{ instrument_name: 'BTC-CACHED' }]
      mockCacheManager.get.mockResolvedValueOnce(cachedData)

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(mockGet).not.toHaveBeenCalled()
      expect(result).toEqual(cachedData)
    })
  })

  describe('429 rate limit degradation', () => {
    it('returns stale cache on 429 rate limit', async () => {
      const staleData = [{ instrument_name: 'BTC-RATE-LIMIT' }]
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null)
      const error = new Error('429 Too Many Requests')
      ;(error as any).response = { status: 429 }
      mockGet.mockRejectedValueOnce(error)
      mockPersistentCache.get.mockResolvedValueOnce(staleData)

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual(staleData)
      expect(mockPersistentCache.get).toHaveBeenCalledTimes(2)
    })

    it('throws when 429 occurs with no stale cache', async () => {
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null)
      const error = new Error('429 Too Many Requests')
      ;(error as any).response = { status: 429 }
      mockGet.mockRejectedValueOnce(error)
      mockPersistentCache.get.mockResolvedValueOnce(null)

      await expect(service.getBookSummaryByCurrency('BTC', 'option')).rejects.toThrow('429')
    })
  })

  describe('fetchWithCache stale cache fallback', () => {
    it('falls back to stale cache on API error', async () => {
      const staleData = [{ instrument_name: 'BTC-STALE' }]
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null)
      mockGet.mockRejectedValueOnce(new Error('API timeout'))
      mockPersistentCache.get.mockResolvedValueOnce(staleData)

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual(staleData)
    })
  })

  describe('fetchWithCache total failure', () => {
    it('propagates error when both API and stale cache fail', async () => {
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null)
      mockGet.mockRejectedValueOnce(new Error('API down'))
      mockPersistentCache.get.mockResolvedValueOnce(null)

      await expect(service.getBookSummaryByCurrency('BTC', 'option')).rejects.toThrow('API down')
    })
  })

  describe('empty book summary data', () => {
    it('empty book summary data handling', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: [] } })

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  describe('cache TTL configuration', () => {
    it('uses 15min TTL for book summary', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawBookSummaryBTC } })
      await service.getBookSummaryByCurrency('BTC', 'option')
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'book_summary_BTC_option',
        expect.anything(),
        900000,
      )
    })

    it('uses 15min TTL for index price', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawIndexPriceBTC } })
      await service.getIndexPrice('btc_usd')
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'index_price_btc_usd',
        expect.anything(),
        900000,
      )
    })

    it('uses 15min TTL for historical volatility', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawHistoricalVolatilityBTC } })
      await service.getHistoricalVolatility('BTC')
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'hist_vol_BTC',
        expect.anything(),
        900000,
      )
    })

    it('uses 15min TTL for trades', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: rawTradesBTC } })
      await service.getLastTradesByCurrency('BTC', 'option')
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'trades_BTC_option_100',
        expect.anything(),
        900000,
      )
    })
  })

  describe('API returning null/undefined', () => {
    it('handles API returning null result', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: null } })

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toBeNull()
    })

    it('handles API returning undefined result', async () => {
      mockGet.mockResolvedValueOnce({ data: { result: undefined } })

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toBeUndefined()
    })
  })

  describe('two-layer caching', () => {
    it('L1 miss + L2 hit: returns persistent cache and writes back to L1', async () => {
      const persistentData = [{ instrument_name: 'BTC-L2-HIT' }]
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(persistentData)

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(mockGet).not.toHaveBeenCalled()
      expect(result).toEqual(persistentData)
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'book_summary_BTC_option',
        persistentData,
        900000,
      )
    })

    it('L1 miss + L2 miss: calls API and writes to both L1 and L2', async () => {
      const apiData = { result: rawBookSummaryBTC }
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null)
      mockGet.mockResolvedValueOnce({ data: apiData })

      await service.getBookSummaryByCurrency('BTC', 'option')

      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'book_summary_BTC_option',
        rawBookSummaryBTC,
        900000,
      )
      expect(mockPersistentCache.set).not.toHaveBeenCalled()
    })

    it('L2 read failure degrades gracefully to API call', async () => {
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockRejectedValueOnce(new Error('PG connection lost'))
      mockGet.mockResolvedValueOnce({ data: { result: rawBookSummaryBTC } })

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(result).toEqual(rawBookSummaryBTC)
    })

    it('API error falls back to stale L2 cache', async () => {
      const staleData = [{ instrument_name: 'BTC-STALE-L2' }]
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockPersistentCache.get.mockResolvedValueOnce(null)
      mockGet.mockRejectedValueOnce(new Error('API down'))
      mockPersistentCache.get.mockResolvedValueOnce(staleData)

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual(staleData)
      expect(mockPersistentCache.get).toHaveBeenCalledTimes(2)
      expect(mockPersistentCache.get).toHaveBeenLastCalledWith(
        'book_summary_BTC_option',
        { includeExpired: true },
      )
    })

    it('works without PersistentCacheService (backward compatible)', async () => {
      const serviceWithoutL2 = new DeribitService(mockCacheManager as Cache, undefined as any)
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockGet.mockResolvedValueOnce({ data: { result: rawBookSummaryBTC } })

      const result = await serviceWithoutL2.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual(rawBookSummaryBTC)
      expect(mockPersistentCache.set).not.toHaveBeenCalled()
    })
  })
})
