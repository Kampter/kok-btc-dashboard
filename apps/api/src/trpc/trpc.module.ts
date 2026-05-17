import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DeribitModule } from '../deribit/deribit.module';

@Module({
  imports: [DeribitModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
