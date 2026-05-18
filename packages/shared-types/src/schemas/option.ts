import { z } from 'zod';

export const OptionSummarySchema = z.object({
  instrument_name: z.string(),
  strike: z.number(),
  expiry: z.string(),
  option_type: z.enum(['C', 'P']),
  open_interest: z.number(),
  open_interest_usd: z.number(),
  volume_24h: z.number(),
  mark_iv: z.number(),
  bid_iv: z.number(),
  ask_iv: z.number(),
  underlying_price: z.number(),
});

export const MarketOverviewSchema = z.object({
  totalOI: z.number(),
  totalVolume24h: z.number(),
  atmIV: z.number(),
  btcPrice: z.number(),
  timestamp: z.string(),
});

export const ExpirySummarySchema = z.object({
  expiry: z.string(),
  totalOI: z.number(),
  callOI: z.number(),
  putOI: z.number(),
  atmIV: z.number(),
});

export type OptionSummary = z.infer<typeof OptionSummarySchema>;
export type MarketOverview = z.infer<typeof MarketOverviewSchema>;
export type ExpirySummary = z.infer<typeof ExpirySummarySchema>;
