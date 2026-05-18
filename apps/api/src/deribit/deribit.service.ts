import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2/public';

@Injectable()
export class DeribitService {
  private readonly client = axios.create({
    baseURL: DERIBIT_API_URL,
    timeout: 10000,
  });

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  private async fetchWithCache<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlMs = 30000,
  ): Promise<T> {
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached) return cached;

    try {
      const result = await fetcher();
      await this.cacheManager.set(cacheKey, result, ttlMs);
      return result;
    } catch (error) {
      // 如果 API 失败，尝试返回缓存数据（即使已过期）
      const stale = await this.cacheManager.get<T>(cacheKey);
      if (stale) return stale;
      throw error;
    }
  }

  async getBookSummaryByCurrency(currency: string, kind: string) {
    return this.fetchWithCache(
      `book_summary_${currency}_${kind}`,
      async () => {
        const { data } = await this.client.get('/get_book_summary_by_currency', {
          params: { currency, kind },
        });
        return data.result as Array<Record<string, unknown>>;
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
        return data.result as { index_price: number; estimated_delivery_price: number };
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
      300000, // 5 minutes
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
}
