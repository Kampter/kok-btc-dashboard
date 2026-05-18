import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FundingSentiment } from './FundingSentiment';
import { useTrades } from '../../hooks/useDashboardData';
import { mockOptionTrades } from '@kok/shared-types/fixtures';

vi.mock('../../hooks/useDashboardData', () => ({
  useTrades: vi.fn(),
}));

const mockedUseTrades = vi.mocked(useTrades);

describe('FundingSentiment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockedUseTrades.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTrades>);

    render(<FundingSentiment />);

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockedUseTrades.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as ReturnType<typeof useTrades>);

    render(<FundingSentiment />);

    expect(screen.getByText('资金情绪数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders P/C ratio chart', () => {
    mockedUseTrades.mockReturnValue({
      data: mockOptionTrades,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTrades>);

    render(<FundingSentiment />);

    expect(screen.getByText('Put/Call 交易量比例')).toBeInTheDocument();
  });

  it('renders Options Flow chart', () => {
    mockedUseTrades.mockReturnValue({
      data: mockOptionTrades,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTrades>);

    render(<FundingSentiment />);

    expect(screen.getByText('Options Flow')).toBeInTheDocument();
  });

  it('renders large trades table for trades >= $1M', () => {
    const largeTrades = [
      ...mockOptionTrades,
      {
        trade_id: 't-large',
        timestamp: Date.now(),
        instrument_name: 'BTC-30MAY26-90000-C',
        option_type: 'C' as const,
        direction: 'buy' as const,
        amount: 1000,
        price: 0.05,
        index_price: 90000,
      },
    ];

    mockedUseTrades.mockReturnValue({
      data: largeTrades,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTrades>);

    render(<FundingSentiment />);

    expect(screen.getByText('大宗交易（≥ $1M）')).toBeInTheDocument();
  });

  it('handles empty trades', () => {
    mockedUseTrades.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTrades>);

    render(<FundingSentiment />);

    expect(screen.getByText('Put/Call 交易量比例')).toBeInTheDocument();
    expect(screen.getByText('Options Flow')).toBeInTheDocument();
    expect(screen.getByText('大宗交易（≥ $1M）')).toBeInTheDocument();
  });
});
