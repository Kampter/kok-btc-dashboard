import { Module } from '@nestjs/common';
import { DeribitModule } from '../deribit/deribit.module';
import { GreeksService } from './greeks.service';
import { GreeksSchedulerService } from './greeks-scheduler.service';

@Module({
  imports: [DeribitModule],
  providers: [GreeksService, GreeksSchedulerService],
  exports: [GreeksService],
})
export class GreeksModule {}
