import { memo } from 'react'
import { useBookSummary } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatPercent } from '../../../lib/utils'
import { groupByTenor, calculate25DeltaSkew } from '../../../lib/volatility'

export const VolatilityOverviewCard = memo(function VolatilityOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: bookData, isLoading, isError } = useBookSummary('BTC', 'option')

  const skew1M = (() => {
    if (!bookData || bookData.length === 0) return null
    const grouped = groupByTenor(bookData)
    const items1M = grouped.get('1M')
    return items1M ? calculate25DeltaSkew(items1M) : null
  })()

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  const changeText = skew1M !== null
    ? skew1M > 0 ? '偏恐惧' : skew1M < 0 ? '偏乐观' : '中性'
    : undefined

  const changeType = skew1M !== null
    ? skew1M > 0 ? 'negative' : skew1M < 0 ? 'positive' : 'neutral'
    : undefined

  return (
    <OverviewCard
      moduleId="volatility"
      title="波动率分析"
      kpi={{
        label: '1M 25Δ Skew',
        value: skew1M !== null ? formatPercent(skew1M) : '-',
        change: changeText,
        changeType,
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
