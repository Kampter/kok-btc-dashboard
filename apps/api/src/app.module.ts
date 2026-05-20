import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from './database/database.module';
import { DeribitModule } from './deribit/deribit.module';
import { TrpcModule } from './trpc/trpc.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 30000, // 30 seconds
    }),
    DatabaseModule,
    DeribitModule,
    TrpcModule,
    ChatModule,
  ],
})
export class AppModule {}
