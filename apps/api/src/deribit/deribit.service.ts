import { Injectable, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { PersistentCacheService } from '../database/persistent-cache.service';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2/public';

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
    ttlMs = 30000,
  ): Promise<T> {
    // L1: 内存缓存
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached) return cached;

    // L2: PostgreSQL 持久化缓存
    if (this.persistentCache) {
      try {
        const persistent = await this.persistentCache.get<T>(cacheKey);
        if (persistent) {
          await this.cacheManager.set(cacheKey, persistent, ttlMs);
          return persistent;
        }
      } catch (error) {
        // 降级：PG 读取失败时静默 fallback 到 API 调用
      }
    }

    try {
      const result = await fetcher();
      await this.cacheManager.set(cacheKey, result, ttlMs);

      if (this.persistentCache) {
        try {
          await this.persistentCache.set(cacheKey, result, ttlMs * 20);
        } catch {
          // PG 写入失败不影响请求返回
        }
      }

      return result;
    } catch (error) {
      // API 失败时尝试返回 L2 中的过期数据
      if (this.persistentCache) {
        try {
          const stale = await this.persistentCache.get<T>(cacheKey, { includeExpired: true });
          if (stale) return stale;
        } catch {
          // 忽略 stale cache 读取错误
        }
      }
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
