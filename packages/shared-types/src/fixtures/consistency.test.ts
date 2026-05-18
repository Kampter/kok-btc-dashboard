import { describe, it, expect } from 'vitest'
import { OptionSummarySchema, MarketOverviewSchema, ExpirySummarySchema } from '../schemas/option.js'
import { OptionTradeSchema } from '../schemas/trade.js'
import { mockOptionSummaries } from './derived/optionSummary.js'
import { mockMarketOverview } from './derived/marketOverview.js'
import { mockExpirySummaries } from './derived/expirySummary.js'
import { mockOptionTrades } from './derived/optionTrades.js'

describe('fixtures consistency', () => {
  it('mockOptionSummaries pass Zod validation', () => {
    for (const item of mockOptionSummaries) {
      const result = OptionSummarySchema.safeParse(item)
      expect(result.success).toBe(true)
    }
  })

  it('mockMarketOverview passes Zod validation', () => {
    const result = MarketOverviewSchema.safeParse(mockMarketOverview)
    expect(result.success).toBe(true)
  })

  it('mockExpirySummaries pass Zod validation', () => {
    for (const item of mockExpirySummaries) {
      const result = ExpirySummarySchema.safeParse(item)
      expect(result.success).toBe(true)
    }
  })

  it('mockOptionTrades pass Zod validation', () => {
    for (const item of mockOptionTrades) {
      const result = OptionTradeSchema.safeParse(item)
      expect(result.success).toBe(true)
    }
  })
})
