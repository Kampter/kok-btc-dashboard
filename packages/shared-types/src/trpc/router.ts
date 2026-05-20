import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { OptionSummary, MarketOverview } from '../schemas/option.js';
import type { OptionTrade } from '../schemas/trade.js';
import type { OIDistributionList } from '../schemas/oi-distribution.js';

const t = initTRPC.create();

// 此 router 仅用于推导 AppRouter 类型，实际实现在 apps/api/src/trpc/trpc.service.ts
export const appRouter = t.router({
  deribit: t.router({
    marketOverview: t.procedure.query(async () => ({} as MarketOverview)),

    bookSummary: t.procedure
      .input(z.object({ currency: z.string(), kind: z.string() }))
      .query(async () => [] as OptionSummary[]),

    trades: t.procedure
      .input(z.object({ currency: z.string(), count: z.number().default(100) }))
      .query(async () => [] as OptionTrade[]),

    historicalVolatility: t.procedure
      .input(z.object({ currency: z.string() }))
      .query(async () => [] as Array<{ timestamp: number; volatility: number }>),

    oiDistribution: t.procedure
      .input(z.object({
        currency: z.string().default('BTC'),
        expiry: z.string().datetime().optional(),
      }))
      .query(async () => ({} as OIDistributionList)),
  }),
});

export type AppRouter = typeof appRouter;
