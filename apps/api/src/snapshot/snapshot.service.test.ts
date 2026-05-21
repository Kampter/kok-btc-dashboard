import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotService } from './snapshot.service';

const mockPool = {
  query: vi.fn(),
} as unknown as import('pg').Pool;

const mockCacheManager = {
  get: vi.fn(),
} as unknown as import('cache-manager').Cache;

describe('SnapshotService', () => {
  let service: SnapshotService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SnapshotService(mockPool, mockCacheManager);
  });

  describe('onModuleInit', () => {
    it('should create tables and indexes', async () => {
      mockPool.query = vi.fn().mockResolvedValue({});

      await service.onModuleInit();

      expect(mockPool.query).toHaveBeenCalledTimes(5);
      const calls = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS market_snapshots');
      expect(calls[1][0]).toContain('CREATE INDEX IF NOT EXISTS idx_market_snapshots_time');
      expect(calls[2][0]).toContain('CREATE TABLE IF NOT EXISTS contract_snapshots');
      expect(calls[3][0]).toContain('CREATE INDEX IF NOT EXISTS idx_contract_snapshots_snapshot');
      expect(calls[4][0]).toContain('CREATE INDEX IF NOT EXISTS idx_contract_snapshots_instrument');
    });
  });

  describe('collectSnapshot', () => {
    it('should skip when book_summary cache is empty', async () => {
      mockCacheManager.get = vi.fn().mockResolvedValue(null);

      await service.collectSnapshot();

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should skip when index_price cache is empty', async () => {
      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce([{ instrument_name: 'BTC-30MAY26-100000-C', open_interest: 100 }])
        .mockResolvedValueOnce(null);

      await service.collectSnapshot();

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should calculate market aggregates correctly', async () => {
      const bookData = [
        {
          instrument_name: 'BTC-30MAY26-100000-C',
          open_interest: 100,
          volume_usd: 50000,
          underlying_price: 100000,
          mark_iv: 65,
          bid_iv: 64,
          ask_iv: 66,
          strike: 100000,
        },
        {
          instrument_name: 'BTC-30MAY26-95000-P',
          open_interest: 200,
          volume_usd: 30000,
          underlying_price: 100000,
          mark_iv: 70,
          bid_iv: 69,
          ask_iv: 71,
          strike: 95000,
        },
      ];
      const indexData = { index_price: 100000 };

      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce(bookData)
        .mockResolvedValueOnce(indexData);

      // Mock the INSERT returning snapshot_id = 1
      mockPool.query = vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // market_snapshots INSERT
        .mockResolvedValueOnce({}); // contract_snapshots batch INSERT

      await service.collectSnapshot();

      // Verify market_snapshots was called with correct aggregates
      const marketSnapshotCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(marketSnapshotCall[0]).toContain('INSERT INTO market_snapshots');
      // btc_price = 100000
      expect(marketSnapshotCall[1]).toContain(100000);
      // total_oi_usd = (100 + 200) * 100000 = 30,000,000
      expect(marketSnapshotCall[1]).toContain(30000000);
      // total_volume_24h_usd = 50000 + 30000 = 80000
      expect(marketSnapshotCall[1]).toContain(80000);
    });

    it('should skip when snapshot already exists for the same minute', async () => {
      const bookData = [
        {
          instrument_name: 'BTC-30MAY26-100000-C',
          open_interest: 100,
          volume_usd: 50000,
          underlying_price: 100000,
          mark_iv: 65,
          bid_iv: 64,
          ask_iv: 66,
        },
      ];
      const indexData = { index_price: 100000 };

      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce(bookData)
        .mockResolvedValueOnce(indexData);

      // ON CONFLICT DO NOTHING returns no rows
      mockPool.query = vi.fn()
        .mockResolvedValueOnce({ rows: [] });

      await service.collectSnapshot();

      // Should only call market_snapshots INSERT, not contract_snapshots
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should handle instruments that fail parsing gracefully', async () => {
      const bookData = [
        {
          instrument_name: 'INVALID-NAME',
          open_interest: 100,
          volume_usd: 50000,
          underlying_price: 100000,
          mark_iv: 65,
          bid_iv: 64,
          ask_iv: 66,
        },
        {
          instrument_name: 'BTC-30MAY26-100000-C',
          open_interest: 200,
          volume_usd: 30000,
          underlying_price: 100000,
          mark_iv: 65,
          bid_iv: 64,
          ask_iv: 66,
        },
      ];
      const indexData = { index_price: 100000 };

      mockCacheManager.get = vi.fn()
        .mockResolvedValueOnce(bookData)
        .mockResolvedValueOnce(indexData);

      mockPool.query = vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({});

      await service.collectSnapshot();

      // Should still succeed with only the valid instrument
      const contractCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(contractCall[0]).toContain('INSERT INTO contract_snapshots');
      // Only 1 valid contract = 12 params
      expect(contractCall[1]).toHaveLength(12);
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should delete snapshots older than 90 days', async () => {
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 5 });

      await service.cleanupOldSnapshots();

      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM market_snapshots WHERE snapshot_at < NOW() - INTERVAL '90 days'",
      );
    });

    it('should not log when no old snapshots to clean', async () => {
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 0 });

      await service.cleanupOldSnapshots();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });
});
