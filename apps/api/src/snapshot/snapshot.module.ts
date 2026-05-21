import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DeribitModule } from '../deribit/deribit.module';
import { SnapshotService } from './snapshot.service';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';
import { CacheSyncService } from './cache-sync.service';

@Module({
  imports: [DatabaseModule, DeribitModule],
  providers: [SnapshotService, SnapshotSchedulerService, CacheSyncService],
})
export class SnapshotModule {}
