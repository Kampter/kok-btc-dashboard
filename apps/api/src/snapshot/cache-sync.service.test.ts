import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheSyncService } from './cache-sync.service';

const mockCacheManager = {
  get: vi.fn(),
} as unknown as import('cache-manager').Cache;

const mockPersistentCache = {
  set: vi.fn().mockResolvedValue(undefined),
};

describe('CacheSyncService', () => {
  let service: CacheSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CacheSyncService(mockCacheManager, mockPersistentCache as any);
  });

  describe('syncCacheToPersistentStorage', () => {
    it('should sync all cache keys to persistent storage', async () => {
      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce([{ instrument_name: 'BTC-TEST' }])
        .mockResolvedValueOnce({ index_price: 100000 })
        .mockResolvedValueOnce([[1747555200000, 56.78]])
        .mockResolvedValueOnce({ trades: [] });

      await service.syncCacheToPersistentStorage();

      expect(mockPersistentCache.set).toHaveBeenCalledTimes(4);
      expect(mockPersistentCache.set).toHaveBeenCalledWith(
        'book_summary_BTC_option',
        [{ instrument_name: 'BTC-TEST' }],
        7200000,
      );
      expect(mockPersistentCache.set).toHaveBeenCalledWith(
        'index_price_btc_usd',
        { index_price: 100000 },
        7200000,
      );
      expect(mockPersistentCache.set).toHaveBeenCalledWith(
        'hist_vol_BTC',
        [[1747555200000, 56.78]],
        7200000,
      );
      expect(mockPersistentCache.set).toHaveBeenCalledWith(
        'trades_BTC_option_100',
        { trades: [] },
        7200000,
      );
    });

    it('should skip keys with null or undefined values', async () => {
      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([[1747555200000, 56.78]])
        .mockResolvedValueOnce({ trades: [] });

      await service.syncCacheToPersistentStorage();

      expect(mockPersistentCache.set).toHaveBeenCalledTimes(2);
      expect(mockPersistentCache.set).not.toHaveBeenCalledWith(
        'book_summary_BTC_option',
        expect.anything(),
        expect.anything(),
      );
      expect(mockPersistentCache.set).not.toHaveBeenCalledWith(
        'index_price_btc_usd',
        expect.anything(),
        expect.anything(),
      );
    });

    it('should continue syncing other keys when one fails', async () => {
      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce([{ instrument_name: 'BTC-TEST' }])
        .mockRejectedValueOnce(new Error('Cache read error'))
        .mockResolvedValueOnce([[1747555200000, 56.78]])
        .mockResolvedValueOnce({ trades: [] });

      await service.syncCacheToPersistentStorage();

      // Should still sync the 3 successful keys
      expect(mockPersistentCache.set).toHaveBeenCalledTimes(3);
    });

    it('should use 2-hour TTL for all synced entries', async () => {
      mockCacheManager.get = vi.fn().mockResolvedValue({ data: 'test' });

      await service.syncCacheToPersistentStorage();

      for (const call of (mockPersistentCache.set as ReturnType<typeof vi.fn>).mock.calls) {
        expect(call[2]).toBe(7200000); // 2 hours in ms
      }
    });
  });
});
