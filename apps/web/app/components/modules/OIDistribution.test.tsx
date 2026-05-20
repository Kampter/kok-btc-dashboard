import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OIDistribution } from './OIDistribution';
import { useOIDistribution } from '../../hooks/useDashboardData';

vi.mock('../../hooks/useDashboardData', () => ({
  useOIDistribution: vi.fn(),
}));

const mockedUseOIDistribution = vi.mocked(useOIDistribution);

const mockData = {
  expiries: [
    { expiry: '2026-05-30T08:00:00.000Z', days_to_expiry: 7, total_oi_usd: 500000000 },
    { expiry: '2026-06-27T08:00:00.000Z', days_to_expiry: 35, total_oi_usd: 300000000 },
  ],
  selected: {
    expiry: '2026-05-30T08:00:00.000Z',
    days_to_expiry: 7,
    total_call_oi: 8000000,
    total_put_oi: 4500000,
    total_call_oi_usd: 250000000,
    total_put_oi_usd: 150000000,
    resistance: 85000,
    support: 75000,
    max_pain: 80000,
    spot_price: 90000,
    strike_distribution: [
      { strike: 70000, call_oi: 1000000, put_oi: 3000000, call_oi_usd: 50000000, put_oi_usd: 150000000 },
      { strike: 80000, call_oi: 5000000, put_oi: 1000000, call_oi_usd: 150000000, put_oi_usd: 50000000 },
      { strike: 90000, call_oi: 2000000, put_oi: 500000, call_oi_usd: 50000000, put_oi_usd: 25000000 },
    ],
  },
};

describe('OIDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockedUseOIDistribution.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOIDistribution>);

    render(<OIDistribution />);

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockedUseOIDistribution.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOIDistribution>);

    render(<OIDistribution />);

    expect(screen.getByText('OI 分布数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('shows empty state when no expiries', () => {
    mockedUseOIDistribution.mockReturnValue({
      data: { expiries: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOIDistribution>);

    render(<OIDistribution />);

    expect(screen.getByText('暂无足够持仓数据的到期日')).toBeInTheDocument();
  });

  it('renders metric labels, chart title, and expiry selector', () => {
    mockedUseOIDistribution.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOIDistribution>);

    render(<OIDistribution />);

    expect(screen.getByText('阻力位置')).toBeInTheDocument();
    expect(screen.getByText('支撑位置')).toBeInTheDocument();
    expect(screen.getByText('Max Pain')).toBeInTheDocument();
    expect(screen.getByText('行权价 OI 分布（蝴蝶图）')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('switches expiry when select value changes', () => {
    mockedUseOIDistribution.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOIDistribution>);

    render(<OIDistribution />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2026-06-27T08:00:00.000Z' } });

    expect(select).toHaveValue('2026-06-27T08:00:00.000Z');
  });
});
