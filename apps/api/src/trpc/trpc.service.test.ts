import { Test } from '@nestjs/testing'
import { describe, it, expect, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { TrpcService } from './trpc.service'
import { DeribitService } from '../deribit/deribit.service'
import { rawBookSummaryBTC, rawIndexPriceBTC, rawHistoricalVolatilityBTC, rawTradesBTC } from '@kok/shared-types/fixtures'

describe('TrpcService', () => {
  async function createCaller() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrpcService,
        {
          provide: DeribitService,
          useValue: {
            getBookSummaryByCurrency: vi.fn(),
            getIndexPrice: vi.fn(),
            getHistoricalVolatility: vi.fn(),
            getLastTradesByCurrency: vi.fn(),
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
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(rawBookSummaryBTC as any)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue(rawIndexPriceBTC as any)
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
      ] as any)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue(rawIndexPriceBTC as any)
      const result = await caller.deribit.marketOverview()
      expect(result.atmIV).toBe(0)
    })
  })

  describe('bookSummary', () => {
    it('transforms raw Deribit data to OptionSummary schema', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(rawBookSummaryBTC as any)
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
      vi.mocked(deribitService.getLastTradesByCurrency).mockResolvedValue(rawTradesBTC as any)
      const result = await caller.deribit.trades({ currency: 'BTC', count: 10 })
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ trade_id: 't-001', direction: 'buy' })
    })
  })

  describe('historicalVolatility', () => {
    it('returns {timestamp, volatility} pairs', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getHistoricalVolatility).mockResolvedValue(rawHistoricalVolatilityBTC as any)
      const result = await caller.deribit.historicalVolatility({ currency: 'BTC' })
      expect(result).toHaveLength(7)
      expect(result[0]).toEqual({ timestamp: 1747468800000, volatility: 55.32 })
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
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(rawBookSummaryBTC as any)
      vi.mocked(deribitService.getIndexPrice).mockResolvedValue({ index_price: 0, estimated_delivery_price: 0 } as any)

      const result = await caller.deribit.marketOverview()

      expect(result.btcPrice).toBe(0)
      expect(result.totalOI).toBe(0)
      expect(result.totalVolume24h).toBe(0)
      expect(result.atmIV).toBe(0)
    })

    it('bookSummary handles empty data array', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue([] as any)

      const result = await caller.deribit.bookSummary({ currency: 'BTC', kind: 'option' })

      expect(result).toEqual([])
    })

    it('trades handles empty trades array', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getLastTradesByCurrency).mockResolvedValue({ trades: [] } as any)

      const result = await caller.deribit.trades({ currency: 'BTC', count: 10 })

      expect(result).toEqual([])
    })

    it('historicalVolatility handles empty data', async () => {
      const { caller, deribitService } = await createCaller()
      vi.mocked(deribitService.getHistoricalVolatility).mockResolvedValue([] as any)

      const result = await caller.deribit.historicalVolatility({ currency: 'BTC' })

      expect(result).toEqual([])
    })
  })
})
