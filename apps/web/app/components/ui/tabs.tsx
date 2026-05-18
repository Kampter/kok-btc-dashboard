import * as React from 'react'
import { cn } from '../../lib/utils'

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>')
  return ctx
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 border-b border-border',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { value: activeValue, onValueChange } = useTabs()
  const isActive = activeValue === value

  return (
    <button
      onClick={() => onValueChange(value)}
      className={cn(
        'relative px-4 py-2.5 text-sm font-medium transition-colors',
        'hover:text-foreground',
        isActive
          ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
          : 'text-muted-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { value: activeValue } = useTabs()
  if (activeValue !== value) return null
  return <div className={cn('pt-4', className)}>{children}</div>
}
