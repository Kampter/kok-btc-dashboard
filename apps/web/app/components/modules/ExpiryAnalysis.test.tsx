import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpiryAnalysis } from './ExpiryAnalysis';
import { useBookSummary } from '../../hooks/useDashboardData';
import { mockOptionSummaries } from '@kok/shared-types/fixtures';

vi.mock('../../hooks/useDashboardData', () => ({
  useBookSummary: vi.fn(),
}));

const mockedUseBookSummary = vi.mocked(useBookSummary);

describe('ExpiryAnalysis', () => {
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

    render(<ExpiryAnalysis />);

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockedUseBookSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<ExpiryAnalysis />);

    expect(screen.getByText('到期分析数据加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders expiry calendar chart', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<ExpiryAnalysis />);

    expect(screen.getByText('到期日历（OI 分布）')).toBeInTheDocument();
  });

  it('renders strike distribution chart', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<ExpiryAnalysis />);

    expect(screen.getByText('行权价分布')).toBeInTheDocument();
  });

  it('has expiry dropdown selector', () => {
    mockedUseBookSummary.mockReturnValue({
      data: mockOptionSummaries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<ExpiryAnalysis />);

    const select = document.querySelector('select');
    expect(select).toBeInTheDocument();
  });

  it('handles empty bookData', () => {
    mockedUseBookSummary.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useBookSummary>);

    render(<ExpiryAnalysis />);

    expect(screen.getByText('到期日历（OI 分布）')).toBeInTheDocument();
    expect(screen.getByText('行权价分布')).toBeInTheDocument();
  });
});
