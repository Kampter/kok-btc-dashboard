import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GreeksDashboard } from './GreeksDashboard';
import { useGreeksExposure } from '../../hooks/useDashboardData';

vi.mock('../../hooks/useDashboardData', () => ({
  useGreeksExposure: vi.fn(),
}));

const mockedUseGreeksExposure = vi.mocked(useGreeksExposure);

describe('GreeksDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText('Greeks 数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders KPI cards with positive GEX in green', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: {
        currency: 'BTC',
        total_gex: 12400000000,
        total_dex: 5000000,
        zero_gamma_strike: 81500,
        call_wall: 85000,
        put_wall: 78000,
        by_strike: [
          {
            strike: 80000,
            call_oi: 100,
            put_oi: 50,
            call_gex: 5000000,
            put_gex: -2000000,
            net_gex: 3000000,
            call_delta: 50,
            put_delta: -20,
            net_delta: 30,
          },
        ],
        progress: { total: 10, completed: 10, is_complete: true },
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText('总 GEX')).toBeInTheDocument();
    expect(screen.getByText('Call Wall')).toBeInTheDocument();
    expect(screen.getByText('Put Wall')).toBeInTheDocument();
    expect(screen.getByText('零 Gamma 行权价')).toBeInTheDocument();
    expect(screen.getByText('正 GEX（稳定）')).toBeInTheDocument();
  });

  it('shows progress bar when computation is incomplete', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: {
        currency: 'BTC',
        total_gex: 0,
        total_dex: 0,
        zero_gamma_strike: null,
        call_wall: null,
        put_wall: null,
        by_strike: [],
        progress: { total: 420, completed: 156, is_complete: false },
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText(/计算进度:/)).toBeInTheDocument();
    expect(screen.getByText(/156\/420/)).toBeInTheDocument();
  });

  it('renders GEX chart when data is available', () => {
    mockedUseGreeksExposure.mockReturnValue({
      data: {
        currency: 'BTC',
        total_gex: 1000000,
        total_dex: 500000,
        zero_gamma_strike: 80000,
        call_wall: 85000,
        put_wall: 75000,
        by_strike: [
          {
            strike: 80000,
            call_oi: 100,
            put_oi: 100,
            call_gex: 5000000,
            put_gex: -3000000,
            net_gex: 2000000,
            call_delta: 50,
            put_delta: -30,
            net_delta: 20,
          },
        ],
        progress: { total: 1, completed: 1, is_complete: true },
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGreeksExposure>);

    render(<GreeksDashboard />);
    expect(screen.getByText('GEX by Strike（Gamma 暴露）')).toBeInTheDocument();
  });
});
