import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DeribitModule } from '../deribit/deribit.module';
import { ChatModule } from '../chat/chat.module';
import { GreeksModule } from '../greeks/greeks.module';

@Module({
  imports: [DeribitModule, ChatModule, GreeksModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
