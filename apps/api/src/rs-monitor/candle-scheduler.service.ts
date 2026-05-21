import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OkxService } from '../okx/okx.service';
import { UniverseService } from '../universe/universe.service';
import { RsMonitorService } from './rs-monitor.service';

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
    const targets = hasBtc ? universe : [...universe, { token_symbol: 'BTC', inst_id: 'BTC-USDT', rank: 0 }];

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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
