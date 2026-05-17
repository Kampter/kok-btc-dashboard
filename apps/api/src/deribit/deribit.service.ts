import { Injectable } from '@nestjs/common';
import axios from 'axios';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2/public';

@Injectable()
export class DeribitService {
  private readonly client = axios.create({
    baseURL: DERIBIT_API_URL,
    timeout: 10000,
  });

  async getBookSummaryByCurrency(currency: string, kind: string) {
    const { data } = await this.client.get('/get_book_summary_by_currency', {
      params: { currency, kind },
    });
    return data.result as Array<Record<string, unknown>>;
  }

  async getIndex(currency: string) {
    const { data } = await this.client.get('/get_index', {
      params: { currency },
    });
    return data.result as Record<string, number>;
  }

  async getHistoricalVolatility(currency: string) {
    const { data } = await this.client.get('/get_historical_volatility', {
      params: { currency },
    });
    return data.result as Array<[number, number]>;
  }

  async getLastTradesByCurrency(
    currency: string,
    kind: string,
    count = 100,
  ) {
    const { data } = await this.client.get('/get_last_trades_by_currency', {
      params: { currency, kind, count, sorting: 'desc' },
    });
    return data.result as { trades: Array<Record<string, unknown>> };
  }
}
