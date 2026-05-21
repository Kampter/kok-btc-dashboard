import { describe, it, expect, vi } from 'vitest';
import { groupByTenor, findNearestDelta, calculate25DeltaSkew, calculateATMIV } from './volatility';
import type { OptionSummary } from '@kok/shared-types';

// Mock optionDelta to have deterministic deltas for testing
vi.mock('./greeks', () => ({
  optionDelta: vi.fn((item: OptionSummary) => {
    // Simple mock: delta based on strike/spot ratio and type
    const ratio = item.strike / item.underlying_price;
    if (item.option_type === 'C') {
      // Call delta decreases as strike increases
      if (ratio <= 0.85) return 0.75;
      if (ratio <= 0.95) return 0.55;
      if (ratio <= 1.05) return 0.50;
      if (ratio <= 1.15) return 0.30;
      return 0.10;
    }
    // Put delta
    if (ratio >= 1.15) return -0.75;
    if (ratio >= 1.05) return -0.55;
    if (ratio >= 0.95) return -0.50;
    if (ratio >= 0.85) return -0.30;
    return -0.10;
  }),
}));

function makeOption(
  expiry: string,
  strike: number,
  type: 'C' | 'P',
  iv: number,
  underlying = 90000,
): OptionSummary {
  return {
    instrument_name: `BTC-${expiry}-${strike}-${type}`,
    strike,
    expiry,
    option_type: type,
    open_interest: 100,
    open_interest_usd: 1000000,
    volume_24h: 10,
    mark_iv: iv,
    bid_iv: 0,
    ask_iv: 0,
    underlying_price: underlying,
  };
}

describe('groupByTenor', () => {
  it('groups options by closest standard tenor', () => {
    const now = new Date();
    const d30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
    const d95 = new Date(now.getTime() + 95 * 24 * 3600 * 1000).toISOString();
    const d185 = new Date(now.getTime() + 185 * 24 * 3600 * 1000).toISOString();

    const items = [
      makeOption(d30, 90000, 'C', 60),
      makeOption(d95, 90000, 'C', 55),
      makeOption(d185, 90000, 'C', 50),
    ];

    const grouped = groupByTenor(items);

    expect(grouped.has('1M')).toBe(true);
    expect(grouped.has('3M')).toBe(true);
    expect(grouped.has('6M')).toBe(true);
    expect(grouped.get('1M')?.length).toBe(1);
    expect(grouped.get('3M')?.length).toBe(1);
    expect(grouped.get('6M')?.length).toBe(1);
    expect(grouped.get('1M')?.[0].mark_iv).toBe(60);
    expect(grouped.get('3M')?.[0].mark_iv).toBe(55);
    expect(grouped.get('6M')?.[0].mark_iv).toBe(50);
  });

  it('returns empty map for empty input', () => {
    const grouped = groupByTenor([]);
    expect(grouped.size).toBe(0);
  });

  it('skips expired options', () => {
    const past = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
    const items = [makeOption(past, 90000, 'C', 60)];
    const grouped = groupByTenor(items);
    expect(grouped.size).toBe(0);
  });
});

describe('findNearestDelta', () => {
  it('finds nearest call to target delta', () => {
    const items = [
      makeOption('2026-06-30', 75000, 'C', 60), // delta ~0.75
      makeOption('2026-06-30', 90000, 'C', 55), // delta ~0.50
      makeOption('2026-06-30', 105000, 'C', 50), // delta ~0.30
    ];

    const nearest = findNearestDelta(items, 0.25, 'C');
    expect(nearest).not.toBeNull();
    expect(nearest?.strike).toBe(105000);
  });

  it('finds nearest put to target delta', () => {
    const items = [
      makeOption('2026-06-30', 75000, 'P', 60), // delta ~-0.10
      makeOption('2026-06-30', 90000, 'P', 55), // delta ~-0.50
      makeOption('2026-06-30', 105000, 'P', 50), // delta ~-0.75
    ];

    const nearest = findNearestDelta(items, -0.25, 'P');
    expect(nearest).not.toBeNull();
    expect(nearest?.strike).toBe(75000);
  });

  it('returns null for empty list', () => {
    expect(findNearestDelta([], 0.25)).toBeNull();
  });

  it('returns null when no matching option type', () => {
    const items = [makeOption('2026-06-30', 90000, 'C', 55)];
    expect(findNearestDelta(items, -0.25, 'P')).toBeNull();
  });
});

describe('calculate25DeltaSkew', () => {
  it('calculates skew = putIV - callIV', () => {
    const items = [
      makeOption('2026-06-30', 90000, 'C', 50), // ATM call ~0.50 delta
      makeOption('2026-06-30', 105000, 'C', 55), // ~0.30 delta (nearest to 0.25)
      makeOption('2026-06-30', 90000, 'P', 52), // ATM put ~-0.50 delta
      makeOption('2026-06-30', 75000, 'P', 58), // ~-0.10 delta (nearest to -0.25 among puts with our mock)
    ];

    // With our mock, 105000-C has delta 0.30 (closest to 0.25 among calls)
    // 75000-P has delta -0.10 (closest to -0.25 among puts with our mock)
    // But wait, let me check: 75000-P with ratio 0.83 gets delta -0.30
    // Actually the mock says ratio <= 0.85 → -0.30 for puts
    // So 75000/90000 = 0.833 → delta -0.30 (closest to -0.25)
    // 105000/90000 = 1.167 → delta 0.30 (closest to 0.25 among calls)
    const skew = calculate25DeltaSkew(items);
    expect(skew).toBe(58 - 55); // putIV - callIV
  });

  it('returns null when missing call or put', () => {
    const onlyCalls = [
      makeOption('2026-06-30', 105000, 'C', 55),
    ];
    expect(calculate25DeltaSkew(onlyCalls)).toBeNull();
  });
});

describe('calculateATMIV', () => {
  it('returns ATM call IV when available', () => {
    const items = [
      makeOption('2026-06-30', 90000, 'C', 55), // ~0.50 delta (ATM)
      makeOption('2026-06-30', 105000, 'C', 50),
    ];

    const atmIV = calculateATMIV(items);
    expect(atmIV).toBe(55);
  });

  it('falls back to ATM put when no call', () => {
    const items = [
      makeOption('2026-06-30', 90000, 'P', 52), // ~-0.50 delta (ATM)
    ];

    const atmIV = calculateATMIV(items);
    expect(atmIV).toBe(52);
  });

  it('returns null for empty list', () => {
    expect(calculateATMIV([])).toBeNull();
  });
});
