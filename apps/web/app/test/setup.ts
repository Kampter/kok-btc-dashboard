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

afterEach(() => {
  cleanup()
})
