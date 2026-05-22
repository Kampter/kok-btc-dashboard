import { Test } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { TRPCError } from '@trpc/server'
import { TrpcService } from './trpc.service'
import { DeribitService } from '../deribit/deribit.service'
import { ChatRouter } from '../chat/chat.router'
import { ChatService } from '../chat/chat.service'
import { GreeksService } from '../greeks/greeks.service'
import { RsMonitorService } from '../rs-monitor/rs-monitor.service'
import { rawBookSummaryBTC, rawIndexPriceBTC, rawHistoricalVolatilityBTC, rawTradesBTC } from '@kok/shared-types/fixtures'

describe('TrpcService', () => {
  beforeAll(() => {
    vi.stubEnv('MOONSHOT_API_KEY', 'test-key')
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })


  async function createCaller() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrpcService,
        ChatRouter,
        ChatService,
        GreeksService,
        {
          provide: DeribitService,
          useValue: {
            getBookSummaryByCurrency: vi.fn(),
            getIndexPrice: vi.fn(),
            getHistoricalVolatility: vi.fn(),
            getLastTradesByCurrency: vi.fn(),
            getInstruments: vi.fn(),
            getTicker: vi.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
          },
        },
        {
          provide: GreeksService,
          useValue: {
            getExposure: vi.fn().mockResolvedValue({
              currency: 'BTC',
              total_gex: 0,
              total_dex: 0,
              zero_gamma_strike: null,
              call_wall: null,
              put_wall: null,
              by_strike: [],
              progress: { total: 0, completed: 0, is_complete: true },
              timestamp: new Date().toISOString(),
            }),
          },
        },
        {
          provide: RsMonitorService,
          useValue: {
            getLatestScores: vi.fn().mockResolvedValue([]),
            getScoreHistory: vi.fn().mockResolvedValue([]),
            getTokenChartData: vi.fn().mockResolvedValue({ tokenSymbol: '', points: [] }),
          },
        },
      ],
    }).compile()

    const trpcService = moduleRef.get(TrpcService)
    const caller = trpcService.appRouter.createCaller({})
    return {
      caller,
      deribitService: moduleRef.get(DeribitService),
    }
  }

  describe('marketOverview', () => {
    it('aggregates book data and index price', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(rawBookSummaryBTC)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue(rawIndexPriceBTC)
      const result = await caller.deribit.marketOverview()
      expect(result.btcPrice).toBe(89950.5)
      expect(result.totalOI).toBeGreaterThan(0)
      expect(result.totalVolume24h).toBeGreaterThan(0)
      expect(result.atmIV).toBeGreaterThan(0)
      expect(typeof result.timestamp).toBe('string')
    })

    it('returns zero atmIV when no strikes near spot', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue([
        { ...rawBookSummaryBTC[0], instrument_name: 'BTC-30MAY26-50000-C', mark_iv: 70 },
      ])
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue(rawIndexPriceBTC)
      const result = await caller.deribit.marketOverview()
      expect(result.atmIV).toBe(0)
    })
  })

  describe('bookSummary', () => {
    it('transforms raw Deribit data to OptionSummary schema', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(rawBookSummaryBTC)
      const result = await caller.deribit.bookSummary({ currency: 'BTC', kind: 'option' })
      expect(result).toHaveLength(4)
      expect(result[0]).toMatchObject({
        instrument_name: 'BTC-30MAY26-90000-C',
        strike: 90000,
        option_type: 'C',
      })
      expect(result[0].expiry).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('trades', () => {
    it('returns transformed trades', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getLastTradesByCurrency).mockResolvedValue(rawTradesBTC)
      const result = await caller.deribit.trades({ currency: 'BTC', count: 10 })
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ trade_id: 't-001', direction: 'buy' })
    })
  })

  describe('historicalVolatility', () => {
    it('returns {timestamp, volatility} pairs', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getHistoricalVolatility).mockResolvedValue(rawHistoricalVolatilityBTC)
      const result = await caller.deribit.historicalVolatility({ currency: 'BTC' })
      expect(result).toHaveLength(7)
      expect(result[0]).toEqual({ timestamp: 1747468800000, volatility: 55.32 })
    })
  })

  describe('oiDistribution', () => {
    const mockBookData = [
      // Expiry 2026-05-30
      { instrument_name: 'BTC-30MAY26-70000-C', strike: 70000, expiry: 1748620800000, option_type: 'C', open_interest: 1000000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-70000-P', strike: 70000, expiry: 1748620800000, option_type: 'P', open_interest: 3000000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-80000-C', strike: 80000, expiry: 1748620800000, option_type: 'C', open_interest: 5000000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-80000-P', strike: 80000, expiry: 1748620800000, option_type: 'P', open_interest: 1000000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-90000-C', strike: 90000, expiry: 1748620800000, option_type: 'C', open_interest: 2000000, underlying_price: 90000 },
      { instrument_name: 'BTC-30MAY26-90000-P', strike: 90000, expiry: 1748620800000, option_type: 'P', open_interest: 500000, underlying_price: 90000 },
      // Expiry 2026-06-27 (low OI, should be filtered out: 100 * 90000 = 9M < 100M threshold)
      { instrument_name: 'BTC-27JUN26-85000-C', strike: 85000, expiry: 1751001600000, option_type: 'C', open_interest: 100, underlying_price: 90000 },
    ]

    it('returns OI distribution for the nearest expiry by default', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(mockBookData)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 90000, estimated_delivery_price: 90000 })

      const result = await caller.deribit.oiDistribution({ currency: 'BTC' })

      expect(result.expiries).toHaveLength(1)
      expect(result.selected.strike_distribution).toHaveLength(3)
      // Call weighted center: (70000*1000 + 80000*5000 + 90000*2000) / 8000 = 81250
      expect(result.selected.resistance).toBeCloseTo(81250, 0)
      // Put weighted center: (70000*3000 + 80000*1000 + 90000*500) / 4500 = 74444...
      expect(result.selected.support).toBeCloseTo(74444, 0)
      // Max Pain at $80000 (minimizes total intrinsic value)
      expect(result.selected.max_pain).toBe(80000)
    })

    it('returns specific expiry when provided', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(mockBookData)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 90000, estimated_delivery_price: 90000 })

      const result = await caller.deribit.oiDistribution({
        currency: 'BTC',
        expiry: '2026-05-30T08:00:00.000Z',
      })

      expect(result.selected.expiry).toBe('2026-05-30T08:00:00.000Z')
      expect(result.selected.strike_distribution).toHaveLength(3)
    })

    it('returns empty distribution when no valid expiries', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue([
        { instrument_name: 'BTC-30MAY26-70000-C', strike: 70000, expiry: 1748620800000, option_type: 'C', open_interest: 1, underlying_price: 90000 },
      ])
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 90000, estimated_delivery_price: 90000 })

      const result = await caller.deribit.oiDistribution({ currency: 'BTC' })

      expect(result.expiries).toEqual([])
      expect(result.selected.strike_distribution).toEqual([])
    })

    it('handles DeribitService failure', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockRejectedValue(new Error('Service down'))

      await expect(caller.deribit.oiDistribution({ currency: 'BTC' })).rejects.toThrow(TRPCError)
    })
  })

  describe('error handling', () => {
    it('all procedures throw TRPCError on DeribitService failure', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockRejectedValue(new Error('Service down'))
      vi.mocked(deribitService.getIndexPrice).mockRejectedValue(new Error('Service down'))

      await expect(caller.deribit.marketOverview()).rejects.toThrow(TRPCError)
    })

    it('marketOverview handles zero btcPrice', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(rawBookSummaryBTC)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 0, estimated_delivery_price: 0 })

      const result = await caller.deribit.marketOverview()

      expect(result.btcPrice).toBe(0)
      expect(result.totalOI).toBe(0)
      expect(result.totalVolume24h).toBe(0)
      expect(result.atmIV).toBe(0)
    })

    it('bookSummary handles empty data array', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue([])

      const result = await caller.deribit.bookSummary({ currency: 'BTC', kind: 'option' })

      expect(result).toEqual([])
    })

    it('trades handles empty trades array', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getLastTradesByCurrency).mockResolvedValue({ trades: [] })

      const result = await caller.deribit.trades({ currency: 'BTC', count: 10 })

      expect(result).toEqual([])
    })

    it('historicalVolatility handles empty data', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getHistoricalVolatility).mockResolvedValue([])

      const result = await caller.deribit.historicalVolatility({ currency: 'BTC' })

      expect(result).toEqual([])
    })
  })
})
