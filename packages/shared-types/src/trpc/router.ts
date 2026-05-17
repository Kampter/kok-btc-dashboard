import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { OptionSummary, MarketOverview } from '../schemas/option.js';
import type { OptionTrade } from '../schemas/trade.js';

const t = initTRPC.create();

export const appRouter = t.router({
  deribit: t.router({
    marketOverview: t.procedure.query(async () => {
      return {
        totalOI: 0,
        totalVolume24h: 0,
        atmIV: 0,
        btcPrice: 0,
        timestamp: new Date().toISOString(),
      } as MarketOverview;
    }),

    bookSummary: t.procedure
      .input(z.object({ currency: z.string(), kind: z.string() }))
      .query(async ({ input }) => {
        return [] as OptionSummary[];
      }),

    trades: t.procedure
      .input(
        z.object({
          currency: z.string(),
          count: z.number().default(100),
        })
      )
      .query(async ({ input }) => {
        return [] as OptionTrade[];
      }),

    historicalVolatility: t.procedure
      .input(z.object({ currency: z.string() }))
      .query(async ({ input }) => {
        return [] as Array<{ timestamp: number; volatility: number }>;
      }),
  }),
});

export type AppRouter = typeof appRouter;
