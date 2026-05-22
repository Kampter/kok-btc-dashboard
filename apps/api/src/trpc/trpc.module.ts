import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DeribitModule } from '../deribit/deribit.module';
import { ChatModule } from '../chat/chat.module';
import { GreeksModule } from '../greeks/greeks.module';
import { UniverseModule } from '../universe/universe.module';
import { RsMonitorModule } from '../rs-monitor/rs-monitor.module';

@Module({
  imports: [DeribitModule, ChatModule, GreeksModule, UniverseModule, RsMonitorModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
