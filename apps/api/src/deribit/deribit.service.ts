import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { PersistentCacheService } from '../database/persistent-cache.service';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2/public';

export interface BookSummaryItem {
  instrument_name: string;
  open_interest: number;
  volume_usd: number;
  underlying_price: number;
  mark_iv: number;
  bid_iv: number;
  ask_iv: number;
  [key: string]: unknown;
}

export interface Instrument {
  instrument_name: string;
}

export interface TickerGreeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface TickerResponse {
  instrument_name: string;
  strike: number;
  option_type: 'C' | 'P';
  open_interest: number;
  underlying_price: number;
  greeks: TickerGreeks;
}

@Injectable()
export class DeribitService {
  private readonly client = axios.create({
    baseURL: DERIBIT_API_URL,
    timeout: 10000,
  });

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Optional() private readonly persistentCache?: PersistentCacheService,
  ) {}

  private async fetchWithCache<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlMs = 900000, // 15 minutes
  ): Promise<T> {
    // L1: Memory cache (single source of truth)
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached) return cached;

    // L2: PostgreSQL persistent cache (only for recovery after restart)
    if (this.persistentCache) {
      try {
        const persistent = await this.persistentCache.get<T>(cacheKey);
        if (persistent) {
          // Restore to memory from PG
          await this.cacheManager.set(cacheKey, persistent, ttlMs);
          return persistent;
        }
      } catch (error) {
        Logger.warn(
          `L2 cache read failed for ${cacheKey}, falling back to API: ${error instanceof Error ? error.message : String(error)}`,
          'DeribitService',
        );
      }
    }

    try {
      const result = await fetcher();
      // Only write to memory - PG sync is handled by CacheSyncService separately
      await this.cacheManager.set(cacheKey, result, ttlMs);
      return result;
    } catch (error) {
      // API failed - try returning stale data from L2
      if (this.persistentCache) {
        try {
          const stale = await this.persistentCache.get<T>(cacheKey, { includeExpired: true });
          if (stale) return stale;
        } catch (error) {
          Logger.warn(
            `L2 stale cache read failed for ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
            'DeribitService',
          );
        }
      }
      throw error;
    }
  }

  async getBookSummaryByCurrency(currency: string, kind: string): Promise<BookSummaryItem[]> {
    return this.fetchWithCache<BookSummaryItem[]>(
      `book_summary_${currency}_${kind}`,
      async () => {
        const { data } = await this.client.get('/get_book_summary_by_currency', {
          params: { currency, kind },
        });
        return data.result as BookSummaryItem[];
      },
    );
  }

  async getIndexPrice(indexName: string) {
    return this.fetchWithCache(
      `index_price_${indexName}`,
      async () => {
        const { data } = await this.client.get('/get_index_price', {
          params: { index_name: indexName },
        });
        // Deribit returns { index_price: 89950.5, estimated_delivery_price: 89950.5 }
        const result = data.result as { index_price: number; estimated_delivery_price: number };
        return { index_price: result.index_price ?? 0, estimated_delivery_price: result.estimated_delivery_price ?? 0 };
      },
    );
  }

  async getHistoricalVolatility(currency: string) {
    return this.fetchWithCache(
      `hist_vol_${currency}`,
      async () => {
        const { data } = await this.client.get('/get_historical_volatility', {
          params: { currency },
        });
        return data.result as Array<[number, number]>;
      },
      900000, // 15 minutes
    );
  }

  async getLastTradesByCurrency(
    currency: string,
    kind: string,
    count = 100,
  ) {
    return this.fetchWithCache(
      `trades_${currency}_${kind}_${count}`,
      async () => {
        const { data } = await this.client.get('/get_last_trades_by_currency', {
          params: { currency, kind, count, sorting: 'desc' },
        });
        return data.result as { trades: Array<Record<string, unknown>> };
      },
    );
  }

  async getInstruments(currency: string, kind: string): Promise<Instrument[]> {
    return this.fetchWithCache<Instrument[]>(
      `instruments_${currency}_${kind}`,
      async () => {
        const { data } = await this.client.get('/get_instruments', {
          params: { currency, kind, expired: false },
        });
        return data.result as Instrument[];
      },
      900000,
    );
  }

  async getTicker(instrumentName: string): Promise<TickerResponse> {
    return this.fetchWithCache<TickerResponse>(
      `ticker_${instrumentName}`,
      async () => {
        const { data } = await this.client.get('/ticker', {
          params: { instrument_name: instrumentName },
        });
        return data.result as TickerResponse;
      },
      30000, // 30 seconds TTL for Greeks data
    );
  }
}
