import { memo } from 'react'
import { useOIDistribution } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatUSD } from '../../../lib/utils'

export const OIDistributionOverviewCard = memo(function OIDistributionOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data, isLoading, isError } = useOIDistribution('BTC')
  const distribution = data?.selected

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="oi"
      title="OI 分布"
      kpi={{
        label: 'Max Pain',
        value: distribution ? formatUSD(distribution.max_pain) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
