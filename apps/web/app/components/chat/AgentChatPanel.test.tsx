import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { AgentChatPanel } from './AgentChatPanel'

vi.mock('../../hooks/useAgentChat', () => ({
  useAgentChat: () => ({
    messages: [{ id: '1', role: 'assistant', content: 'Hello' }],
    isLoading: false,
    sendMessage: vi.fn(),
  }),
}))

// Mock useResizablePanel with isolated state per test
vi.mock('../../hooks/useResizablePanel', () => ({
  useResizablePanel: () => {
    const [width, setWidth] = useState(380)
    const [isCollapsed, setIsCollapsed] = useState(false)
    return {
      width,
      isCollapsed,
      setWidth,
      toggleCollapse: () => setIsCollapsed((prev: boolean) => !prev),
    }
  },
}))

describe('AgentChatPanel', () => {
  it('renders full panel when not collapsed', () => {
    render(<AgentChatPanel />)
    expect(screen.getByText('AI Copilot')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('输入问题...')).toBeInTheDocument()
  })

  it('renders collapse button', () => {
    render(<AgentChatPanel />)
    expect(screen.getByLabelText('收起面板')).toBeInTheDocument()
  })

  it('collapses panel when collapse button is clicked', () => {
    render(<AgentChatPanel />)
    fireEvent.click(screen.getByLabelText('收起面板'))
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.getByLabelText('展开面板')).toBeInTheDocument()
  })

  it('expands panel when expand button is clicked', () => {
    render(<AgentChatPanel />)
    fireEvent.click(screen.getByLabelText('收起面板'))
    fireEvent.click(screen.getByLabelText('展开面板'))
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByLabelText('收起面板')).toBeInTheDocument()
  })

  it('renders resizable handle when expanded', () => {
    render(<AgentChatPanel />)
    expect(screen.getByTestId('resizable-handle')).toBeInTheDocument()
  })

  it('does not render resizable handle when collapsed', () => {
    render(<AgentChatPanel />)
    fireEvent.click(screen.getByLabelText('收起面板'))
    expect(screen.queryByTestId('resizable-handle')).not.toBeInTheDocument()
  })
})
