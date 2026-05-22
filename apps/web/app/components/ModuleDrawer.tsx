import { memo, useCallback } from 'react'
import { ResizableDrawer } from './ResizableDrawer'

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

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <ResizableDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
    >
      {children}
    </ResizableDrawer>
  )
})
