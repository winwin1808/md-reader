import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('lazy KaTeX', () => {
  beforeEach(() => { vi.resetModules() })

  it('does not load katex for a document without math', async () => {
    const spy = vi.fn()
    vi.doMock('rehype-katex', () => { spy(); return { default: () => () => {} } })
    const { defaultRenderPlugins, isMathLoaded } = await import('./index.js')
    const { parseMarkdown, renderToHtml } = await import('../index.js')
    const html = renderToHtml(parseMarkdown('# Hi\n\ntext', { math: true }), { plugins: defaultRenderPlugins() }).html
    await new Promise((r) => setTimeout(r, 20))
    expect(html).toContain('Hi')
    expect(spy).not.toHaveBeenCalled()
    expect(isMathLoaded()).toBe(false)
    vi.doUnmock('rehype-katex')
  })

  it('loads on math and renders .katex after load', async () => {
    const { defaultRenderPlugins, onMathLoaded, isMathLoaded } = await import('./index.js')
    const { parseMarkdown, renderToHtml } = await import('../index.js')
    const plugins = defaultRenderPlugins()
    const parsed = parseMarkdown('Inline $x^2$ here', { math: true })
    const loaded = new Promise<void>((res) => onMathLoaded(res))
    const before = renderToHtml(parsed, { plugins }).html
    expect(before).not.toContain('class="katex"')
    await loaded
    expect(isMathLoaded()).toBe(true)
    expect(renderToHtml(parsed, { plugins }).html).toContain('katex')
  })

  it('loadMathPlugin rejects when the import fails and retries next call (15o)', async () => {
    let fail = true
    vi.doMock('rehype-katex', () => { if (fail) throw new Error('chunk failed'); return { default: () => () => {} } })
    const { loadMathPlugin, isMathLoaded } = await import('./index.js')
    await expect(loadMathPlugin()).rejects.toThrow()
    expect(isMathLoaded()).toBe(false)
    fail = false
    await expect(loadMathPlugin()).resolves.toBeUndefined()
    expect(isMathLoaded()).toBe(true)
    vi.doUnmock('rehype-katex')
  })
})
