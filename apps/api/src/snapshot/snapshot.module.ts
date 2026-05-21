import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SnapshotService } from './snapshot.service';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';
import { CacheSyncService } from './cache-sync.service';

@Module({
  imports: [DatabaseModule],
  providers: [SnapshotService, SnapshotSchedulerService, CacheSyncService],
})
export class SnapshotModule {}
