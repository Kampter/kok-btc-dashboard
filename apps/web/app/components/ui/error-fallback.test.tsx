import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorFallback } from './error-fallback'

describe('ErrorFallback', () => {
  it('renders error title', () => {
    render(<ErrorFallback />)
    expect(screen.getByText('数据加载失败')).toBeInTheDocument()
  })

  it('renders custom title when provided', () => {
    render(<ErrorFallback title="自定义错误" />)
    expect(screen.getByText('自定义错误')).toBeInTheDocument()
  })

  it('renders default message', () => {
    render(<ErrorFallback />)
    expect(screen.getByText('无法获取最新数据，请稍后重试')).toBeInTheDocument()
  })

  it('renders custom message when provided', () => {
    render(<ErrorFallback message="网络连接超时" />)
    expect(screen.getByText('网络连接超时')).toBeInTheDocument()
  })

  it('renders retry button when onRetry is provided', () => {
    render(<ErrorFallback onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorFallback />)
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
  })

  it('calls onRetry when button clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorFallback onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
