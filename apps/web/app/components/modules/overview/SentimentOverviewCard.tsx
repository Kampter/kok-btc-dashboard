import { memo, useMemo } from 'react'
import { useTrades } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'

export const SentimentOverviewCard = memo(function SentimentOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: trades, isLoading, isError } = useTrades('BTC', 500)
  const pcRatio = useMemo(() => {
    if (!trades || trades.length === 0) return null
    let putVol = 0, callVol = 0
    for (const t of trades) {
      const notional = t.amount * t.price
      if (t.option_type === 'C') callVol += notional
      else putVol += notional
    }
    const total = putVol + callVol
    return total > 0 ? (putVol / total) * 100 : null
  }, [trades])

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="sentiment"
      title="资金情绪"
      kpi={{
        label: 'P/C 交易量比',
        value: pcRatio !== null ? `${pcRatio.toFixed(1)}%` : '-',
        change: pcRatio !== null ? (pcRatio > 55 ? '偏看跌' : pcRatio < 45 ? '偏看涨' : '中性') : undefined,
        changeType: pcRatio !== null ? (pcRatio > 55 ? 'negative' : pcRatio < 45 ? 'positive' : 'neutral') : undefined,
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
