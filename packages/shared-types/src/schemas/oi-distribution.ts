import { z } from 'zod';

export const OIStrikeItemSchema = z.object({
  strike: z.number(),
  call_oi: z.number(),
  put_oi: z.number(),
  call_oi_usd: z.number(),
  put_oi_usd: z.number(),
});

export const OIDistributionSchema = z.object({
  expiry: z.string().datetime(),
  days_to_expiry: z.number(),
  total_call_oi: z.number(),
  total_put_oi: z.number(),
  total_call_oi_usd: z.number(),
  total_put_oi_usd: z.number(),
  resistance: z.number(),
  support: z.number(),
  max_pain: z.number(),
  spot_price: z.number(),
  strike_distribution: z.array(OIStrikeItemSchema),
});

export const ExpiryItemSchema = z.object({
  expiry: z.string().datetime(),
  days_to_expiry: z.number(),
  total_oi_usd: z.number(),
});

export const OIDistributionListSchema = z.object({
  expiries: z.array(ExpiryItemSchema),
  selected: OIDistributionSchema,
});

export type OIStrikeItem = z.infer<typeof OIStrikeItemSchema>;
export type OIDistribution = z.infer<typeof OIDistributionSchema>;
export type OIDistributionList = z.infer<typeof OIDistributionListSchema>;
