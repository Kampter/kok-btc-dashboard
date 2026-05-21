import { memo } from 'react'
import { useRSLatest } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'

export const RSMOverviewCard = memo(function RSMOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: scores, isLoading, isError } = useRSLatest()

  const strongTokens = scores?.filter((s) => s.signal === 'strong').slice(0, 3) ?? []

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="rs-monitor"
      title="相对强度监控"
      kpi={{
        label: strongTokens.length > 0
          ? `${strongTokens.length} 个强势标的`
          : '等待数据...',
        value: strongTokens.length > 0
          ? `Top: ${strongTokens[0]?.tokenSymbol ?? '-'}`
          : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
