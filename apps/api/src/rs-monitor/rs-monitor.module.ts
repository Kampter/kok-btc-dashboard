import { Module } from '@nestjs/common';
import { OkxModule } from '../okx/okx.module';
import { UniverseModule } from '../universe/universe.module';
import { RsMonitorService } from './rs-monitor.service';
import { CandleSchedulerService } from './candle-scheduler.service';
import { ScoreSchedulerService } from './score-scheduler.service';

@Module({
  imports: [OkxModule, UniverseModule],
  providers: [RsMonitorService, CandleSchedulerService, ScoreSchedulerService],
  exports: [RsMonitorService],
})
export class RsMonitorModule {}
