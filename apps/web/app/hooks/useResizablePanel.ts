import { useState, useCallback } from 'react'

const STORAGE_KEY = 'kok:copilot-panel'
const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 600

interface PanelState {
  width: number
  isCollapsed: boolean
}

function loadState(): PanelState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        typeof parsed.width === 'number' &&
        !Number.isNaN(parsed.width) &&
        typeof parsed.isCollapsed === 'boolean'
      ) {
        return {
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width)),
          isCollapsed: parsed.isCollapsed,
        }
      }
    }
  } catch {
    // corrupted or unavailable
  }
  return { width: DEFAULT_WIDTH, isCollapsed: false }
}

function saveState(state: PanelState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable
  }
}

export function useResizablePanel() {
  const [state, setState] = useState<PanelState>(loadState)

  const setWidth = useCallback((width: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
    setState((prev) => {
      const next = { ...prev, width: clamped }
      saveState(next)
      return next
    })
  }, [])

  const toggleCollapse = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, isCollapsed: !prev.isCollapsed }
      saveState(next)
      return next
    })
  }, [])

  return {
    width: state.width,
    isCollapsed: state.isCollapsed,
    setWidth,
    toggleCollapse,
  }
}
