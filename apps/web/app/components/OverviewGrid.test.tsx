import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OverviewGrid } from './OverviewGrid'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderWithQuery(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

vi.mock('./modules/overview/MarketOverviewCard', () => ({
  MarketOverviewCard: ({ onClick, isActive }: any) => (
    <button data-testid="market-card" data-active={isActive} onClick={onClick}>市场概况</button>
  ),
}))
vi.mock('./modules/overview/VolatilityOverviewCard', () => ({
  VolatilityOverviewCard: ({ onClick }: any) => (
    <button data-testid="volatility-card" onClick={onClick}>波动率</button>
  ),
}))
vi.mock('./modules/overview/PositionOverviewCard', () => ({
  PositionOverviewCard: ({ onClick }: any) => (
    <button data-testid="positions-card" onClick={onClick}>持仓结构</button>
  ),
}))
vi.mock('./modules/overview/SentimentOverviewCard', () => ({
  SentimentOverviewCard: ({ onClick }: any) => (
    <button data-testid="sentiment-card" onClick={onClick}>资金情绪</button>
  ),
}))
vi.mock('./modules/overview/ExpiryOverviewCard', () => ({
  ExpiryOverviewCard: ({ onClick }: any) => (
    <button data-testid="expiry-card" onClick={onClick}>到期分析</button>
  ),
}))
vi.mock('./modules/overview/OIDistributionOverviewCard', () => ({
  OIDistributionOverviewCard: ({ onClick }: any) => (
    <button data-testid="oi-card" onClick={onClick}>OI 分布</button>
  ),
}))
vi.mock('./modules/overview/GreeksOverviewCard', () => ({
  GreeksOverviewCard: ({ onClick }: any) => (
    <button data-testid="greeks-card" onClick={onClick}>Greeks 风险暴露</button>
  ),
}))
vi.mock('./modules/overview/RSMOverviewCard', () => ({
  RSMOverviewCard: ({ onClick }: any) => (
    <button data-testid="rs-monitor-card" onClick={onClick}>相对强度监控</button>
  ),
}))

describe('OverviewGrid', () => {
  it('renders all 8 module cards', () => {
    renderWithQuery(<OverviewGrid activeModule={null} onModuleClick={vi.fn()} />)
    expect(screen.getByTestId('market-card')).toBeInTheDocument()
    expect(screen.getByTestId('volatility-card')).toBeInTheDocument()
    expect(screen.getByTestId('positions-card')).toBeInTheDocument()
    expect(screen.getByTestId('sentiment-card')).toBeInTheDocument()
    expect(screen.getByTestId('expiry-card')).toBeInTheDocument()
    expect(screen.getByTestId('oi-card')).toBeInTheDocument()
    expect(screen.getByTestId('greeks-card')).toBeInTheDocument()
    expect(screen.getByTestId('rs-monitor-card')).toBeInTheDocument()
  })

  it('marks active module card', () => {
    renderWithQuery(<OverviewGrid activeModule="overview" onModuleClick={vi.fn()} />)
    expect(screen.getByTestId('market-card')).toHaveAttribute('data-active', 'true')
  })

  it('calls onModuleClick with module id when card is clicked', () => {
    const handleClick = vi.fn()
    renderWithQuery(<OverviewGrid activeModule={null} onModuleClick={handleClick} />)
    fireEvent.click(screen.getByTestId('market-card'))
    expect(handleClick).toHaveBeenCalledWith('overview')
  })
})
