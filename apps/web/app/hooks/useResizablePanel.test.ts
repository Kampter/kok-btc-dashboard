import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizablePanel } from './useResizablePanel'

describe('useResizablePanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns default width and not collapsed on first load', () => {
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(380)
    expect(result.current.isCollapsed).toBe(false)
  })

  it('reads persisted state from localStorage', () => {
    localStorage.setItem('kok:copilot-panel', JSON.stringify({ width: 450, isCollapsed: true }))
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(450)
    expect(result.current.isCollapsed).toBe(true)
  })

  it('updates width and persists to localStorage', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(500)
    })
    expect(result.current.width).toBe(500)
    const stored = JSON.parse(localStorage.getItem('kok:copilot-panel')!)
    expect(stored.width).toBe(500)
  })

  it('clamps width to min 280', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(100)
    })
    expect(result.current.width).toBe(280)
  })

  it('clamps width to max 600', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(800)
    })
    expect(result.current.width).toBe(600)
  })

  it('toggles collapse state and persists', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.toggleCollapse()
    })
    expect(result.current.isCollapsed).toBe(true)
    const stored = JSON.parse(localStorage.getItem('kok:copilot-panel')!)
    expect(stored.isCollapsed).toBe(true)

    act(() => {
      result.current.toggleCollapse()
    })
    expect(result.current.isCollapsed).toBe(false)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('kok:copilot-panel', 'not-json')
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(380)
    expect(result.current.isCollapsed).toBe(false)
  })

  it('handles NaN width in localStorage gracefully', () => {
    localStorage.setItem('kok:copilot-panel', JSON.stringify({ width: NaN, isCollapsed: false }))
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(380)
    expect(result.current.isCollapsed).toBe(false)
  })
})
