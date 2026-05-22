import { describe, it, expect } from 'vitest';
import {
  TokenUniverseItemSchema,
  OkxCandleSchema,
  RsScoreSchema,
  RsChartDataSchema,
} from './rs-monitor.js';

describe('TokenUniverseItemSchema', () => {
  it('validates a complete item', () => {
    const item = { tokenSymbol: 'SUI', instId: 'SUI-USDT', rank: 4, marketCapUsd: 5000000000 };
    expect(TokenUniverseItemSchema.parse(item)).toEqual(item);
  });

  it('allows optional marketCapUsd', () => {
    const item = { tokenSymbol: 'BTC', instId: 'BTC-USDT', rank: 1 };
    expect(TokenUniverseItemSchema.parse(item)).toEqual(item);
  });
});

describe('OkxCandleSchema', () => {
  it('validates a candle', () => {
    const candle = { ts: '1716262800000', o: '65000.1', h: '65100.2', l: '64900.3', c: '65050.4', vol: '100.5', volCcy: '50.2', volCcyQuote: '100.5', confirm: '1' };
    expect(OkxCandleSchema.parse(candle)).toEqual(candle);
  });
});

describe('RsScoreSchema', () => {
  it('validates a complete score', () => {
    const score = {
      tokenSymbol: 'SUI',
      rsScore: 89.5,
      btcReturn7d: 0.123,
      rawReturn7d: 0.15,
      zScore: 2.3,
      signal: 'strong' as const,
      rankPosition: 3,
      scoredAt: '2026-05-22T10:00:00Z',
    };
    expect(RsScoreSchema.parse(score)).toEqual(score);
  });

  it('rejects invalid signal', () => {
    const score = {
      tokenSymbol: 'SUI',
      rsScore: 89.5,
      btcReturn7d: 0.123,
      rawReturn7d: 0.15,
      zScore: 2.3,
      signal: 'bullish',
      rankPosition: 3,
      scoredAt: '2026-05-22T10:00:00Z',
    };
    expect(() => RsScoreSchema.parse(score)).toThrow();
  });
});

describe('RsChartDataSchema', () => {
  it('validates chart data', () => {
    const data = {
      tokenSymbol: 'SUI',
      points: [
        { timestamp: '2026-05-22T09:00:00Z', price: 1.5, btcRatio: 0.00002, score: 85 },
        { timestamp: '2026-05-22T10:00:00Z', price: 1.52, btcRatio: 0.000021, score: null },
      ],
    };
    expect(RsChartDataSchema.parse(data)).toEqual(data);
  });
});
