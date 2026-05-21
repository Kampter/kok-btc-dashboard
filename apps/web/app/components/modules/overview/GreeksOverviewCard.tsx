import { memo } from 'react'
import { useGreeksExposure } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatUSD } from '../../../lib/utils'

export const GreeksOverviewCard = memo(function GreeksOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data, isLoading, isError } = useGreeksExposure('BTC')
  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  const totalGex = data?.total_gex ?? 0
  const gexLabel = totalGex >= 0 ? '正 GEX（稳定）' : '负 GEX（波动）'

  return (
    <OverviewCard
      moduleId="greeks"
      title="Greeks 风险暴露"
      kpi={{
        label: gexLabel,
        value: totalGex !== 0 ? formatUSD(Math.abs(totalGex)) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
