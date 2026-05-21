import { describe, it, expect } from 'vitest';
import { calculateRSScores } from './score-scheduler.service';

describe('calculateRSScores', () => {
  const scoredAt = '2026-05-22T10:00:00Z';

  it('calculates Z-Scores correctly', () => {
    const inputs = [
      { symbol: 'SUI', btcReturn: 0.15, rawReturn: 0.18 },
      { symbol: 'SOL', btcReturn: 0.08, rawReturn: 0.10 },
      { symbol: 'ETH', btcReturn: -0.02, rawReturn: 0.01 },
      { symbol: 'DOGE', btcReturn: -0.12, rawReturn: -0.09 },
      { symbol: 'XRP', btcReturn: 0.05, rawReturn: 0.07 },
    ];

    const results = calculateRSScores(inputs, scoredAt);

    expect(results).toHaveLength(5);
    // Highest return should be top rank
    expect(results[0].tokenSymbol).toBe('SUI');
    expect(results[0].rankPosition).toBe(1);
    // Lowest return should be bottom rank
    expect(results[4].tokenSymbol).toBe('DOGE');
    expect(results[4].rankPosition).toBe(5);
  });

  it('winsorizes Z-Score at ±3 sigma', () => {
    // 1 outlier + 9 zeros -> outlier Z-Score ~ sqrt(10) ≈ 3.16 > 3
    const inputs = [
      { symbol: 'OUTLIER', btcReturn: 1.0, rawReturn: 1.0 },
      ...Array.from({ length: 9 }, (_, i) => ({
        symbol: `N${i}`,
        btcReturn: 0,
        rawReturn: 0,
      })),
    ];

    const results = calculateRSScores(inputs, scoredAt);

    const outlier = results.find((r) => r.tokenSymbol === 'OUTLIER');
    expect(outlier).toBeDefined();
    // Z-Score clamped at +3, giving RS Score of 80
    expect(outlier!.rsScore).toBe(80);
    // Normal tokens should be un-clamped (within ±3)
    const normal = results.find((r) => r.tokenSymbol === 'N0');
    expect(normal!.rsScore).toBeLessThan(80);
  });

  it('classifies top 20% as weak and bottom 20% as strong (ascending sort)', () => {
    // Wait - the sorting is descending (highest score first = rank 1)
    // Top 20% by rank position = strong, bottom 20% = weak
    // With 10 tokens: ranks 1-2 = weak, ranks 9-10 = strong
    const inputs = Array.from({ length: 10 }, (_, i) => ({
      symbol: `TKN${i}`,
      btcReturn: (i - 5) * 0.01,
      rawReturn: (i - 5) * 0.01,
    }));

    const results = calculateRSScores(inputs, scoredAt);

    // Top 20% = bottom 2 ranks = strong
    expect(results[8].signal).toBe('strong');
    expect(results[9].signal).toBe('strong');

    // Bottom 20% = top 2 ranks = weak
    expect(results[0].signal).toBe('weak');
    expect(results[1].signal).toBe('weak');

    // Middle 60% = neutral
    expect(results[2].signal).toBe('neutral');
    expect(results[7].signal).toBe('neutral');
  });

  it('handles all identical returns', () => {
    const inputs = [
      { symbol: 'A', btcReturn: 0, rawReturn: 0 },
      { symbol: 'B', btcReturn: 0, rawReturn: 0 },
      { symbol: 'C', btcReturn: 0, rawReturn: 0 },
    ];

    const results = calculateRSScores(inputs, scoredAt);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.zScore).toBe(0);
      expect(r.rsScore).toBe(50);
    });
  });

  it('handles single token edge case', () => {
    const inputs = [{ symbol: 'ONLY', btcReturn: 0.05, rawReturn: 0.05 }];

    const results = calculateRSScores(inputs, scoredAt);

    expect(results).toHaveLength(1);
    expect(results[0].tokenSymbol).toBe('ONLY');
    expect(results[0].zScore).toBe(0);
    expect(results[0].rsScore).toBe(50);
    expect(results[0].signal).toBe('strong'); // single token, rank 1 >= floor(1 * 0.8) = 0
  });

  it('handles negative mean with positive outliers', () => {
    const inputs = [
      { symbol: 'CRASH', btcReturn: -0.30, rawReturn: -0.30 },
      { symbol: 'DOWN', btcReturn: -0.15, rawReturn: -0.15 },
      { symbol: 'FLAT', btcReturn: -0.05, rawReturn: -0.05 },
      { symbol: 'UP', btcReturn: 0.10, rawReturn: 0.10 },
      { symbol: 'MOON', btcReturn: 0.40, rawReturn: 0.40 },
    ];

    const results = calculateRSScores(inputs, scoredAt);

    // MOON should be rank 1 (highest score)
    expect(results[0].tokenSymbol).toBe('MOON');
    expect(results[0].btcReturn7d).toBe(0.4);

    // CRASH should be rank 5 (lowest score)
    expect(results[4].tokenSymbol).toBe('CRASH');
    expect(results[4].btcReturn7d).toBe(-0.3);
  });

  it('rounds values to correct precision', () => {
    const inputs = [
      { symbol: 'A', btcReturn: 0.123456, rawReturn: 0.123456 },
      { symbol: 'B', btcReturn: -0.123456, rawReturn: -0.123456 },
    ];

    const results = calculateRSScores(inputs, scoredAt);

    // btcReturn7d rounded to 4 decimal places
    expect(results[0].btcReturn7d).toBe(0.1235);
    expect(results[1].btcReturn7d).toBe(-0.1235);
  });
});
