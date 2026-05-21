import { z } from 'zod';

export const TokenUniverseItemSchema = z.object({
  tokenSymbol: z.string(),
  instId: z.string(),
  rank: z.number(),
  marketCapUsd: z.number().optional(),
});

export type TokenUniverseItem = z.infer<typeof TokenUniverseItemSchema>;

export const OkxCandleSchema = z.object({
  ts: z.string(),
  o: z.string(),
  h: z.string(),
  l: z.string(),
  c: z.string(),
  vol: z.string(),
  volCcy: z.string(),
  volCcyQuote: z.string(),
  confirm: z.string(),
});

export type OkxCandle = z.infer<typeof OkxCandleSchema>;

export const RsScoreSchema = z.object({
  tokenSymbol: z.string(),
  rsScore: z.number(),
  btcReturn7d: z.number(),
  rawReturn7d: z.number(),
  zScore: z.number(),
  signal: z.enum(['strong', 'weak', 'neutral']),
  rankPosition: z.number(),
  scoredAt: z.string(),
});

export type RsScore = z.infer<typeof RsScoreSchema>;

export const RsChartPointSchema = z.object({
  timestamp: z.string(),
  price: z.number(),
  btcRatio: z.number(),
  score: z.number().nullable(),
});

export type RsChartPoint = z.infer<typeof RsChartPointSchema>;

export const RsChartDataSchema = z.object({
  tokenSymbol: z.string(),
  points: z.array(RsChartPointSchema),
});

export type RsChartData = z.infer<typeof RsChartDataSchema>;
