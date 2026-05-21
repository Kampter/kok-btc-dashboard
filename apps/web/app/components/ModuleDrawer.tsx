import { memo, useEffect, useState, useCallback } from 'react'
import { cn } from '../lib/utils'

export interface ModuleDrawerProps {
  moduleId: string | null
  title?: string
  onClose: () => void
  children: React.ReactNode
}

export const ModuleDrawer = memo(function ModuleDrawer({
  moduleId,
  title,
  onClose,
  children,
}: ModuleDrawerProps) {
  const isOpen = moduleId !== null
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = useCallback(() => {
    setIsClosing(true)
    // Delay actual close to allow animation to play
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    // Prevent background scrolling when drawer is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, handleClose])

  if (!isOpen && !isClosing) return null

  const animationName = isClosing ? 'slideOutRight' : 'slideInRight'
  const animationDuration = isClosing ? '200ms' : '300ms'

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40',
          isClosing ? 'opacity-0' : 'bg-black/40',
        )}
        style={{
          transition: 'opacity 200ms ease',
        }}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'fixed right-0 top-0 h-full z-50 bg-background border-l border-border shadow-lg',
          'w-full sm:w-[520px]',
          'flex flex-col',
        )}
        style={{
          animation: `${animationName} ${animationDuration} cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold">{title || '详情'}</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="关闭"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </>
  )
})
