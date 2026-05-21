import { memo } from 'react'
import { useMarketOverview } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatUSD } from '../../../lib/utils'

export const MarketOverviewCard = memo(function MarketOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: overview, isLoading, isError } = useMarketOverview()
  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="overview"
      title="市场概况"
      kpi={{
        label: '总持仓 OI',
        value: overview ? formatUSD(overview.totalOI) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
