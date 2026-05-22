import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Recharts / jsdom: mock ResizeObserver and element dimensions
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver = ResizeObserverMock

Object.defineProperty(globalThis.Element.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: () => ({ width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800 }),
})

// jsdom localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    length: 0,
    key: () => null,
  }
})()
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

afterEach(() => {
  cleanup()
})
