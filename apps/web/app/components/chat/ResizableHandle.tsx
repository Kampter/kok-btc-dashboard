interface ResizableHandleProps {
  onResizeStart: () => void
}

export function ResizableHandle({ onResizeStart }: ResizableHandleProps) {
  return (
    <div
      role="separator"
      aria-label="调整面板宽度"
      className="absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize hover:bg-border/50 transition-colors z-10"
      onMouseDown={onResizeStart}
      data-testid="resizable-handle"
    />
  )
}
