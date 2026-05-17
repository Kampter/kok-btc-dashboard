import { Module } from '@nestjs/common';
import { DeribitModule } from './deribit/deribit.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [DeribitModule, TrpcModule],
})
export class AppModule {}
