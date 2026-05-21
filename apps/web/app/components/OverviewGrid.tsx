import { memo } from 'react'
import { MarketOverviewCard } from './modules/overview/MarketOverviewCard'
import { VolatilityOverviewCard } from './modules/overview/VolatilityOverviewCard'
import { PositionOverviewCard } from './modules/overview/PositionOverviewCard'
import { SentimentOverviewCard } from './modules/overview/SentimentOverviewCard'
import { ExpiryOverviewCard } from './modules/overview/ExpiryOverviewCard'
import { OIDistributionOverviewCard } from './modules/overview/OIDistributionOverviewCard'

const MODULES = [
  { id: 'overview', label: '市场概况', Component: MarketOverviewCard },
  { id: 'volatility', label: '波动率分析', Component: VolatilityOverviewCard },
  { id: 'positions', label: '持仓结构', Component: PositionOverviewCard },
  { id: 'sentiment', label: '资金情绪', Component: SentimentOverviewCard },
  { id: 'expiry', label: '到期分析', Component: ExpiryOverviewCard },
  { id: 'oi', label: 'OI 分布', Component: OIDistributionOverviewCard },
] as const

export type ModuleId = (typeof MODULES)[number]['id']

export interface OverviewGridProps {
  activeModule: ModuleId | null
  onModuleClick: (moduleId: ModuleId) => void
}

export const OverviewGrid = memo(function OverviewGrid({
  activeModule,
  onModuleClick,
}: OverviewGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
      {MODULES.map((mod, index) => {
        const CardComponent = mod.Component
        return (
          <div
            key={mod.id}
            style={{
              opacity: 0,
              animation: `fadeInUp 300ms ${index * 50}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            }}
          >
            <CardComponent
              isActive={activeModule === mod.id}
              onClick={() => onModuleClick(mod.id)}
            />
          </div>
        )
      })}
    </div>
  )
})
