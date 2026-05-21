import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotService } from './snapshot.service';
import type { DeribitService } from '../deribit/deribit.service';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockPool = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mockClient),
} as unknown as import('pg').Pool;

const mockDeribitService = {
  getBookSummaryByCurrency: vi.fn(),
  getIndexPrice: vi.fn(),
} as unknown as DeribitService;

describe('SnapshotService', () => {
  let service: SnapshotService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SnapshotService(mockPool, mockDeribitService);
  });

  describe('onModuleInit', () => {
    it('should create tables, indexes, and run schema migration', async () => {
      mockPool.query = vi.fn().mockResolvedValue({ rows: [] });

      await service.onModuleInit();

      // 5 ensureTables calls + 1 migrateSchema column check
      expect(mockPool.query).toHaveBeenCalledTimes(6);
      const calls = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS market_snapshots');
      expect(calls[1][0]).toContain('CREATE INDEX IF NOT EXISTS idx_market_snapshots_time');
      expect(calls[2][0]).toContain('CREATE TABLE IF NOT EXISTS contract_snapshots');
      expect(calls[3][0]).toContain('CREATE INDEX IF NOT EXISTS idx_contract_snapshots_snapshot');
      expect(calls[4][0]).toContain('CREATE INDEX IF NOT EXISTS idx_contract_snapshots_instrument');
      expect(calls[5][0]).toContain("SELECT column_name");
    });
  });

  describe('collectSnapshot', () => {
    it('should propagate error when deribit book summary fails', async () => {
      vi.mocked(mockDeribitService.getBookSummaryByCurrency).mockRejectedValue(new Error('API error'));

      await expect(service.collectSnapshot()).rejects.toThrow('API error');
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should propagate error when deribit index price fails', async () => {
      vi.mocked(mockDeribitService.getBookSummaryByCurrency).mockResolvedValue([
        { instrument_name: 'BTC-30MAY26-100000-C', open_interest: 100 },
      ]);
      vi.mocked(mockDeribitService.getIndexPrice).mockRejectedValue(new Error('API error'));

      await expect(service.collectSnapshot()).rejects.toThrow('API error');
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should calculate OI-weighted atm_iv and put_ratio correctly', async () => {
      const bookData = [
        {
          instrument_name: 'BTC-30MAY26-100000-C',
          open_interest: 100,
          volume_usd: 50000,
          underlying_price: 100000,
          mark_iv: 60,
          bid_iv: 59,
          ask_iv: 61,
          strike: 100000,
        },
        {
          instrument_name: 'BTC-30MAY26-102000-C',
          open_interest: 200,
          volume_usd: 30000,
          underlying_price: 100000,
          mark_iv: 70,
          bid_iv: 69,
          ask_iv: 71,
          strike: 102000,
        },
        {
          instrument_name: 'BTC-30MAY26-95000-P',
          open_interest: 300,
          volume_usd: 20000,
          underlying_price: 100000,
          mark_iv: 80,
          bid_iv: 79,
          ask_iv: 81,
          strike: 95000,
        },
      ];
      const indexData = { index_price: 100000 };

      vi.mocked(mockDeribitService.getBookSummaryByCurrency).mockResolvedValue(bookData);
      vi.mocked(mockDeribitService.getIndexPrice).mockResolvedValue(indexData);

      // Sequence: BEGIN, market INSERT, contract INSERT, COMMIT
      mockClient.query = vi.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // market_snapshots
        .mockResolvedValueOnce({}) // contract_snapshots
        .mockResolvedValueOnce({}); // COMMIT

      await service.collectSnapshot();

      // Verify transaction flow
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledTimes(4);

      // Check BEGIN
      expect(mockClient.query.mock.calls[0][0]).toBe('BEGIN');

      // Check market_snapshots INSERT uses put_ratio (not pc_ratio)
      const marketInsertCall = mockClient.query.mock.calls[1];
      expect(marketInsertCall[0]).toContain('INSERT INTO market_snapshots');
      expect(marketInsertCall[0]).toContain('put_ratio');
      expect(marketInsertCall[0]).not.toContain('pc_ratio');

      // Verify btc_price
      expect(marketInsertCall[1]).toContain(100000);

      // total_oi_usd = (100 + 200 + 300) * 100000 = 60,000,000
      expect(marketInsertCall[1]).toContain(60000000);

      // total_volume_24h_usd = 50000 + 30000 + 20000 = 100000
      expect(marketInsertCall[1]).toContain(100000);

      // atm_iv (OI-weighted): (60 * 10M + 70 * 20M) / (10M + 20M) = 66.67
      // 95000-P is outside ±2% range (95000 < 98000)
      const expectedAtmIV = (60 * 100 * 100000 + 70 * 200 * 100000) / (100 * 100000 + 200 * 100000);
      expect(marketInsertCall[1]).toContain(expectedAtmIV);

      // put_ratio = put_oi / (put_oi + call_oi) = 30M / 60M = 0.5
      expect(marketInsertCall[1]).toContain(0.5);

      // Check contract_snapshots INSERT
      const contractInsertCall = mockClient.query.mock.calls[2];
      expect(contractInsertCall[0]).toContain('INSERT INTO contract_snapshots');

      // Check COMMIT
      expect(mockClient.query.mock.calls[3][0]).toBe('COMMIT');

      // Check client released
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should skip contract insert when snapshot already exists for the same minute', async () => {
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

      vi.mocked(mockDeribitService.getBookSummaryByCurrency).mockResolvedValue(bookData);
      vi.mocked(mockDeribitService.getIndexPrice).mockResolvedValue(indexData);

      // ON CONFLICT DO NOTHING returns no rows
      mockClient.query = vi.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // market_snapshots (conflict)
        .mockResolvedValueOnce({}); // COMMIT

      await service.collectSnapshot();

      // Should call BEGIN, INSERT, COMMIT — no contract insert
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(mockClient.query.mock.calls[1][0]).toContain('INSERT INTO market_snapshots');
      expect(mockClient.query.mock.calls[2][0]).toBe('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback on contract insert failure', async () => {
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

      vi.mocked(mockDeribitService.getBookSummaryByCurrency).mockResolvedValue(bookData);
      vi.mocked(mockDeribitService.getIndexPrice).mockResolvedValue(indexData);

      mockClient.query = vi.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // market_snapshots
        .mockRejectedValueOnce(new Error('DB error')) // contract_snapshots fails
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(service.collectSnapshot()).rejects.toThrow('DB error');

      // Should rollback
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
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

      vi.mocked(mockDeribitService.getBookSummaryByCurrency).mockResolvedValue(bookData);
      vi.mocked(mockDeribitService.getIndexPrice).mockResolvedValue(indexData);

      mockClient.query = vi.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // market_snapshots
        .mockResolvedValueOnce({}) // contract_snapshots
        .mockResolvedValueOnce({}); // COMMIT

      await service.collectSnapshot();

      // Should still succeed with only the valid instrument
      const contractCall = mockClient.query.mock.calls[2];
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
