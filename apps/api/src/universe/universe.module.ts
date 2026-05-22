import { Module } from '@nestjs/common';
import { OkxModule } from '../okx/okx.module';
import { DatabaseModule } from '../database/database.module';
import { UniverseService } from './universe.service';
import { UniverseSchedulerService } from './universe-scheduler.service';

@Module({
  imports: [OkxModule, DatabaseModule],
  providers: [UniverseService, UniverseSchedulerService],
  exports: [UniverseService],
})
export class UniverseModule {}
