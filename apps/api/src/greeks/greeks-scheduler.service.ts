import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GreeksService } from './greeks.service';

@Injectable()
export class GreeksSchedulerService {
  private readonly logger = new Logger(GreeksSchedulerService.name);
  private isRunning = false;

  constructor(private readonly greeksService: GreeksService) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async handleGreeksComputation(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Greeks computation already running, skipping');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting scheduled Greeks computation');

    try {
      await this.greeksService.computeExposure('BTC');
    } catch (error) {
      this.logger.error(
        `Greeks computation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
