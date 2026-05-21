import { z } from 'zod';

export const GreekValuesSchema = z.object({
  delta: z.number(),
  gamma: z.number(),
  vega: z.number(),
  theta: z.number(),
  rho: z.number(),
});

export const StrikeGreeksSchema = z.object({
  strike: z.number(),
  call_oi: z.number(),
  put_oi: z.number(),
  call_gex: z.number(),
  put_gex: z.number(),
  net_gex: z.number(),
  call_delta: z.number(),
  put_delta: z.number(),
  net_delta: z.number(),
});

export const GreeksProgressSchema = z.object({
  total: z.number(),
  completed: z.number(),
  is_complete: z.boolean(),
});

export const GreeksExposureSchema = z.object({
  currency: z.string(),
  total_gex: z.number(),
  total_dex: z.number(),
  zero_gamma_strike: z.number().nullable(),
  call_wall: z.number().nullable(),
  put_wall: z.number().nullable(),
  by_strike: z.array(StrikeGreeksSchema),
  progress: GreeksProgressSchema,
  timestamp: z.string().datetime(),
});

export type GreekValues = z.infer<typeof GreekValuesSchema>;
export type StrikeGreeks = z.infer<typeof StrikeGreeksSchema>;
export type GreeksProgress = z.infer<typeof GreeksProgressSchema>;
export type GreeksExposure = z.infer<typeof GreeksExposureSchema>;
