import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'

vi.mock('./chat/AgentChatPanel', () => ({
  AgentChatPanel: () => <div data-testid="chat-panel">Chat</div>,
}))

vi.mock('./OverviewGrid', () => ({
  OverviewGrid: ({ onModuleClick }: any) => (
    <div data-testid="overview-grid">
      <button data-testid="market-card" onClick={() => onModuleClick('overview')}>市场概况</button>
      <button data-testid="volatility-card" onClick={() => onModuleClick('volatility')}>波动率</button>
    </div>
  ),
}))

vi.mock('./ModuleDrawer', () => ({
  ModuleDrawer: ({ moduleId, onClose, children }: any) => (
    moduleId ? <div data-testid="drawer"><button onClick={onClose}>关闭</button>{children}</div> : null
  ),
}))

vi.mock('./modules/MarketOverview', () => ({
  MarketOverview: () => <div data-testid="market-detail">市场详情</div>,
}))
vi.mock('./modules/VolatilityAnalysis', () => ({
  VolatilityAnalysis: () => <div data-testid="volatility-detail">波动率详情</div>,
}))

describe('DashboardLayout', () => {
  it('renders header with title', () => {
    render(<DashboardLayout />)
    expect(screen.getByText('BTC Options Dashboard')).toBeInTheDocument()
  })

  it('renders overview grid', () => {
    render(<DashboardLayout />)
    expect(screen.getByTestId('overview-grid')).toBeInTheDocument()
  })

  it('opens drawer when card is clicked', () => {
    render(<DashboardLayout />)
    fireEvent.click(screen.getByTestId('market-card'))
    expect(screen.getByTestId('market-detail')).toBeInTheDocument()
  })

  it('closes drawer when close button is clicked', () => {
    render(<DashboardLayout />)
    fireEvent.click(screen.getByTestId('market-card'))
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    expect(screen.queryByTestId('market-detail')).not.toBeInTheDocument()
  })
})
