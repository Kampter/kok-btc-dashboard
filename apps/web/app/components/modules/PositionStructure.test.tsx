import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PositionStructure } from './PositionStructure';
import { useBookSummary } from '../../hooks/useDashboardData';
import { mockOptionSummaries } from '@kok/shared-types/fixtures';

vi.mock('../../hooks/useDashboardData', () => ({
  useBookSummary: vi.fn(),
}));

const mockedUseBookSummary = vi.mocked(useBookSummary);

describe('PositionStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockedUseBookSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockedUseBookSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText('持仓结构数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders Call/Put pie chart', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText('Call / Put OI 比例')).toBeInTheDocument();
  });

  it('shows call ratio percentage', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText(/Calls/)).toBeInTheDocument();
  });

  it('shows sentiment label 偏看涨 when call ratio > 60%', () => {
    const bullishData = mockOptionSummaries.map((item) =>
      item.option_type === 'C'
        ? { ...item, open_interest_usd: 100000000 }
        : { ...item, open_interest_usd: 1000000 }
    );

    mockedUseBookSummary.mockReturnValue({
      data: bullishData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText('偏看涨')).toBeInTheDocument();
  });

  it('shows sentiment label 偏看跌 when call ratio < 40%', () => {
    const bearishData = mockOptionSummaries.map((item) =>
      item.option_type === 'P'
        ? { ...item, open_interest_usd: 100000000 }
        : { ...item, open_interest_usd: 1000000 }
    );

    mockedUseBookSummary.mockReturnValue({
      data: bearishData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText('偏看跌')).toBeInTheDocument();
  });

  it('shows sentiment label 中性 when call ratio between 40% and 60%', () => {
    const neutralData = mockOptionSummaries.map((item) =>
      item.option_type === 'C'
        ? { ...item, open_interest_usd: 50000000 }
        : { ...item, open_interest_usd: 50000000 }
    );

    mockedUseBookSummary.mockReturnValue({
      data: neutralData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText('中性')).toBeInTheDocument();
  });

  it('renders heatmap', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText('行权价-到期日 OI 热力图')).toBeInTheDocument();
  });

  it('handles empty bookData', () => {
    mockedUseBookSummary.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<PositionStructure />);

    expect(screen.getByText('Call / Put OI 比例')).toBeInTheDocument();
    expect(screen.getByText('行权价-到期日 OI 热力图')).toBeInTheDocument();
  });
});
