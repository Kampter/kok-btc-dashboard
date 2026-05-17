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
          this.deribitService.getIndexPrice('btc_usd'),
        ]);

        const btcPrice = indexData.index_price ?? 0;
        const contractSize = 0.001; // BTC contract size on Deribit

        const totalOI = bookData.reduce(
          (sum, item) => sum + ((item.open_interest as number) ?? 0) * btcPrice * contractSize,
          0,
        );
        const totalVolume24h = bookData.reduce(
          (sum, item) => sum + ((item.volume as number) ?? 0) * btcPrice * contractSize,
          0,
        );

        // ATM IV: weighted average of mark_iv for strikes within ±2% of spot
        // Deribit raw data has no 'strike' field; parse it from instrument_name
        const atmIVs: number[] = [];
        for (const item of bookData) {
          const name = String(item.instrument_name ?? '');
          const parts = name.split('-');
          const strike = parseInt(parts[2] ?? '0', 10);
          const iv = (item.mark_iv as number) ?? 0;
          if (strike >= btcPrice * 0.98 && strike <= btcPrice * 1.02 && iv > 0) {
            atmIVs.push(iv);
          }
        }
        const atmIV = atmIVs.length > 0
          ? atmIVs.reduce((sum, iv) => sum + iv, 0) / atmIVs.length
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
          return data.map((item) => {
            const underlyingPrice = (item.underlying_price as number) ?? 0;
            const openInterest = (item.open_interest as number) ?? 0;
            const volumeUSD = (item.volume_usd as number) ?? 0;

            // Parse instrument_name: BTC-18MAY26-73000-P
            const name = String(item.instrument_name);
            const parts = name.split('-');
            const strike = parseInt(parts[2] ?? '0', 10);
            const optionType = parts[3] ?? '';

            // Parse expiry from instrument name (e.g., 18MAY26 -> 2026-05-18 08:00 UTC)
            const expiryStr = parts[1] ?? '';
            const day = parseInt(expiryStr.slice(0, 2), 10);
            const monthStr = expiryStr.slice(2, 5);
            const yearShort = parseInt(expiryStr.slice(5), 10);
            const year = 2000 + yearShort;
            const months: Record<string, number> = {
              JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
              JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
            };
            const month = months[monthStr] ?? 0;
            const expiry = new Date(Date.UTC(year, month, day, 8, 0, 0)).toISOString();

            return OptionSummarySchema.parse({
              instrument_name: name,
              strike,
              expiry,
              option_type: optionType,
              open_interest: openInterest,
              open_interest_usd: openInterest * underlyingPrice * 0.001,
              volume_24h: volumeUSD,
              mark_iv: (item.mark_iv as number) ?? 0,
              bid_iv: 0,
              ask_iv: 0,
              underlying_price: underlyingPrice,
            });
          });
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
