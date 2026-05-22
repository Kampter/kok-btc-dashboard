import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OkxService } from './okx.service';
import axios from 'axios';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}));

describe('OkxService', () => {
  let service: OkxService;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGet = vi.fn();
    (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });
    service = new OkxService();
  });

  it('parses candles correctly', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          ['1716262800000', '65000.1', '65100.2', '64900.3', '65050.4', '100.5', '50.2', '100.5', '1'],
        ],
      },
    });

    const candles = await service.getCandles('BTC-USDT', '1H', 2);
    expect(candles).toHaveLength(1);
    expect(candles[0].ts).toBe('1716262800000');
    expect(candles[0].c).toBe('65050.4');
  });

  it('returns empty array when no data', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    const candles = await service.getCandles('BTC-USDT', '1H', 2);
    expect(candles).toHaveLength(0);
  });

  it('fetches spot tickers', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          { instId: 'BTC-USDT', last: '65000' },
          { instId: 'ETH-USDT', last: '3500' },
        ],
      },
    });

    const tickers = await service.getSpotTickers();
    expect(tickers).toHaveLength(2);
    expect(tickers[0].instId).toBe('BTC-USDT');
  });
});
