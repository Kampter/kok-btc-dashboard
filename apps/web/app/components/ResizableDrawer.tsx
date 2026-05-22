import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

export interface ResizableDrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  defaultWidth?: number       // default: 520
  minWidth?: number           // default: 480
  maxWidth?: number           // default: Math.floor(window.innerWidth * 0.8)
  storageKey?: string         // default: 'kok:drawer:width'
}

const DEFAULT_WIDTH = 520
const MIN_WIDTH = 480
const STORAGE_KEY = 'kok:drawer:width'

function readStoredWidth(key: string, defaultValue: number): number {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!Number.isNaN(parsed)) return parsed
    }
  } catch {
    // localStorage may be unavailable
  }
  return defaultValue
}

function writeStoredWidth(key: string, width: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, String(width))
  } catch {
    // localStorage may be unavailable
  }
}

export const ResizableDrawer = memo(function ResizableDrawer({
  isOpen,
  onClose,
  title,
  children,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth,
  storageKey = STORAGE_KEY,
}: ResizableDrawerProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(0)

  // Read stored width on mount
  useEffect(() => {
    const stored = readStoredWidth(storageKey, defaultWidth)
    const viewportMax = maxWidth ?? Math.floor(window.innerWidth * 0.8)
    const clamped = Math.max(minWidth, Math.min(viewportMax, stored))
    setDrawerWidth(clamped)
  }, [defaultWidth, maxWidth, minWidth, storageKey])

  // Update max width when viewport changes
  useEffect(() => {
    if (maxWidth !== undefined) return
    const handleResize = () => {
      setDrawerWidth((current) => {
        const viewportMax = Math.floor(window.innerWidth * 0.8)
        return Math.min(current, viewportMax)
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [maxWidth])

  const handleClose = useCallback(() => {
    setIsClosing(true)
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
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, handleClose])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      setIsDragging(true)

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      dragStartXRef.current = clientX
      dragStartWidthRef.current = drawerWidth

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [drawerWidth]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const delta = dragStartXRef.current - clientX
      const newWidth = dragStartWidthRef.current + delta
      const viewportMax = maxWidth ?? Math.floor(window.innerWidth * 0.8)
      const clamped = Math.max(minWidth, Math.min(viewportMax, newWidth))
      setDrawerWidth(clamped)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      writeStoredWidth(storageKey, drawerWidth)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleMouseMove)
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [isDragging, drawerWidth, maxWidth, minWidth, storageKey])

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
          'flex flex-col',
        )}
        style={{
          width: `${drawerWidth}px`,
          animation: `${animationName} ${animationDuration} cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
        role="dialog"
        aria-modal="true"
        data-testid="resizable-drawer"
      >
        {/* Resize handle */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-3 -translate-x-1/2 z-50',
            'cursor-col-resize touch-none',
            'bg-muted/30 hover:bg-primary/40 transition-colors',
            'flex items-center justify-center',
          )}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          role="separator"
          aria-label="调整面板宽度"
          data-testid="resize-handle"
        >
          <div className="w-0.5 h-6 bg-muted-foreground/50 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold">{title || '详情'}</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="关闭"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
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
