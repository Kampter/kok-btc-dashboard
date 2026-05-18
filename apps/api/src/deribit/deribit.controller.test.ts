import { Test } from '@nestjs/testing'
import { describe, it, expect, vi } from 'vitest'
import { DeribitController } from './deribit.controller'
import { DeribitService } from './deribit.service'
import { rawBookSummaryBTC, rawIndexPriceBTC } from '@kok/shared-types/fixtures'

describe('DeribitController', () => {
  async function createController() {
    const moduleRef = await Test.createTestingModule({
      controllers: [DeribitController],
      providers: [
        {
          provide: DeribitService,
          useValue: {
            getBookSummaryByCurrency: vi.fn(),
            getIndexPrice: vi.fn(),
          },
        },
      ],
    }).compile()

    const controller = moduleRef.get(DeribitController)
    const deribitService = moduleRef.get(DeribitService)
    return { controller, deribitService }
  }

  it('returns book summary via GET', async () => {
    const { controller, deribitService } = await createController()
    vi.mocked(deribitService.getBookSummaryByCurrency).mockResolvedValue(rawBookSummaryBTC)

    const result = await controller.getBookSummary('BTC', 'option')

    expect(deribitService.getBookSummaryByCurrency).toHaveBeenCalledWith('BTC', 'option')
    expect(result).toEqual(rawBookSummaryBTC)
  })

  it('returns index price via GET', async () => {
    const { controller, deribitService } = await createController()
    vi.mocked(deribitService.getIndexPrice).mockResolvedValue(rawIndexPriceBTC)

    const result = await controller.getIndexPrice('btc_usd')

    expect(deribitService.getIndexPrice).toHaveBeenCalledWith('btc_usd')
    expect(result).toEqual(rawIndexPriceBTC)
  })
})
