import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DeribitModule } from '../deribit/deribit.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [DeribitModule, ChatModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
