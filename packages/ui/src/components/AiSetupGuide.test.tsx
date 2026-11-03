import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MCP_PACKAGE_SPEC } from '@md-reader/core'
import { AiSetupGuide, mcpSetupSnippet } from './AiSetupGuide'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('mcpSetupSnippet', () => {
  it('builds per-client snippets', () => {
    expect(mcpSetupSnippet('claudeCode')).toContain(MCP_PACKAGE_SPEC)
    const d = JSON.parse(mcpSetupSnippet('claudeDesktop'))
    expect(d.mcpServers['md-reader'].args[1]).toBe(MCP_PACKAGE_SPEC)
    expect(mcpSetupSnippet('cursor')).toBe(mcpSetupSnippet('claudeDesktop'))
  })
})

describe('AiSetupGuide', () => {
  it('opens by default only when there are no clients', () => {
    const { container, unmount } = render(<AiSetupGuide hasClients={false} />)
    expect(container.querySelector('details')).toHaveAttribute('open')
    unmount()
    const r = render(<AiSetupGuide hasClients={true} />)
    expect(r.container.querySelector('details')).not.toHaveAttribute('open')
  })

  it('switches tabs by click and arrow keys (wrapping)', () => {
    render(<AiSetupGuide hasClients={false} />)
    const cursor = screen.getByRole('tab', { name: 'Cursor' })
    fireEvent.click(cursor)
    expect(cursor).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('"mcpServers"')
    fireEvent.keyDown(cursor, { key: 'ArrowRight' })
    const cc = screen.getByRole('tab', { name: 'Claude Code' })
    expect(cc).toHaveAttribute('aria-selected', 'true')
    expect(cc).toHaveFocus()
  })

  it('copies the selected snippet and shows Đã chép', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<AiSetupGuide hasClients={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cursor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
    expect(writeText).toHaveBeenCalledWith(mcpSetupSnippet('cursor'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đã chép' })).toBeInTheDocument())
  })

  it('shows the failure text when copy rejects', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } })
    render(<AiSetupGuide hasClients={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Không chép được'))
  })
})
