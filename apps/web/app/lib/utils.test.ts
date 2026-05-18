import { describe, it, expect } from 'vitest'
import { cn, formatUSD, formatPercent } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('merges tailwind conflicting classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('formatUSD', () => {
  it('formats billions', () => {
    expect(formatUSD(1_500_000_000)).toBe('$1.50B')
  })

  it('formats millions', () => {
    expect(formatUSD(2_500_000)).toBe('$2.50M')
  })

  it('formats thousands', () => {
    expect(formatUSD(3_500)).toBe('$3.50K')
  })

  it('formats regular numbers', () => {
    expect(formatUSD(999)).toBe('$999')
  })

  it('formats zero', () => {
    expect(formatUSD(0)).toBe('$0')
  })

  it('formats negative values', () => {
    // formatUSD 使用 >= 判断，负数不满足任何阈值，直接返回 toFixed(0)
    expect(formatUSD(-1_500_000)).toBe('$-1500000')
    expect(formatUSD(-500)).toBe('$-500')
  })
})

describe('formatPercent', () => {
  it('formats regular percentages', () => {
    expect(formatPercent(12.345)).toBe('12.35%')
  })

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('formats high precision values', () => {
    expect(formatPercent(0.00123)).toBe('0.00%')
    expect(formatPercent(99.999)).toBe('100.00%')
    expect(formatPercent(0.005)).toBe('0.01%')
  })

  it('formats negative percentages', () => {
    expect(formatPercent(-5.5)).toBe('-5.50%')
  })
})
