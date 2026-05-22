import { memo } from 'react'
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

  return (
    <ResizableDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      {children}
    </ResizableDrawer>
  )
})
