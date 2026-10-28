import { describe, it, expect } from 'vitest'
import { renderMarkdownForPage, MAX_RENDER_CHARS } from './render-md'

describe('renderMarkdownForPage', () => {
  it('renders heading, list, table, alert and takes title from first H1', () => {
    const md = '# Tiêu đề\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n> [!NOTE]\n> hi\n'
    const r = renderMarkdownForPage(md)
    expect(r.title).toBe('Tiêu đề')
    expect(r.html).toContain('<h1')
    expect(r.html).toContain('<li>')
    expect(r.html).toContain('<table')
    expect(r.html.toLowerCase()).toContain('note')
    expect(MAX_RENDER_CHARS).toBe(2_000_000)
  })
  it('alert label defaults to English, vi opt-in', () => {
    const md = '> [!NOTE]\nx'
    const en = renderMarkdownForPage(md).html
    expect(en).toContain('Note')
    expect(en).not.toContain('Ghi chú')
    expect(renderMarkdownForPage(md, { alertLang: 'vi' }).html).toContain('Ghi chú')
  })
  it('title is null without H1', () => {
    expect(renderMarkdownForPage('## only h2').title).toBeNull()
  })
  it('strips scripts and event handlers', () => {
    const r = renderMarkdownForPage('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n')
    expect(r.html).not.toContain('<script')
    expect(r.html).not.toContain('onerror')
  })
  it('does not render math with katex and keeps mermaid as code', () => {
    const r = renderMarkdownForPage('$x$\n\n```mermaid\ngraph TD\nA-->B\n```\n')
    expect(r.html).not.toContain('katex')
    expect(r.html).toContain('language-mermaid')
    expect(r.html).toContain('<code')
  })
  it('does not render frontmatter as text', () => {
    const r = renderMarkdownForPage('---\ntitle: SECRETFM\n---\n\n# Hi\n')
    expect(r.html).not.toContain('SECRETFM')
  })
  it('drops javascript: and data:text/html hrefs', () => {
    const r = renderMarkdownForPage('[x](javascript:alert(1))\n\n[y](data:text/html,<b>)\n')
    expect(r.html.toLowerCase()).not.toContain('javascript:')
    expect(r.html.toLowerCase()).not.toContain('data:text/html')
  })
})
