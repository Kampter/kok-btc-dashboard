import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { UniverseService } from './universe.service';
import { OkxService } from '../okx/okx.service';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

@Injectable()
export class UniverseSchedulerService {
  private readonly logger = new Logger(UniverseSchedulerService.name);

  constructor(
    private readonly universeService: UniverseService,
    private readonly okxService: OkxService,
  ) {}

  @Cron('0 0 * * *')
  async updateUniverse(): Promise<void> {
    this.logger.log('Starting universe update...');

    try {
      const cgResponse = await axios.get(`${COINGECKO_API}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 100,
          page: 1,
          sparkline: false,
        },
        timeout: 15000,
      });

      const cgCoins = cgResponse.data as Array<{ symbol: string; market_cap: number }>;
      const okxTickers = await this.okxService.getSpotTickers();
      const okxSet = new Set(okxTickers.map((t) => t.instId));

      const filtered: Array<{ tokenSymbol: string; instId: string; rank: number; marketCapUsd: number }> = [];
      let rank = 1;

      for (const coin of cgCoins) {
        const symbol = coin.symbol.toUpperCase();
        const instId = `${symbol}-USDT`;

        if (okxSet.has(instId)) {
          filtered.push({
            tokenSymbol: symbol,
            instId,
            rank,
            marketCapUsd: coin.market_cap ?? 0,
          });
          rank++;
        }

        if (filtered.length >= 50) break;
      }

      if (filtered.length < 30) {
        this.logger.warn(`Only ${filtered.length} tokens found, expected at least 30`);
      }

      await this.universeService.updateUniverse(filtered);
      this.logger.log(`Universe updated: ${filtered.length} tokens`);
    } catch (error) {
      this.logger.error(`Failed to update universe: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
