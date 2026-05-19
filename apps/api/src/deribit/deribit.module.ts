import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DeribitService } from './deribit.service';
import { DeribitController } from './deribit.controller';

@Module({
  imports: [DatabaseModule],
  providers: [DeribitService],
  controllers: [DeribitController],
  exports: [DeribitService],
})
export class DeribitModule {}
