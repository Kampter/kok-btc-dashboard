import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Cron } from '@nestjs/schedule';
import { PersistentCacheService } from '../database/persistent-cache.service';

const CACHE_KEYS = [
  'book_summary_BTC_option',
  'index_price_btc_usd',
  'hist_vol_BTC',
  'trades_BTC_option_100',
];

const PG_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class CacheSyncService {
  private readonly logger = new Logger(CacheSyncService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly persistentCache: PersistentCacheService,
  ) {}

  @Cron('*/10 * * * *') // Every 10 minutes
  async syncCacheToPersistentStorage(): Promise<void> {
    for (const key of CACHE_KEYS) {
      try {
        const data = await this.cacheManager.get(key);
        if (data !== undefined && data !== null) {
          await this.persistentCache.set(key, data, PG_TTL_MS);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to sync ${key} to persistent cache: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.logger.log('Cache sync completed');
  }
}
