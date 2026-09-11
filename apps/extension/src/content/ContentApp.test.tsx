import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ContentApp } from './ContentApp'
import React from 'react'

vi.mock('@md-reader/core', () => ({
  parseMarkdown: vi.fn((md: string) => ({ tree: {} })),
  renderToHtml: vi.fn((ast) => ({
    html: '<h1 id="test">Test</h1>',
    toc: [{ id: 'test', depth: 1, text: 'Test', children: [] }]
  }))
}))

vi.mock('@md-reader/ui', () => ({
  ThemeProvider: ({ children }: any) => <div data-testid="theme-provider">{children}</div>,
  Viewer: ({ html }: any) => <div data-testid="viewer">{html}</div>,
  Toc: ({ entries }: any) => <div data-testid="toc">{entries.length} entries</div>
}))

describe('ContentApp', () => {
  it('renders ThemeProvider, Viewer, Toc and fixed button', () => {
    const originalOpen = window.open
    window.open = vi.fn()
    
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://123/${path}`)
      }
    } as any

    render(<ContentApp markdown="# Test" />)
    
    expect(screen.queryByTestId('theme-provider')).toBeTruthy()
    expect(screen.queryByTestId('viewer')).toBeTruthy()
    expect(screen.queryByTestId('toc')).toBeTruthy()
    
    const btn = screen.getByRole('button', { name: /Open in MD Reader/i })
    expect(btn).toBeTruthy()
    
    fireEvent.click(btn)
    expect(window.open).toHaveBeenCalledWith('chrome-extension://123/app.html')
    
    window.open = originalOpen
  })
})
