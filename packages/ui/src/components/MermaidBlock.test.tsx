import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MermaidBlock, __clearMermaidCache, inlineMermaid } from './MermaidBlock'

vi.mock('mermaid', () => {
  return {
    default: {
      initialize: vi.fn(),
      render: vi.fn().mockImplementation(async (id: string, code: string) => {
        if (code === 'error') {
          throw new Error('Mermaid syntax error')
        }
        return { svg: `<svg id="${id}" data-testid="mermaid-svg">${code}</svg>` }
      })
    }
  }
})

describe('MermaidBlock', () => {
  it('renders loading state initially and then svg on success', async () => {
    const { container } = render(<MermaidBlock code="graph TD; A-->B;" />)
    
    // initially loading
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.style.opacity).toBe('0.5')
    expect(pre?.textContent).toBe('graph TD; A-->B;')

    // wait for success
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-svg')).toBeDefined()
    })

    const svg = screen.getByTestId('mermaid-svg')
    expect(svg.textContent).toBe('graph TD; A-->B;')
  })

  it('renders error state when mermaid throws', async () => {
    render(<MermaidBlock code="error" />)

    await waitFor(() => {
      expect(screen.getByText(/Error rendering mermaid graph/)).toBeDefined()
    })
    
    expect(screen.getByText('error')).toBeDefined() // raw code should be rendered
  })
})

describe('MermaidBlock cache', () => {
  it('caches svg, uses strict, and evicts oldest over 50', async () => {
    const m = (await import('mermaid')).default as any
    __clearMermaidCache()
    m.render.mockClear()
    m.initialize.mockClear()
    const first = render(<MermaidBlock code="X" />)
    await waitFor(() => expect(screen.getByTestId('mermaid-svg')).toBeDefined())
    first.unmount()
    expect(m.render).toHaveBeenCalledTimes(1)
    expect(m.initialize).toHaveBeenCalledWith(expect.objectContaining({ startOnLoad: false, securityLevel: 'strict', theme: 'default' }))
    const second = render(<MermaidBlock code="X" />)
    expect(second.container.querySelector('[data-testid="mermaid-svg"]')).not.toBeNull()
    expect(m.render).toHaveBeenCalledTimes(1)
    second.unmount()

    __clearMermaidCache()
    m.render.mockClear()
    for (let i = 0; i < 51; i++) {
      const r = render(<MermaidBlock code={`c${i}`} />)
      await waitFor(() => expect(r.container.querySelector('[data-testid="mermaid-svg"]')).not.toBeNull())
      r.unmount()
    }
    expect(m.render).toHaveBeenCalledTimes(51)
    const again = render(<MermaidBlock code="c50" />)
    expect(again.container.querySelector('[data-testid="mermaid-svg"]')).not.toBeNull()
    again.unmount()
    expect(m.render).toHaveBeenCalledTimes(51)
    const evicted = render(<MermaidBlock code="c0" />)
    expect(evicted.container.querySelector('pre')).not.toBeNull()
    await waitFor(() => expect(m.render).toHaveBeenCalledTimes(52))
  })
})

describe('MermaidBlock theme', () => {
  it('renders per theme and keeps both in the cache', async () => {
    const m = (await import('mermaid')).default as any
    __clearMermaidCache()
    m.render.mockClear()
    m.initialize.mockClear()
    const r = render(<MermaidBlock code="T" theme="default" />)
    await waitFor(() => expect(r.container.querySelector('[data-testid="mermaid-svg"]')).not.toBeNull())
    expect(m.initialize.mock.calls.at(-1)[0].theme).toBe('default')
    r.rerender(<MermaidBlock code="T" theme="dark" />)
    await waitFor(() => expect(m.render).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(m.initialize.mock.calls.at(-1)[0].theme).toBe('dark'))
    r.rerender(<MermaidBlock code="T" theme="default" />)
    await new Promise((res) => setTimeout(res, 20))
    expect(m.render).toHaveBeenCalledTimes(2)
  })
})

describe('MermaidBlock serialization', () => {
  it('initialize immediately precedes its own render', async () => {
    const m = (await import('mermaid')).default as any
    __clearMermaidCache()
    m.render.mockClear()
    m.initialize.mockClear()
    const order: string[] = []
    m.initialize.mockImplementation((c: any) => { order.push('init:' + c.theme) })
    const orig = m.render.getMockImplementation()
    m.render.mockImplementation(async (id: string, code: string) => {
      order.push('render')
      await new Promise((r) => setTimeout(r, 5))
      return orig(id, code)
    })
    render(<><MermaidBlock code="P" theme="default" /><MermaidBlock code="Q" theme="dark" /></>)
    await waitFor(() => expect(order.length).toBe(4))
    await new Promise((r) => setTimeout(r, 20))
    expect(order).toEqual(['init:default', 'render', 'init:dark', 'render'])
    m.initialize.mockReset()
    m.render.mockImplementation(orig)
  })
})

describe('inlineMermaid', () => {
  it('replaces mermaid blocks with svg, keeps other code, caches', async () => {
    const m = (await import('mermaid')).default as any
    __clearMermaidCache()
    m.render.mockClear()
    const html = '<pre><code class="language-mermaid">A-->B</code></pre><pre><code class="language-js">x</code></pre>'
    const out = await inlineMermaid(html, 'default')
    expect(out).toContain('<svg')
    expect(out).not.toContain('language-mermaid')
    expect(out).toContain('language-js')
    expect(m.render).toHaveBeenCalledTimes(1)
    await inlineMermaid(html, 'default')
    expect(m.render).toHaveBeenCalledTimes(1)
  })
})
