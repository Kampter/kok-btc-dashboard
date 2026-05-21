import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GreeksService } from './greeks.service';
import { DeribitService } from '../deribit/deribit.service';
import type { Cache } from 'cache-manager';

describe('GreeksService', () => {
  let service: GreeksService;
  let mockDeribitService: Partial<DeribitService>;
  let mockCacheManager: Partial<Cache>;

  beforeEach(() => {
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
    };

    mockDeribitService = {
      getInstruments: vi.fn(),
      getIndexPrice: vi.fn(),
      getTicker: vi.fn(),
    };

    service = new GreeksService(
      mockCacheManager as Cache,
      mockDeribitService as DeribitService,
    );
  });

  describe('getExposure', () => {
    it('应返回缓存中的数据', async () => {
      const cached = {
        currency: 'BTC',
        total_gex: 100,
        total_dex: 50,
        zero_gamma_strike: 80000,
        call_wall: 85000,
        put_wall: 75000,
        by_strike: [],
        progress: { total: 10, completed: 10, is_complete: true },
        timestamp: new Date().toISOString(),
      };
      vi.mocked(mockCacheManager.get!).mockResolvedValue(cached);

      const result = await service.getExposure('BTC');
      expect(result).toEqual(cached);
    });

    it('无缓存时应返回空结果', async () => {
      vi.mocked(mockCacheManager.get!).mockResolvedValue(null);

      const result = await service.getExposure('BTC');
      expect(result.currency).toBe('BTC');
      expect(result.total_gex).toBe(0);
      expect(result.progress.is_complete).toBe(false);
    });
  });

  describe('buildExposure', () => {
    it('应正确计算零 Gamma 行权价', () => {
      const results = [
        { strike: 75000, greeks: { delta: 0.3, gamma: 0.001, vega: 10, theta: -5, rho: 2 }, oi: 100, type: 'C' as const },
        { strike: 75000, greeks: { delta: -0.3, gamma: 0.001, vega: 10, theta: -5, rho: 2 }, oi: 100, type: 'P' as const },
        { strike: 80000, greeks: { delta: 0.5, gamma: 0.002, vega: 15, theta: -8, rho: 3 }, oi: 200, type: 'C' as const },
        { strike: 80000, greeks: { delta: -0.5, gamma: 0.002, vega: 15, theta: -8, rho: 3 }, oi: 200, type: 'P' as const },
        { strike: 85000, greeks: { delta: 0.7, gamma: 0.001, vega: 8, theta: -4, rho: 1 }, oi: 150, type: 'C' as const },
        { strike: 85000, greeks: { delta: -0.7, gamma: 0.001, vega: 8, theta: -4, rho: 1 }, oi: 150, type: 'P' as const },
      ];

      const exposure = (service as any).buildExposure('BTC', results, 80000, { total: 6, completed: 6, is_complete: true });
      expect(exposure.currency).toBe('BTC');
      expect(exposure.by_strike).toHaveLength(3);
      expect(exposure.zero_gamma_strike).toBeDefined();
    });

    it('应识别 Call Wall 和 Put Wall', () => {
      const results = [
        { strike: 80000, greeks: { delta: 0.5, gamma: 0.01, vega: 10, theta: -5, rho: 2 }, oi: 100, type: 'C' as const },
        { strike: 80000, greeks: { delta: -0.3, gamma: 0.001, vega: 5, theta: -2, rho: 1 }, oi: 50, type: 'P' as const },
      ];

      const exposure = (service as any).buildExposure('BTC', results, 80000, { total: 2, completed: 2, is_complete: true });
      expect(exposure.call_wall).toBe(80000);
    });
  });
});
