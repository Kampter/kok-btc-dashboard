import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OkxService } from '../okx/okx.service';
import { UniverseService } from '../universe/universe.service';
import { RsMonitorService } from './rs-monitor.service';

const BTC_FALLBACK = { token_symbol: 'BTC', inst_id: 'BTC-USDT', rank: 0 };

@Injectable()
export class CandleSchedulerService {
  private readonly logger = new Logger(CandleSchedulerService.name);

  constructor(
    private readonly okxService: OkxService,
    private readonly universeService: UniverseService,
    private readonly rsMonitorService: RsMonitorService,
  ) {}

  @Cron('5 * * * *')
  async fetchCandles(): Promise<void> {
    this.logger.log('Starting candle fetch...');

    const universe = await this.universeService.getCurrentUniverse();
    if (universe.length === 0) {
      this.logger.warn('No universe tokens found, skipping candle fetch');
      return;
    }

    const hasBtc = universe.some((u) => u.token_symbol === 'BTC');
    const targets = hasBtc ? universe : [...universe, BTC_FALLBACK];

    // Check if we need cold-start backfill (ohlcv table empty)
    const needsBackfill = await this.rsMonitorService.getKlineCount('BTC-USDT', '1H') === 0;
    if (needsBackfill) {
      this.logger.log('OHLCV table empty, running cold-start backfill...');
      await this.backfillHistory(targets);
    }

    for (const token of targets) {
      try {
        const candles = await this.okxService.getCandles(token.inst_id, '1H', 3);
        if (candles.length > 0) {
          await this.rsMonitorService.saveCandles(token.inst_id, '1H', candles);
        }
        await this.delay(100);
      } catch (error) {
        this.logger.error(`Failed to fetch candles for ${token.inst_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.log(`Candle fetch completed for ${targets.length} tokens`);
  }

  private async backfillHistory(
    targets: Array<{ token_symbol: string; inst_id: string; rank: number }>,
  ): Promise<void> {
    const HISTORY_LIMIT = 168; // 7 days of 1H candles

    for (const token of targets) {
      try {
        // OKX /api/v5/market/history-candles returns up to 100 candles per request
        // We need to paginate to get 168 candles
        let allCandles: Array<{ ts: string; o: string; h: string; l: string; c: string; vol: string }> = [];
        let after: string | undefined;

        while (allCandles.length < HISTORY_LIMIT) {
          const candles = await this.okxService.getHistoryCandles(token.inst_id, '1H', 100, after);
          if (candles.length === 0) break;

          allCandles.push(...candles);
          after = candles[candles.length - 1].ts;

          // If we got less than 100, we've reached the end of available history
          if (candles.length < 100) break;

          // Safety: prevent infinite loop
          if (allCandles.length >= HISTORY_LIMIT) break;
        }

        if (allCandles.length > 0) {
          await this.rsMonitorService.saveCandles(token.inst_id, '1H', allCandles);
          this.logger.log(`Backfilled ${allCandles.length} candles for ${token.inst_id}`);
        }

        await this.delay(200);
      } catch (error) {
        this.logger.error(`Failed to backfill ${token.inst_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
