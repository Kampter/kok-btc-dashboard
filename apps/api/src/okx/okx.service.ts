import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OkxCandleSchema } from '@kok/shared-types';
import type { OkxCandle } from '@kok/shared-types';

const OKX_BASE_URL = 'https://www.okx.com';

@Injectable()
export class OkxService {
  private readonly logger = new Logger(OkxService.name);
  private readonly client = axios.create({
    baseURL: OKX_BASE_URL,
    timeout: 15000,
  });

  async getCandles(instId: string, bar: string, limit: number): Promise<OkxCandle[]> {
    return this.fetchCandles('/api/v5/market/candles', instId, bar, limit);
  }

  async getHistoryCandles(instId: string, bar: string, limit: number, after?: string): Promise<OkxCandle[]> {
    return this.fetchCandles('/api/v5/market/history-candles', instId, bar, limit, after);
  }

  private async fetchCandles(
    endpoint: string,
    instId: string,
    bar: string,
    limit: number,
    after?: string,
  ): Promise<OkxCandle[]> {
    try {
      const params: Record<string, string | number> = { instId, bar, limit };
      if (after) params.after = after;

      const response = await this.client.get(endpoint, { params });

      const data = response.data?.data ?? [];
      return data.map((row: string[]) =>
        OkxCandleSchema.parse({
          ts: row[0],
          o: row[1],
          h: row[2],
          l: row[3],
          c: row[4],
          vol: row[5],
          volCcy: row[6],
          volCcyQuote: row[7] ?? '',
          confirm: row[8] ?? '1',
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to fetch candles for ${instId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getSpotTickers(): Promise<Array<{ instId: string; last: string }>> {
    try {
      const response = await this.client.get('/api/v5/market/tickers', {
        params: { instType: 'SPOT' },
      });

      const data = response.data?.data ?? [];
      return data.map((t: Record<string, string>) => ({
        instId: t.instId,
        last: t.last,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch spot tickers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
