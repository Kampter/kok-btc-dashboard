import { Injectable, Logger } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DeribitService } from '../deribit/deribit.service';
import {
  MarketOverviewSchema,
  OptionSummarySchema,
  OptionTradeSchema,
  OIDistributionListSchema,
  parseInstrumentName,
  getOptionTypeFromInstrumentName,
} from '@kok/shared-types';

const BTC_CONTRACT_SIZE = 0.001;

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
          const totalOI = bookData.reduce(
            (sum, item) => sum + ((item.open_interest as number) ?? 0) * btcPrice * BTC_CONTRACT_SIZE,
            0,
          );
          const totalVolume24h = bookData.reduce(
            (sum, item) => sum + ((item.volume as number) ?? 0) * btcPrice * BTC_CONTRACT_SIZE,
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

      oiDistribution: t.procedure
        .input(
          z.object({
            currency: z.string().default('BTC'),
            expiry: z.string().datetime().optional(),
          }),
        )
        .query(async ({ input }) => {
          try {
            const MIN_OI_USD = 100_000_000; // $100M threshold
            const MAX_EXPIRIES = 10;

            const [bookData, indexData] = await Promise.all([
              this.deribitService.getBookSummaryByCurrency(input.currency, 'option'),
              this.deribitService.getIndexPrice(`${input.currency.toLowerCase()}_usd`),
            ]);

            const spotPrice = indexData.index_price ?? 0;

            // Step 1: Parse raw data into structured items
            interface ParsedItem {
              expiryIso: string;
              strike: number;
              optionType: 'C' | 'P';
              oi: number;
              oiUsd: number;
            }

            const items: ParsedItem[] = [];
            for (const raw of bookData) {
              const name = String(raw.instrument_name ?? '');
              let expiryIso: string;
              let strike: number;
              let optionType: 'C' | 'P';

              try {
                const parsed = parseInstrumentName(name);
                expiryIso = parsed.expiry;
                strike = parsed.strike;
                optionType = parsed.optionType;
              } catch {
                // Fallback to raw fields if parsing fails
                const rawExpiry = raw.expiry as number;
                expiryIso = new Date(rawExpiry).toISOString();
                strike = raw.strike as number;
                optionType = (raw.option_type as 'C' | 'P') ?? getOptionTypeFromInstrumentName(name);
              }

              const oi = (raw.open_interest as number) ?? 0;
              const underlyingPrice = (raw.underlying_price as number) ?? spotPrice;
              const oiUsd = oi * underlyingPrice * BTC_CONTRACT_SIZE;

              items.push({ expiryIso, strike, optionType, oi, oiUsd });
            }

            // Step 2: Group by expiry and calculate total OI per expiry
            const expiryMap = new Map<string, { totalOiUsd: number; items: ParsedItem[] }>();
            for (const item of items) {
              const existing = expiryMap.get(item.expiryIso) ?? { totalOiUsd: 0, items: [] };
              existing.totalOiUsd += item.oiUsd;
              existing.items.push(item);
              expiryMap.set(item.expiryIso, existing);
            }

            // Step 3: Filter and sort expiries
            const now = new Date();
            const validExpiries = Array.from(expiryMap.entries())
              .filter(([_, data]) => data.totalOiUsd >= MIN_OI_USD)
              .map(([expiryIso, data]) => ({
                expiryIso,
                totalOiUsd: data.totalOiUsd,
                daysToExpiry: Math.ceil(
                  (new Date(expiryIso).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                ),
              }))
              .filter((e) => e.daysToExpiry >= 0)
              .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
              .slice(0, MAX_EXPIRIES);

            if (validExpiries.length === 0) {
              return OIDistributionListSchema.parse({
                expiries: [],
                selected: {
                  expiry: now.toISOString(),
                  days_to_expiry: 0,
                  total_call_oi: 0,
                  total_put_oi: 0,
                  total_call_oi_usd: 0,
                  total_put_oi_usd: 0,
                  resistance: 0,
                  support: 0,
                  max_pain: 0,
                  spot_price: spotPrice,
                  strike_distribution: [],
                },
              });
            }

            // Step 4: Select expiry
            const selectedExpiry =
              input.expiry && expiryMap.has(input.expiry)
                ? input.expiry
                : validExpiries[0].expiryIso;

            const selectedData = expiryMap.get(selectedExpiry)!;

            // Step 5: Aggregate by strike
            const strikeMap = new Map<
              number,
              { callOi: number; putOi: number; callOiUsd: number; putOiUsd: number }
            >();
            for (const item of selectedData.items) {
              const existing = strikeMap.get(item.strike) ?? {
                callOi: 0,
                putOi: 0,
                callOiUsd: 0,
                putOiUsd: 0,
              };
              if (item.optionType === 'C') {
                existing.callOi += item.oi;
                existing.callOiUsd += item.oiUsd;
              } else {
                existing.putOi += item.oi;
                existing.putOiUsd += item.oiUsd;
              }
              strikeMap.set(item.strike, existing);
            }

            const strikeDistribution = Array.from(strikeMap.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([strike, data]) => ({
                strike,
                call_oi: data.callOi,
                put_oi: data.putOi,
                call_oi_usd: data.callOiUsd,
                put_oi_usd: data.putOiUsd,
              }));

            // Step 6: Calculate totals
            const totalCallOi = strikeDistribution.reduce((s, d) => s + d.call_oi, 0);
            const totalPutOi = strikeDistribution.reduce((s, d) => s + d.put_oi, 0);
            const totalCallOiUsd = strikeDistribution.reduce((s, d) => s + d.call_oi_usd, 0);
            const totalPutOiUsd = strikeDistribution.reduce((s, d) => s + d.put_oi_usd, 0);

            // Step 7: Calculate weighted centers (resistance / support)
            let resistance = 0;
            if (totalCallOiUsd > 0) {
              resistance =
                strikeDistribution.reduce((s, d) => s + d.strike * d.call_oi_usd, 0) /
                totalCallOiUsd;
            }

            let support = 0;
            if (totalPutOiUsd > 0) {
              support =
                strikeDistribution.reduce((s, d) => s + d.strike * d.put_oi_usd, 0) /
                totalPutOiUsd;
            }

            // Step 8: Calculate Max Pain
            const strikes = strikeDistribution.map((d) => d.strike);
            let maxPain = strikes[0] ?? 0;
            let minIntrinsicValue = Infinity;

            for (const s of strikes) {
              let intrinsicValue = 0;
              for (const d of strikeDistribution) {
                intrinsicValue += d.call_oi * Math.max(0, s - d.strike);
                intrinsicValue += d.put_oi * Math.max(0, d.strike - s);
              }
              if (intrinsicValue < minIntrinsicValue) {
                minIntrinsicValue = intrinsicValue;
                maxPain = s;
              }
            }

            const daysToExpiry = Math.ceil(
              (new Date(selectedExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );

            return OIDistributionListSchema.parse({
              expiries: validExpiries.map((e) => ({
                expiry: e.expiryIso,
                days_to_expiry: e.daysToExpiry,
                total_oi_usd: e.totalOiUsd,
              })),
              selected: {
                expiry: selectedExpiry,
                days_to_expiry: daysToExpiry,
                total_call_oi: totalCallOi,
                total_put_oi: totalPutOi,
                total_call_oi_usd: totalCallOiUsd,
                total_put_oi_usd: totalPutOiUsd,
                resistance,
                support,
                max_pain: maxPain,
                spot_price: spotPrice,
                strike_distribution: strikeDistribution,
              },
            });
          } catch (error) {
            handleTrpcError('Failed to fetch OI distribution data', error);
          }
        }),
    }),
  });
}
