import type { OptionSummary } from '../../schemas/option.js'

/**
 * Mock OptionSummary fixtures for testing.
 * Covers 3 tenors (1M, 3M, 6M) with strikes near ATM and 25-delta.
 * underlying_price = 89950 for all.
 *
 * Delta verification (using real Black-Scholes):
 * 1M (T≈0.0247, σ≈0.62):
 *   - 90000-C: delta≈0.52 (ATM)
 *   - 96000-C: delta≈0.27 (≈25Δ)
 *   - 90000-P: delta≈-0.48 (ATM)
 *   - 85000-P: delta≈-0.27 (≈-25Δ)
 * 3M (T≈0.101, σ≈0.58):
 *   - 90000-C: delta≈0.54 (ATM)
 *   - 103000-C: delta≈0.26 (≈25Δ)
 *   - 90000-P: delta≈-0.46 (ATM)
 *   - 81000-P: delta≈-0.25 (≈-25Δ)
 * 6M (T≈0.274, σ≈0.52):
 *   - 90000-C: delta≈0.55 (ATM)
 *   - 111000-C: delta≈0.26 (≈25Δ)
 *   - 90000-P: delta≈-0.45 (ATM)
 *   - 78000-P: delta≈-0.25 (≈-25Δ)
 */
export const mockOptionSummaries: OptionSummary[] = [
  // === 1M tenor (2026-05-30) ===
  {
    instrument_name: 'BTC-30MAY26-90000-C',
    strike: 90000,
    expiry: '2026-05-30T08:00:00.000Z',
    option_type: 'C',
    open_interest: 1523.5,
    open_interest_usd: 137115000,
    volume_24h: 245.0,
    mark_iv: 62.34,
    bid_iv: 61.5,
    ask_iv: 63.2,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-30MAY26-96000-C',
    strike: 96000,
    expiry: '2026-05-30T08:00:00.000Z',
    option_type: 'C',
    open_interest: 892.1,
    open_interest_usd: 85642000,
    volume_24h: 128.5,
    mark_iv: 64.12,
    bid_iv: 63.0,
    ask_iv: 65.2,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-30MAY26-90000-P',
    strike: 90000,
    expiry: '2026-05-30T08:00:00.000Z',
    option_type: 'P',
    open_interest: 1100.2,
    open_interest_usd: 99018000,
    volume_24h: 180.3,
    mark_iv: 63.80,
    bid_iv: 62.8,
    ask_iv: 64.8,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-30MAY26-85000-P',
    strike: 85000,
    expiry: '2026-05-30T08:00:00.000Z',
    option_type: 'P',
    open_interest: 756.4,
    open_interest_usd: 64294000,
    volume_24h: 95.7,
    mark_iv: 65.50,
    bid_iv: 64.5,
    ask_iv: 66.5,
    underlying_price: 89950,
  },

  // === 3M tenor (2026-06-27) ===
  {
    instrument_name: 'BTC-27JUN26-90000-C',
    strike: 90000,
    expiry: '2026-06-27T08:00:00.000Z',
    option_type: 'C',
    open_interest: 2341.2,
    open_interest_usd: 222414000,
    volume_24h: 512.0,
    mark_iv: 58.45,
    bid_iv: 57.5,
    ask_iv: 59.4,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-27JUN26-103000-C',
    strike: 103000,
    expiry: '2026-06-27T08:00:00.000Z',
    option_type: 'C',
    open_interest: 567.3,
    open_interest_usd: 58431900,
    volume_24h: 89.4,
    mark_iv: 60.20,
    bid_iv: 59.0,
    ask_iv: 61.4,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-27JUN26-90000-P',
    strike: 90000,
    expiry: '2026-06-27T08:00:00.000Z',
    option_type: 'P',
    open_interest: 1890.5,
    open_interest_usd: 169995500,
    volume_24h: 340.2,
    mark_iv: 59.80,
    bid_iv: 58.8,
    ask_iv: 60.8,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-27JUN26-81000-P',
    strike: 81000,
    expiry: '2026-06-27T08:00:00.000Z',
    option_type: 'P',
    open_interest: 445.8,
    open_interest_usd: 36109800,
    volume_24h: 67.1,
    mark_iv: 61.50,
    bid_iv: 60.5,
    ask_iv: 62.5,
    underlying_price: 89950,
  },

  // === 6M tenor (2026-08-29) ===
  {
    instrument_name: 'BTC-29AUG26-90000-C',
    strike: 90000,
    expiry: '2026-08-29T08:00:00.000Z',
    option_type: 'C',
    open_interest: 1567.8,
    open_interest_usd: 141102000,
    volume_24h: 289.3,
    mark_iv: 52.30,
    bid_iv: 51.5,
    ask_iv: 53.1,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-29AUG26-111000-C',
    strike: 111000,
    expiry: '2026-08-29T08:00:00.000Z',
    option_type: 'C',
    open_interest: 312.4,
    open_interest_usd: 34676640,
    volume_24h: 45.6,
    mark_iv: 54.10,
    bid_iv: 53.0,
    ask_iv: 55.2,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-29AUG26-90000-P',
    strike: 90000,
    expiry: '2026-08-29T08:00:00.000Z',
    option_type: 'P',
    open_interest: 1234.5,
    open_interest_usd: 111105000,
    volume_24h: 210.5,
    mark_iv: 53.80,
    bid_iv: 52.8,
    ask_iv: 54.8,
    underlying_price: 89950,
  },
  {
    instrument_name: 'BTC-29AUG26-78000-P',
    strike: 78000,
    expiry: '2026-08-29T08:00:00.000Z',
    option_type: 'P',
    open_interest: 278.6,
    open_interest_usd: 21730800,
    volume_24h: 38.9,
    mark_iv: 55.20,
    bid_iv: 54.2,
    ask_iv: 56.2,
    underlying_price: 89950,
  },
]
