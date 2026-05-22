import { useState, useCallback } from 'react'
import { AgentChatPanel } from './chat/AgentChatPanel'
import { ResizableDrawer } from './ResizableDrawer'
import { OverviewGrid, type ModuleId } from './OverviewGrid'
import { MarketOverview } from './modules/MarketOverview'
import { VolatilityAnalysis } from './modules/VolatilityAnalysis'
import { PositionStructure } from './modules/PositionStructure'
import { FundingSentiment } from './modules/FundingSentiment'
import { ExpiryAnalysis } from './modules/ExpiryAnalysis'
import { OIDistribution } from './modules/OIDistribution'
import { GreeksDashboard } from './modules/GreeksDashboard'
import { RSMonitor } from './modules/RSMonitor'

const MODULE_DETAILS: Record<ModuleId, { title: string; component: React.ComponentType }> = {
  overview: { title: '市场概况', component: MarketOverview },
  volatility: { title: '波动率分析', component: VolatilityAnalysis },
  positions: { title: '持仓结构', component: PositionStructure },
  sentiment: { title: '资金情绪', component: FundingSentiment },
  expiry: { title: '到期分析', component: ExpiryAnalysis },
  oi: { title: 'OI 分布', component: OIDistribution },
  greeks: { title: 'Greeks 风险暴露', component: GreeksDashboard },
  'rs-monitor': { title: '相对强度监控', component: RSMonitor },
}

export function DashboardLayout() {
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null)

  const handleModuleClick = useCallback((moduleId: ModuleId) => {
    setActiveModule(moduleId)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setActiveModule(null)
  }, [])

  const activeDetail = activeModule ? MODULE_DETAILS[activeModule] : null
  const DetailComponent = activeDetail?.component

  return (
    <div className="flex h-screen bg-background">
      <AgentChatPanel />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 h-full">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">K</div>
              <h1 className="text-base font-semibold tracking-tight">BTC Options Dashboard</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-call" />
                Deribit
              </span>
              <span>自动刷新 30s</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <OverviewGrid
            activeModule={activeModule}
            onModuleClick={handleModuleClick}
          />
        </div>
      </div>

      <ResizableDrawer
        moduleId={activeModule}
        title={activeDetail?.title}
        onClose={handleCloseDrawer}
      >
        {DetailComponent && <DetailComponent />}
      </ResizableDrawer>
    </div>
  )
}
