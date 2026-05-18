import type { OptionSummary } from '../schemas/option.js'
import type { OptionTrade } from '../schemas/trade.js'

interface MakeOptionParams {
  strike?: number
  expiry?: string
  optionType?: 'C' | 'P'
  markIV?: number
  openInterestUSD?: number
  volume24h?: number
}

export function makeOptionSummary(overrides: MakeOptionParams = {}): OptionSummary {
  const strike = overrides.strike ?? 90000
  const type = overrides.optionType ?? 'C'
  return {
    instrument_name: `BTC-30MAY26-${strike}-${type}`,
    strike,
    expiry: overrides.expiry ?? '2026-05-30T08:00:00.000Z',
    option_type: type,
    open_interest: 100,
    open_interest_usd: overrides.openInterestUSD ?? 10000000,
    volume_24h: overrides.volume24h ?? 50,
    mark_iv: overrides.markIV ?? 60,
    bid_iv: 0,
    ask_iv: 0,
    underlying_price: 90000,
  }
}

export function makeTermStructure(): OptionSummary[] {
  const expiries = ['2026-05-23', '2026-05-30', '2026-06-27', '2026-09-26']
  return expiries.map((expiry, i) =>
    makeOptionSummary({
      expiry: `${expiry}T08:00:00.000Z`,
      markIV: 55 + i * 3,
    })
  )
}

export function makeSkewCurve(
  expiry: string = '2026-05-30T08:00:00.000Z',
  baseStrike: number = 90000,
  optionType: 'C' | 'P' = 'C'
): OptionSummary[] {
  const multipliers = [0.8, 0.9, 1.0, 1.1, 1.2]
  const strikes = multipliers.map((m) => Math.round(baseStrike * m))
  return strikes.map((strike, i) =>
    makeOptionSummary({
      strike,
      expiry,
      optionType,
      markIV: 55 + (i === 2 ? -5 : Math.abs(i - 2)) * 2,
    })
  )
}

export function makeOptionTrade(overrides: Partial<OptionTrade> = {}): OptionTrade {
  return {
    trade_id: overrides.trade_id ?? 't-mock',
    timestamp: overrides.timestamp ?? Date.now(),
    instrument_name: overrides.instrument_name ?? 'BTC-30MAY26-90000-C',
    option_type: overrides.option_type ?? 'C',
    direction: overrides.direction ?? 'buy',
    amount: overrides.amount ?? 10,
    price: overrides.price ?? 0.05,
    index_price: overrides.index_price ?? 90000,
  }
}
