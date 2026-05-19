import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VolatilityAnalysis } from './VolatilityAnalysis';
import { useBookSummary, useHistoricalVolatility } from '../../hooks/useDashboardData';
import { mockOptionSummaries, rawHistoricalVolatilityBTC } from '@kok/shared-types/fixtures';

vi.mock('../../hooks/useDashboardData', () => ({
  useBookSummary: vi.fn(),
  useHistoricalVolatility: vi.fn(),
}));

const mockedUseBookSummary = vi.mocked(useBookSummary);
const mockedUseHistoricalVolatility = vi.mocked(useHistoricalVolatility);

describe('VolatilityAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when book data is loading', () => {
    mockedUseBookSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows loading state when historical volatility is loading', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state for book data', () => {
    mockedUseBookSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: rawHistoricalVolatilityBTC,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(screen.getByText('波动率分析数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('shows error state for historical volatility', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(screen.getByText('历史波动率数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders IV term structure chart', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: rawHistoricalVolatilityBTC,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(screen.getByText('IV 期限结构')).toBeInTheDocument();
  });

  it('renders skew curve chart', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: rawHistoricalVolatilityBTC,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(screen.getByText('Skew 曲线（最近到期日）')).toBeInTheDocument();
  });

  it('renders historical volatility chart', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: rawHistoricalVolatilityBTC,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(screen.getByText('历史波动率 (HV)')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    mockedUseBookSummary.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBookSummary>);
    mockedUseHistoricalVolatility.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHistoricalVolatility>);

    render(<VolatilityAnalysis />);

    expect(screen.getByText('IV 期限结构')).toBeInTheDocument();
    expect(screen.getByText('Skew 曲线（最近到期日）')).toBeInTheDocument();
    expect(screen.getByText('历史波动率 (HV)')).toBeInTheDocument();
  });
});
