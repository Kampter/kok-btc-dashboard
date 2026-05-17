import { Injectable } from '@nestjs/common';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { DeribitService } from '../deribit/deribit.service';

const t = initTRPC.create();

// 内联定义 Zod schemas（避免 CommonJS/ESM 互操作问题）
const MarketOverviewSchema = z.object({
  totalOI: z.number(),
  totalVolume24h: z.number(),
  atmIV: z.number(),
  btcPrice: z.number(),
  timestamp: z.string(),
});

const OptionSummarySchema = z.object({
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

const OptionTradeSchema = z.object({
  trade_id: z.string(),
  timestamp: z.number(),
  instrument_name: z.string(),
  direction: z.enum(['buy', 'sell']),
  amount: z.number(),
  price: z.number(),
  index_price: z.number(),
});

@Injectable()
export class TrpcService {
  constructor(private readonly deribitService: DeribitService) {}

  public readonly appRouter = t.router({
    deribit: t.router({
      marketOverview: t.procedure.query(async () => {
        const [bookData, indexData] = await Promise.all([
          this.deribitService.getBookSummaryByCurrency('BTC', 'option'),
          this.deribitService.getIndex('BTC'),
        ]);

        const btcPrice = indexData.btc ?? 0;

        const totalOI = bookData.reduce(
          (sum, item) => sum + ((item.open_interest_usd as number) ?? 0),
          0,
        );
        const totalVolume24h = bookData.reduce(
          (sum, item) => sum + ((item.volume_usd as number) ?? 0),
          0,
        );

        // ATM IV: weighted average of mark_iv for strikes within ±2% of spot
        const atmStrikes = bookData.filter((item) => {
          const strike = (item.strike as number) ?? 0;
          return strike >= btcPrice * 0.98 && strike <= btcPrice * 1.02;
        });
        const atmIV =
          atmStrikes.length > 0
            ? atmStrikes.reduce(
                (sum, item) => sum + ((item.mark_iv as number) ?? 0),
                0,
              ) / atmStrikes.length
            : 0;

        return MarketOverviewSchema.parse({
          totalOI,
          totalVolume24h,
          atmIV,
          btcPrice,
          timestamp: new Date().toISOString(),
        });
      }),

      bookSummary: t.procedure
        .input(z.object({ currency: z.string(), kind: z.string() }))
        .query(async ({ input }) => {
          const data = await this.deribitService.getBookSummaryByCurrency(
            input.currency,
            input.kind,
          );
          return data.map((item) =>
            OptionSummarySchema.parse({
              instrument_name: item.instrument_name as string,
              strike: item.strike as number,
              expiry: String(item.expiration),
              option_type: String(item.instrument_name).slice(-1),
              open_interest: item.open_interest as number,
              open_interest_usd:
                (item.open_interest_usd as number) ??
                (item.open_interest as number) *
                  ((item.underlying_price as number) ?? 0) *
                  0.001,
              volume_24h: (item.volume as number) ?? 0,
              mark_iv: item.mark_iv as number,
              bid_iv: item.bid_iv as number,
              ask_iv: item.ask_iv as number,
              underlying_price: item.underlying_price as number,
            }),
          );
        }),

      trades: t.procedure
        .input(
          z.object({
            currency: z.string(),
            count: z.number().default(100),
          }),
        )
        .query(async ({ input }) => {
          const data = await this.deribitService.getLastTradesByCurrency(
            input.currency,
            'option',
            input.count,
          );
          return (data.trades ?? []).map((item) =>
            OptionTradeSchema.parse({
              trade_id: String(item.trade_id ?? ''),
              timestamp: item.timestamp as number,
              instrument_name: item.instrument_name as string,
              direction: item.direction as 'buy' | 'sell',
              amount: item.amount as number,
              price: item.price as number,
              index_price: item.index_price as number,
            }),
          );
        }),

      historicalVolatility: t.procedure
        .input(z.object({ currency: z.string() }))
        .query(async ({ input }) => {
          const data = await this.deribitService.getHistoricalVolatility(
            input.currency,
          );
          return data.map(([timestamp, volatility]) => ({
            timestamp,
            volatility,
          }));
        }),
    }),
  });
}
