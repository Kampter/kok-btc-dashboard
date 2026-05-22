import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AxiosError } from 'axios';
import { parseInstrumentName } from '@kok/shared-types';
import type { GreeksExposure, GreeksProgress, GreekValues } from '@kok/shared-types';
import { DeribitService } from '../deribit/deribit.service';

const CONTRACT_MULTIPLIER = 1;

interface TickerResult {
  strike: number;
  greeks: GreekValues;
  oi: number;
  type: 'C' | 'P';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GreeksService {
  private readonly logger = new Logger(GreeksService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly deribitService: DeribitService,
  ) {}

  async getExposure(currency: string): Promise<GreeksExposure> {
    const cached = await this.cacheManager.get<GreeksExposure>(`greeks_exposure_${currency}`);
    if (cached) return cached;

    return {
      currency,
      total_gex: 0,
      total_dex: 0,
      zero_gamma_strike: null,
      call_wall: null,
      put_wall: null,
      by_strike: [],
      progress: { total: 0, completed: 0, is_complete: false },
      timestamp: new Date().toISOString(),
    };
  }

  private async getTickerWithRetry(
    instrumentName: string,
    maxRetries = 3,
  ): Promise<ReturnType<DeribitService['getTicker']>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.deribitService.getTicker(instrumentName);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const is429 =
          lastError.message.includes('429') ||
          (error as AxiosError)?.response?.status === 429;

        if (is429 && attempt < maxRetries) {
          const delayMs = 2000 * Math.pow(2, attempt);
          this.logger.warn(
            `Rate limited (429) for ${instrumentName}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
          );
          await sleep(delayMs);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error(`Failed to get ticker for ${instrumentName}`);
  }

  async computeExposure(currency: string): Promise<void> {
    try {
      const instruments = await this.deribitService.getInstruments(currency, 'option');
      const { index_price: spot } = await this.deribitService.getIndexPrice(`${currency.toLowerCase()}_usd`);

      if (instruments.length === 0) {
        const emptyResult = this.buildExposure(currency, [], spot, { total: 0, completed: 0, is_complete: true });
        await this.cacheManager.set(`greeks_exposure_${currency}`, emptyResult, 300000);
        return;
      }

      const now = Date.now();
      const sorted = instruments
        .map((i) => {
          const parsed = parseInstrumentName(i.instrument_name);
          const daysToExpiry = Math.ceil(
            (new Date(parsed.expiry).getTime() - now) / (1000 * 60 * 60 * 24),
          );
          const moneyness = parsed.strike / spot;
          return {
            ...parsed,
            instrument_name: i.instrument_name,
            priority: Math.abs(daysToExpiry) + Math.abs(moneyness - 1) * 10,
          };
        })
        .sort((a, b) => a.priority - b.priority);

      const BATCH_SIZE = 5;
      const results: TickerResult[] = [];

      const initialResult = this.buildExposure(currency, [], spot, {
        total: sorted.length,
        completed: 0,
        is_complete: false,
      });
      await this.cacheManager.set(`greeks_exposure_${currency}`, initialResult, 300000);

      for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
        const batch = sorted.slice(i, i + BATCH_SIZE);

        for (const instrument of batch) {
          try {
            const ticker = await this.getTickerWithRetry(instrument.instrument_name);
            results.push({
              strike: instrument.strike,
              greeks: ticker.greeks,
              oi: ticker.open_interest,
              type: instrument.optionType,
            });
          } catch (error) {
            this.logger.warn(
              `Failed to get ticker for ${instrument.instrument_name} after retries: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        const isLastBatch = i + BATCH_SIZE >= sorted.length;
        const progress: GreeksProgress = {
          total: sorted.length,
          completed: results.length,
          is_complete: isLastBatch,
        };
        const partialResult = this.buildExposure(currency, results, spot, progress);
        await this.cacheManager.set(`greeks_exposure_${currency}`, partialResult, 300000);

        if (!isLastBatch) {
          await sleep(200);
        }
      }

      this.logger.log(`Greeks computation complete for ${currency}: ${results.length}/${sorted.length} contracts`);
    } catch (error) {
      this.logger.error(
        `Greeks computation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private buildExposure(
    currency: string,
    results: TickerResult[],
    spot: number,
    progress: GreeksProgress,
  ): GreeksExposure {
    const strikeMap = new Map<
      number,
      {
        strike: number;
        call_oi: number;
        put_oi: number;
        call_gex: number;
        put_gex: number;
        net_gex: number;
        call_delta: number;
        put_delta: number;
        net_delta: number;
      }
    >();

    for (const item of results) {
      const existing = strikeMap.get(item.strike) ?? {
        strike: item.strike,
        call_oi: 0,
        put_oi: 0,
        call_gex: 0,
        put_gex: 0,
        net_gex: 0,
        call_delta: 0,
        put_delta: 0,
        net_delta: 0,
      };

      const gex = item.greeks.gamma * item.oi * spot * CONTRACT_MULTIPLIER;
      const dex = item.greeks.delta * item.oi;

      if (item.type === 'C') {
        existing.call_oi += item.oi;
        existing.call_gex += gex;
        existing.call_delta += dex;
      } else {
        existing.put_oi += item.oi;
        existing.put_gex += gex;
        existing.put_delta += dex;
      }

      existing.net_gex = existing.call_gex + existing.put_gex;
      existing.net_delta = existing.call_delta + existing.put_delta;
      strikeMap.set(item.strike, existing);
    }

    const byStrike = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);

    const totalGex = byStrike.reduce((sum, s) => sum + s.net_gex, 0);
    const totalDex = byStrike.reduce((sum, s) => sum + s.net_delta, 0);

    let callWall: number | null = null;
    let maxCallGex = -Infinity;
    for (const s of byStrike) {
      if (s.call_gex > maxCallGex) {
        maxCallGex = s.call_gex;
        callWall = s.strike;
      }
    }

    let putWall: number | null = null;
    let maxPutGex = -Infinity;
    for (const s of byStrike) {
      const absPutGex = Math.abs(s.put_gex);
      if (absPutGex > maxPutGex) {
        maxPutGex = absPutGex;
        putWall = s.strike;
      }
    }

    let zeroGammaStrike: number | null = null;
    for (let i = 0; i < byStrike.length - 1; i++) {
      const curr = byStrike[i]!;
      const next = byStrike[i + 1]!;
      if (curr.net_gex === 0) {
        zeroGammaStrike = curr.strike;
        break;
      }
      if ((curr.net_gex > 0 && next.net_gex <= 0) || (curr.net_gex < 0 && next.net_gex >= 0)) {
        const t = Math.abs(curr.net_gex) / (Math.abs(curr.net_gex) + Math.abs(next.net_gex));
        zeroGammaStrike = curr.strike + t * (next.strike - curr.strike);
        break;
      }
    }

    return {
      currency,
      total_gex: totalGex,
      total_dex: totalDex,
      zero_gamma_strike: zeroGammaStrike,
      call_wall: callWall,
      put_wall: putWall,
      by_strike: byStrike,
      progress,
      timestamp: new Date().toISOString(),
    };
  }
}
