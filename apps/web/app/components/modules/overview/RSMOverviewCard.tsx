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
  const weakTokens = scores?.filter((s) => s.signal === 'weak').slice(0, 3) ?? []

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  const formatReturn = (v: number) =>
    `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

  const miniList = (
    <div className="space-y-0.5 text-[10px] leading-tight">
      {strongTokens.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-call font-medium shrink-0">强势</span>
          <span className="text-muted-foreground truncate">
            {strongTokens.map((t) => `${t.tokenSymbol} ${formatReturn(t.btcReturn7d)}`).join(', ')}
          </span>
        </div>
      )}
      {weakTokens.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-put font-medium shrink-0">弱势</span>
          <span className="text-muted-foreground truncate">
            {weakTokens.map((t) => `${t.tokenSymbol} ${formatReturn(t.btcReturn7d)}`).join(', ')}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <OverviewCard
      moduleId="rs-monitor"
      title="相对强度监控"
      kpi={{
        label: strongTokens.length > 0
          ? `${strongTokens.length + weakTokens.length} 个信号标的`
          : '等待数据...',
        value: strongTokens.length > 0
          ? `Top: ${strongTokens[0]?.tokenSymbol ?? '-'}`
          : '-',
      }}
      miniChart={miniList}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
