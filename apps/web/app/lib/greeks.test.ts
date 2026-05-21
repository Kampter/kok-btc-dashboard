import { describe, it, expect } from 'vitest';
import {
  normalCDF,
  blackScholesD1,
  callDelta,
  putDelta,
  optionDelta,
} from './greeks';
import type { OptionSummary } from '@kok/shared-types';

describe('normalCDF', () => {
  it('returns 0.5 for x = 0', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 6);
  });

  it('returns ~0.1587 for x = -1', () => {
    expect(normalCDF(-1)).toBeCloseTo(0.158655, 4);
  });

  it('returns ~0.8413 for x = 1', () => {
    expect(normalCDF(1)).toBeCloseTo(0.841345, 4);
  });

  it('returns ~0.0228 for x = -2', () => {
    expect(normalCDF(-2)).toBeCloseTo(0.02275, 4);
  });

  it('returns ~0.9772 for x = 2', () => {
    expect(normalCDF(2)).toBeCloseTo(0.97725, 4);
  });

  it('returns 1 for Infinity', () => {
    expect(normalCDF(Infinity)).toBe(1);
  });

  it('returns 0 for -Infinity', () => {
    expect(normalCDF(-Infinity)).toBe(0);
  });
});

describe('blackScholesD1', () => {
  it('returns positive d1 when S > K with ATM volatility', () => {
    const d1 = blackScholesD1(100, 90, 1, 0.2, 0.05);
    expect(d1).toBeGreaterThan(0);
  });

  it('returns negative d1 when S < K', () => {
    const d1 = blackScholesD1(80, 100, 1, 0.2, 0.05);
    expect(d1).toBeLessThan(0);
  });

  it('handles edge case with T <= 0', () => {
    expect(blackScholesD1(100, 90, 0, 0.2, 0.05)).toBe(Infinity);
    expect(blackScholesD1(80, 100, 0, 0.2, 0.05)).toBe(-Infinity);
  });
});

describe('callDelta', () => {
  it('returns ~0.6368 for ATM option with standard params', () => {
    // S=100, K=100, T=1, σ=0.2, r=0.05
    // d1 = (0 + (0.05 + 0.02) * 1) / 0.2 = 0.35
    // N(0.35) ≈ 0.6368
    const delta = callDelta(100, 100, 1, 0.2, 0.05);
    expect(delta).toBeCloseTo(0.6368, 3);
  });

  it('returns close to 0.5 for ATM option with r=0', () => {
    const delta = callDelta(100, 100, 0.5, 0.3, 0);
    expect(delta).toBeCloseTo(0.5, 1);
  });

  it('returns close to 1 for deep ITM call', () => {
    const delta = callDelta(150, 100, 1, 0.2, 0.05);
    expect(delta).toBeGreaterThan(0.95);
  });

  it('returns close to 0 for deep OTM call', () => {
    const delta = callDelta(50, 100, 1, 0.2, 0.05);
    expect(delta).toBeLessThan(0.05);
  });
});

describe('putDelta', () => {
  it('returns ~-0.3632 for ATM put with standard params', () => {
    // Put-Call parity: Put delta = Call delta - 1
    const callD = callDelta(100, 100, 1, 0.2, 0.05);
    const putD = putDelta(100, 100, 1, 0.2, 0.05);
    expect(putD).toBeCloseTo(callD - 1, 6);
    expect(putD).toBeCloseTo(-0.3632, 3);
  });

  it('returns close to 0 for deep OTM put', () => {
    const delta = putDelta(150, 100, 1, 0.2, 0.05);
    expect(delta).toBeGreaterThan(-0.05);
    expect(delta).toBeLessThan(0);
  });

  it('returns close to -1 for deep ITM put', () => {
    const delta = putDelta(50, 100, 1, 0.2, 0.05);
    expect(delta).toBeLessThan(-0.95);
  });
});

describe('optionDelta', () => {
  it('calculates call delta from OptionSummary', () => {
    const item: OptionSummary = {
      instrument_name: 'BTC-30MAY26-90000-C',
      strike: 90000,
      expiry: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      option_type: 'C',
      open_interest: 100,
      open_interest_usd: 1000000,
      volume_24h: 10,
      mark_iv: 60,
      bid_iv: 0,
      ask_iv: 0,
      underlying_price: 90000,
    };

    const delta = optionDelta(item);
    // ATM call with 1 month to expiry and 60% vol should be around 0.5
    expect(delta).toBeGreaterThan(0.4);
    expect(delta).toBeLessThan(0.6);
  });

  it('calculates put delta from OptionSummary', () => {
    const item: OptionSummary = {
      instrument_name: 'BTC-30MAY26-90000-P',
      strike: 90000,
      expiry: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      option_type: 'P',
      open_interest: 100,
      open_interest_usd: 1000000,
      volume_24h: 10,
      mark_iv: 60,
      bid_iv: 0,
      ask_iv: 0,
      underlying_price: 90000,
    };

    const delta = optionDelta(item);
    // ATM put should be around -0.5
    expect(delta).toBeGreaterThan(-0.6);
    expect(delta).toBeLessThan(-0.4);
  });

  it('returns higher delta for ITM call', () => {
    const otm: OptionSummary = {
      instrument_name: 'BTC-30MAY26-110000-C',
      strike: 110000,
      expiry: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      option_type: 'C',
      open_interest: 100,
      open_interest_usd: 1000000,
      volume_24h: 10,
      mark_iv: 60,
      bid_iv: 0,
      ask_iv: 0,
      underlying_price: 90000,
    };

    const itm: OptionSummary = {
      instrument_name: 'BTC-30MAY26-80000-C',
      strike: 80000,
      expiry: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      option_type: 'C',
      open_interest: 100,
      open_interest_usd: 1000000,
      volume_24h: 10,
      mark_iv: 60,
      bid_iv: 0,
      ask_iv: 0,
      underlying_price: 90000,
    };

    expect(optionDelta(itm)).toBeGreaterThan(optionDelta(otm));
  });
});
