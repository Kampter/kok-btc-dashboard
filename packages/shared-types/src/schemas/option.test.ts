import { describe, it, expect } from 'vitest'
import { OptionSummarySchema, MarketOverviewSchema, ExpirySummarySchema } from './option.js'

describe('OptionSummarySchema', () => {
  const valid = {
    instrument_name: 'BTC-30MAY26-90000-C',
    strike: 90000,
    expiry: '2026-05-30T08:00:00.000Z',
    option_type: 'C',
    open_interest: 1523.5,
    open_interest_usd: 137115000,
    volume_24h: 245.0,
    mark_iv: 62.34,
    bid_iv: 61.89,
    ask_iv: 62.78,
    underlying_price: 89950,
  }

  it('accepts valid option summary', () => {
    expect(() => OptionSummarySchema.parse(valid)).not.toThrow()
  })

  it('rejects invalid option_type', () => {
    expect(() => OptionSummarySchema.parse({ ...valid, option_type: 'X' })).toThrow()
  })

  it('rejects missing required field', () => {
    const { instrument_name, ...missingName } = valid
    expect(() => OptionSummarySchema.parse(missingName)).toThrow()
  })

  it('rejects wrong type for strike', () => {
    expect(() => OptionSummarySchema.parse({ ...valid, strike: '90000' })).toThrow()
  })
})

describe('MarketOverviewSchema', () => {
  const valid = {
    totalOI: 1000000,
    totalVolume24h: 500000,
    atmIV: 60.5,
    btcPrice: 90000,
    timestamp: '2026-05-18T10:30:00.000Z',
  }

  it('accepts valid market overview', () => {
    expect(() => MarketOverviewSchema.parse(valid)).not.toThrow()
  })

  it('rejects missing timestamp', () => {
    const { timestamp, ...missingTs } = valid
    expect(() => MarketOverviewSchema.parse(missingTs)).toThrow()
  })
})

describe('ExpirySummarySchema', () => {
  const valid = {
    expiry: '2026-05-30T08:00:00.000Z',
    totalOI: 1000000,
    callOI: 600000,
    putOI: 400000,
    atmIV: 60.5,
  }

  it('accepts valid expiry summary', () => {
    expect(() => ExpirySummarySchema.parse(valid)).not.toThrow()
  })
})
