import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { OptionSummary, MarketOverview } from '../schemas/option.js';
import type { OptionTrade } from '../schemas/trade.js';
import type { OIDistributionList } from '../schemas/oi-distribution.js';
import type { GreeksExposure } from '../schemas/greeks.js';
import type { RsScore, RsChartData } from '../schemas/rs-monitor.js';

const t = initTRPC.create();

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

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

  chat: t.router({
    stream: t.procedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          ),
          context: z.object({
            activeTab: z.string(),
            timeRange: z.string().optional(),
            filters: z.record(z.string(), z.unknown()).optional(),
            lastUpdated: z.string(),
          }),
        }),
      )
      .subscription(async function* () {
        yield { type: 'text' as const, text: '' };
      }),
  }),

  greeks: t.router({
    exposure: t.procedure
      .input(z.object({ currency: z.string().default('BTC') }))
      .query(async () => ({} as GreeksExposure)),
  }),

  rsMonitor: t.router({
    latest: t.procedure.query(async () => [] as RsScore[]),

    history: t.procedure
      .input(z.object({ tokenSymbol: z.string(), days: z.number().default(7) }))
      .query(async () => [] as RsScore[]),

    chart: t.procedure
      .input(z.object({ tokenSymbol: z.string() }))
      .query(async () => ({} as RsChartData)),
  }),
});

export type AppRouter = typeof appRouter;
