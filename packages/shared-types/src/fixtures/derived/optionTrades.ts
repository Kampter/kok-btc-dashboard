import type { OptionTrade } from '../../schemas/trade.js'

export const mockOptionTrades: OptionTrade[] = [
  {
    trade_id: 't-001',
    timestamp: 1747555200000,
    instrument_name: 'BTC-30MAY26-90000-C',
    option_type: 'C',
    direction: 'buy',
    amount: 50.0,
    price: 0.046,
    index_price: 89950,
  },
  {
    trade_id: 't-002',
    timestamp: 1747555210000,
    instrument_name: 'BTC-30MAY26-90000-P',
    option_type: 'P',
    direction: 'sell',
    amount: 30.0,
    price: 0.039,
    index_price: 89950,
  },
  {
    trade_id: 't-003',
    timestamp: 1747555220000,
    instrument_name: 'BTC-27JUN26-95000-C',
    option_type: 'C',
    direction: 'buy',
    amount: 100.0,
    price: 0.033,
    index_price: 89950,
  },
]
