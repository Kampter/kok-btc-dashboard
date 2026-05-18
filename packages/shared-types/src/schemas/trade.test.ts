import { describe, it, expect } from 'vitest'
import { OptionTradeSchema } from './trade.js'

describe('OptionTradeSchema', () => {
  const valid = {
    trade_id: 't-001',
    timestamp: 1747555200000,
    instrument_name: 'BTC-30MAY26-90000-C',
    option_type: 'C' as const,
    direction: 'buy',
    amount: 50.0,
    price: 0.046,
    index_price: 89950,
  }

  it('accepts valid trade', () => {
    expect(() => OptionTradeSchema.parse(valid)).not.toThrow()
  })

  it('rejects invalid direction', () => {
    expect(() => OptionTradeSchema.parse({ ...valid, direction: 'hold' })).toThrow()
  })
})
