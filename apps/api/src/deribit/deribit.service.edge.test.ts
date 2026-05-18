import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeribitService } from './deribit.service'

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
    get: vi.fn(),
    set: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCacheManager.get.mockResolvedValue(undefined)
    mockCacheManager.set.mockResolvedValue(undefined)
    service = new DeribitService(mockCacheManager as any)
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

  describe('fetchWithCache stale cache fallback', () => {
    it('falls back to stale cache on API error', async () => {
      const staleData = [{ instrument_name: 'BTC-STALE' }]
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockGet.mockRejectedValueOnce(new Error('API timeout'))
      mockCacheManager.get.mockResolvedValueOnce(staleData)

      const result = await service.getBookSummaryByCurrency('BTC', 'option')

      expect(result).toEqual(staleData)
    })
  })

  describe('fetchWithCache total failure', () => {
    it('propagates error when both API and stale cache fail', async () => {
      mockCacheManager.get.mockResolvedValueOnce(undefined)
      mockGet.mockRejectedValueOnce(new Error('API down'))
      mockCacheManager.get.mockResolvedValueOnce(undefined)

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
})
