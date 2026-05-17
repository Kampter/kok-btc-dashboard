import { initTRPC } from '@trpc/server';
import { z } from 'zod';

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
      };
    }),

    bookSummary: t.procedure
      .input(z.object({ currency: z.string(), kind: z.string() }))
      .query(async ({ input }) => {
        return [];
      }),

    trades: t.procedure
      .input(
        z.object({
          currency: z.string(),
          count: z.number().default(100),
        })
      )
      .query(async ({ input }) => {
        return [];
      }),

    historicalVolatility: t.procedure
      .input(z.object({ currency: z.string() }))
      .query(async ({ input }) => {
        return [];
      }),
  }),
});

export type AppRouter = typeof appRouter;
