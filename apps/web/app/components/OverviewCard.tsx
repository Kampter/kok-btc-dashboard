import { memo } from 'react'
import { cn } from '../lib/utils'

export interface OverviewCardProps {
  moduleId: string
  title: string
  kpi: {
    label: string
    value: string
    change?: string
    changeType?: 'positive' | 'negative' | 'neutral'
  }
  miniChart?: React.ReactNode
  status?: 'loading' | 'error' | 'ready'
  isActive?: boolean
  onClick: () => void
}

const changeColorMap = {
  positive: 'text-call',
  negative: 'text-put',
  neutral: 'text-muted-foreground',
} as const

export const OverviewCard = memo(function OverviewCard({
  title,
  kpi,
  miniChart,
  status = 'ready',
  isActive = false,
  onClick,
}: OverviewCardProps) {
  if (status === 'loading') {
    return (
      <div
        role="status"
        className="rounded-xl border border-border bg-card p-4 animate-pulse min-h-[120px]"
      >
        <div className="h-4 w-20 bg-muted rounded mb-3" />
        <div className="h-8 w-24 bg-muted rounded mb-2" />
        <div className="h-16 bg-muted rounded mt-3" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full rounded-xl border border-put/30 bg-card p-4 text-left transition-all duration-200',
          'hover:border-put/50 hover:shadow-md',
          'min-h-[120px] h-full',
        )}
      >
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="mt-2 text-sm text-put">数据加载失败，点击查看详情</div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border bg-card p-4 text-left transition-all duration-200',
        'hover:border-muted-foreground/30 hover:shadow-md',
        'min-h-[120px] h-full',
        'active:scale-[0.98]',
        isActive && 'border-primary ring-1 ring-primary/20 shadow-md',
        !isActive && 'border-border',
      )}
    >
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="mt-2">
        <div className="text-2xl font-semibold tracking-tight">{kpi.value}</div>
        {kpi.change && (
          <div className={cn('text-xs mt-0.5', changeColorMap[kpi.changeType ?? 'neutral'])}>
            {kpi.change}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
      </div>
      {miniChart && <div className="mt-3 h-10">{miniChart}</div>}
    </button>
  )
})
