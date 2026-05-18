import { Injectable, Logger } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DeribitService } from '../deribit/deribit.service';
import {
  MarketOverviewSchema,
  OptionSummarySchema,
  OptionTradeSchema,
  parseInstrumentName,
  getOptionTypeFromInstrumentName,
} from '@kok/shared-types';

const t = initTRPC.create();

function handleTrpcError(context: string, error: unknown): never {
  Logger.error(`${context}: ${error instanceof Error ? error.message : String(error)}`, 'TrpcService');
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: context,
  });
}

@Injectable()
export class TrpcService {
  constructor(private readonly deribitService: DeribitService) {}

  public readonly appRouter = t.router({
    deribit: t.router({
      marketOverview: t.procedure.query(async () => {
        try {
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
          const atmIVs: number[] = [];
          for (const item of bookData) {
            const name = String(item.instrument_name ?? '');
            const { strike } = parseInstrumentName(name);
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
        } catch (error) {
          handleTrpcError('Failed to fetch market overview data', error);
        }
      }),

      bookSummary: t.procedure
        .input(z.object({ currency: z.string(), kind: z.string() }))
        .query(async ({ input }) => {
          try {
            const data = await this.deribitService.getBookSummaryByCurrency(
              input.currency,
              input.kind,
            );
            return data.map((item) => {
              const underlyingPrice = (item.underlying_price as number) ?? 0;
              const openInterest = (item.open_interest as number) ?? 0;
              const volumeUSD = (item.volume_usd as number) ?? 0;

              const name = String(item.instrument_name);
              const parsed = parseInstrumentName(name);

              return OptionSummarySchema.parse({
                instrument_name: name,
                strike: parsed.strike,
                expiry: parsed.expiry,
                option_type: parsed.optionType,
                open_interest: openInterest,
                open_interest_usd: openInterest * underlyingPrice * 0.001,
                volume_24h: volumeUSD,
                mark_iv: (item.mark_iv as number) ?? 0,
                bid_iv: (item.bid_iv as number) ?? 0,
                ask_iv: (item.ask_iv as number) ?? 0,
                underlying_price: underlyingPrice,
              });
            });
          } catch (error) {
            handleTrpcError('Failed to fetch book summary data', error);
          }
        }),

      trades: t.procedure
        .input(
          z.object({
            currency: z.string(),
            count: z.number().default(100),
          }),
        )
        .query(async ({ input }) => {
          try {
            const data = await this.deribitService.getLastTradesByCurrency(
              input.currency,
              'option',
              input.count,
            );
            return (data.trades ?? []).map((item) => {
              const instrumentName = String(item.instrument_name ?? '');
              const optionType = getOptionTypeFromInstrumentName(instrumentName);

              return OptionTradeSchema.parse({
                trade_id: String(item.trade_id ?? ''),
                timestamp: item.timestamp as number,
                instrument_name: instrumentName,
                option_type: optionType,
                direction: item.direction as 'buy' | 'sell',
                amount: item.amount as number,
                price: item.price as number,
                index_price: item.index_price as number,
              });
            });
          } catch (error) {
            handleTrpcError('Failed to fetch trades data', error);
          }
        }),

      historicalVolatility: t.procedure
        .input(z.object({ currency: z.string() }))
        .query(async ({ input }) => {
          try {
            const data = await this.deribitService.getHistoricalVolatility(
              input.currency,
            );
            return data.map(([timestamp, volatility]) => ({
              timestamp,
              volatility,
            }));
          } catch (error) {
            handleTrpcError('Failed to fetch historical volatility data', error);
          }
        }),
    }),
  });
}
