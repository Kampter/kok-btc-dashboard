import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardLayout } from './DashboardLayout'

vi.mock('./modules/MarketOverview', () => ({
  MarketOverview: () => <div data-testid="market-overview">MarketOverview</div>,
}))

vi.mock('./modules/VolatilityAnalysis', () => ({
  VolatilityAnalysis: () => <div data-testid="volatility">Volatility</div>,
}))

vi.mock('./modules/PositionStructure', () => ({
  PositionStructure: () => <div data-testid="positions">PositionStructure</div>,
}))

vi.mock('./modules/FundingSentiment', () => ({
  FundingSentiment: () => <div data-testid="sentiment">FundingSentiment</div>,
}))

vi.mock('./modules/ExpiryAnalysis', () => ({
  ExpiryAnalysis: () => <div data-testid="expiry">ExpiryAnalysis</div>,
}))

describe('DashboardLayout', () => {
  it('renders header with title', () => {
    render(<DashboardLayout />)
    expect(screen.getByText('BTC Options Dashboard')).toBeInTheDocument()
  })

  it('renders Deribit connection status', () => {
    render(<DashboardLayout />)
    expect(screen.getByText('Deribit')).toBeInTheDocument()
  })

  it('renders all 5 tabs', () => {
    render(<DashboardLayout />)
    expect(screen.getByText('市场概况')).toBeInTheDocument()
    expect(screen.getByText('波动率分析')).toBeInTheDocument()
    expect(screen.getByText('持仓结构')).toBeInTheDocument()
    expect(screen.getByText('资金情绪')).toBeInTheDocument()
    expect(screen.getByText('到期分析')).toBeInTheDocument()
  })

  it('default active tab is 市场概况', () => {
    render(<DashboardLayout />)
    expect(screen.getByTestId('market-overview')).toBeInTheDocument()
  })

  it('clicking tab changes active content', () => {
    render(<DashboardLayout />)

    // 默认显示市场概况
    expect(screen.getByTestId('market-overview')).toBeInTheDocument()
    expect(screen.queryByTestId('volatility')).not.toBeInTheDocument()

    // 点击波动率分析
    fireEvent.click(screen.getByText('波动率分析'))
    expect(screen.queryByTestId('market-overview')).not.toBeInTheDocument()
    expect(screen.getByTestId('volatility')).toBeInTheDocument()

    // 点击持仓结构
    fireEvent.click(screen.getByText('持仓结构'))
    expect(screen.queryByTestId('volatility')).not.toBeInTheDocument()
    expect(screen.getByTestId('positions')).toBeInTheDocument()

    // 点击资金情绪
    fireEvent.click(screen.getByText('资金情绪'))
    expect(screen.queryByTestId('positions')).not.toBeInTheDocument()
    expect(screen.getByTestId('sentiment')).toBeInTheDocument()

    // 点击到期分析
    fireEvent.click(screen.getByText('到期分析'))
    expect(screen.queryByTestId('sentiment')).not.toBeInTheDocument()
    expect(screen.getByTestId('expiry')).toBeInTheDocument()
  })

  it('renders all memo-wrapped components', () => {
    render(<DashboardLayout />)
    // 默认只渲染 market-overview，通过切换 tab 验证所有组件都能渲染
    fireEvent.click(screen.getByText('波动率分析'))
    expect(screen.getByTestId('volatility')).toBeInTheDocument()

    fireEvent.click(screen.getByText('持仓结构'))
    expect(screen.getByTestId('positions')).toBeInTheDocument()

    fireEvent.click(screen.getByText('资金情绪'))
    expect(screen.getByTestId('sentiment')).toBeInTheDocument()

    fireEvent.click(screen.getByText('到期分析'))
    expect(screen.getByTestId('expiry')).toBeInTheDocument()
  })
})
