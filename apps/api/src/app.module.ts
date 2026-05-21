import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { DeribitModule } from './deribit/deribit.module';
import { TrpcModule } from './trpc/trpc.module';
import { ChatModule } from './chat/chat.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { GreeksModule } from './greeks/greeks.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.register({
      isGlobal: true,
      ttl: 900000, // 15 minutes
    }),
    DatabaseModule,
    DeribitModule,
    TrpcModule,
    ChatModule,
    SnapshotModule,
    GreeksModule,
  ],
})
export class AppModule {}
