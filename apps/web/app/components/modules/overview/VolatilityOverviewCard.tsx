import { memo } from 'react'
import { useBookSummary } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatPercent } from '../../../lib/utils'

export const VolatilityOverviewCard = memo(function VolatilityOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: bookData, isLoading, isError } = useBookSummary('BTC', 'option')
  const atmIV = bookData && bookData.length > 0
    ? bookData.reduce((sum, i) => sum + i.mark_iv, 0) / bookData.length
    : 0
  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="volatility"
      title="波动率分析"
      kpi={{
        label: '平均 ATM IV',
        value: atmIV > 0 ? formatPercent(atmIV) : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
