import { memo, useMemo } from 'react'
import { useBookSummary } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'

export const PositionOverviewCard = memo(function PositionOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: bookData, isLoading, isError } = useBookSummary('BTC', 'option')
  // 持仓结构情绪阈值：Call 占比 >60% 视为偏看涨，<40% 偏看跌
  const pcRatio = useMemo(() => {
    if (!bookData) return null
    let callOI = 0, putOI = 0
    for (const item of bookData) {
      if (item.option_type === 'C') callOI += item.open_interest_usd
      else putOI += item.open_interest_usd
    }
    const total = callOI + putOI
    return total > 0 ? callOI / total : null
  }, [bookData])

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="positions"
      title="持仓结构"
      kpi={{
        label: 'Call 占比',
        value: pcRatio !== null ? `${(pcRatio * 100).toFixed(1)}%` : '-',
        change: pcRatio !== null ? (pcRatio > 0.6 ? '偏看涨' : pcRatio < 0.4 ? '偏看跌' : '中性') : undefined,
        changeType: pcRatio !== null ? (pcRatio > 0.6 ? 'positive' : pcRatio < 0.4 ? 'negative' : 'neutral') : undefined,
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
