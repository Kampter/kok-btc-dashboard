import { Module } from '@nestjs/common';
import { DeribitService } from './deribit.service';
import { DeribitController } from './deribit.controller';

@Module({
  providers: [DeribitService],
  controllers: [DeribitController],
  exports: [DeribitService],
})
export class DeribitModule {}
