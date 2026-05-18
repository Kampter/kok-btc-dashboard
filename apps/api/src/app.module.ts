import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DeribitModule } from './deribit/deribit.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 30000, // 30 seconds
    }),
    DeribitModule,
    TrpcModule,
  ],
})
export class AppModule {}
