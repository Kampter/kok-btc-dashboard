import { Controller, Get, Query } from '@nestjs/common';
import { DeribitService } from './deribit.service';

@Controller('deribit')
export class DeribitController {
  constructor(private readonly deribitService: DeribitService) {}

  @Get('book-summary')
  async getBookSummary(
    @Query('currency') currency: string,
    @Query('kind') kind: string,
  ) {
    return this.deribitService.getBookSummaryByCurrency(currency, kind);
  }

  @Get('index-price')
  async getIndexPrice(@Query('indexName') indexName: string) {
    return this.deribitService.getIndexPrice(indexName);
  }
}
