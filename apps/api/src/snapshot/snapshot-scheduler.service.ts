import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SnapshotService } from './snapshot.service';

@Injectable()
export class SnapshotSchedulerService {
  private readonly logger = new Logger(SnapshotSchedulerService.name);

  constructor(private readonly snapshotService: SnapshotService) {}

  @Cron('*/15 * * * *') // Every 15 minutes: :00, :15, :30, :45
  async handleSnapshotCollection(): Promise<void> {
    this.logger.log('Starting scheduled snapshot collection');
    try {
      await this.snapshotService.collectSnapshot();
    } catch (error) {
      this.logger.error(
        `Snapshot collection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Cron('0 3 * * *') // Daily at 3:00 AM
  async handleCleanup(): Promise<void> {
    this.logger.log('Starting scheduled snapshot cleanup');
    try {
      await this.snapshotService.cleanupOldSnapshots();
    } catch (error) {
      this.logger.error(
        `Snapshot cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
