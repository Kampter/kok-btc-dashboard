import { memo, useMemo } from 'react'
import { useBookSummary } from '../../../hooks/useDashboardData'
import { OverviewCard } from '../../OverviewCard'
import { formatUSD } from '../../../lib/utils'

export const ExpiryOverviewCard = memo(function ExpiryOverviewCard({
  isActive,
  onClick,
}: {
  isActive?: boolean
  onClick: () => void
}) {
  const { data: bookData, isLoading, isError } = useBookSummary('BTC', 'option')
  const maxExpiryOI = useMemo(() => {
    if (!bookData) return null
    const byExpiry = new Map<string, number>()
    for (const item of bookData) {
      byExpiry.set(item.expiry, (byExpiry.get(item.expiry) ?? 0) + item.open_interest_usd)
    }
    let maxExp = '', maxOI = 0
    for (const [exp, oi] of byExpiry) {
      if (oi > maxOI) { maxOI = oi; maxExp = exp }
    }
    return maxExp ? { expiry: new Date(maxExp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }), oi: maxOI } : null
  }, [bookData])

  const status = isLoading ? 'loading' : isError ? 'error' : 'ready'

  return (
    <OverviewCard
      moduleId="expiry"
      title="到期分析"
      kpi={{
        label: '最大到期日',
        value: maxExpiryOI ? `${maxExpiryOI.expiry} · ${formatUSD(maxExpiryOI.oi)}` : '-',
      }}
      status={status}
      isActive={isActive}
      onClick={onClick}
    />
  )
})
