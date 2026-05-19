import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersistentCacheService } from './persistent-cache.service'

const mockQuery = vi.fn()

// 模拟一个 pg.Pool 对象（只有 query 方法）
function createMockPool() {
  return { query: mockQuery } as unknown as import('pg').Pool
}

describe('PersistentCacheService', () => {
  let service: PersistentCacheService

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockReset()
    service = new PersistentCacheService(createMockPool())
  })

  describe('onModuleInit', () => {
    it('creates cache_entries table on init', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
      await service.onModuleInit()
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS cache_entries'),
      )
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at'),
      )
    })

    it('cleans up expired entries on init', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 5 })
      await service.onModuleInit()
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at <= NOW()"),
      )
    })
  })

  describe('get', () => {
    it('returns cached value when key exists and not expired', async () => {
      const cachedValue = { foo: 'bar' }
      mockQuery.mockResolvedValueOnce({ rows: [{ value: cachedValue }], rowCount: 1 })

      const result = await service.get('test_key')

      expect(result).toEqual(cachedValue)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value FROM cache_entries'),
        ['test_key'],
      )
    })

    it('returns null when key does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await service.get('missing_key')

      expect(result).toBeNull()
    })

    it('returns null when key is expired', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await service.get('expired_key')

      expect(result).toBeNull()
    })

    it('returns expired value when includeExpired is true', async () => {
      const staleValue = { stale: true }
      mockQuery.mockResolvedValueOnce({ rows: [{ value: staleValue }], rowCount: 1 })

      const result = await service.get('expired_key', { includeExpired: true })

      expect(result).toEqual(staleValue)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value FROM cache_entries WHERE cache_key = $1'),
        ['expired_key'],
      )
    })
  })

  describe('set', () => {
    it('inserts or updates cache entry with expiration', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

      await service.set('test_key', { data: 123 }, 600000)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cache_entries'),
        ['test_key', JSON.stringify({ data: 123 }), expect.any(Date)],
      )
    })
  })

  describe('cleanupExpired', () => {
    it('deletes expired entries and logs count', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 })
      await service.cleanupExpired()
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM cache_entries WHERE expires_at IS NOT NULL'),
      )
    })
  })
})
