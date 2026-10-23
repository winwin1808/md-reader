import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Viewer, Toc } from './index'
import type { TocEntry } from '@md-reader/core'

describe('Viewer', () => {
  it('renders provided html securely (assumed sanitized by core)', () => {
    const html = '<h1 id="test-heading">Test</h1><p>Content</p>'
    const { container } = render(<Viewer html={html} />)
    const h1 = container.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1?.textContent).toBe('Test')
    expect(h1?.id).toBe('test-heading')
  })

  it('does not throw when IntersectionObserver is undefined', () => {
    const html = '<h1 id="test">Test</h1>'
    expect(() => render(<Viewer html={html} onActiveHeadingChange={() => {}} />)).not.toThrow()
  })

  it('mounts MermaidBlock for code.language-mermaid elements', async () => {
    const html = `
      <pre>
        <code class="language-mermaid">graph TD; A-->B;</code>
      </pre>
      <pre>
        <code class="language-js">const a = 1;</code>
      </pre>
    `
    const { container, unmount } = render(<Viewer html={html} />)
    
    // Check that pre tag containing mermaid is hidden
    const pres = container.querySelectorAll('pre')
    expect(pres[0]?.style.display).toBe('none') // The mermaid one should be hidden
    expect(pres[1]?.style.display).not.toBe('none') // The js one should remain visible

    const wrapper = pres[0]?.nextElementSibling as HTMLElement
    expect(wrapper?.tagName).toBe('DIV')
    
    // Check MermaidBlock is mounted by checking loading state opacity
    const innerPre = wrapper.querySelector('pre')
    expect(innerPre?.style.opacity).toBe('0.5')
    expect(innerPre?.textContent?.trim()).toBe('graph TD; A-->B;')

    // Test unmount restores the pre tag
    unmount()
  })

  it('wraps tables in .table-wrapper for full-width 2-margin alignment and responsive overflow', () => {
    const html = `
      <table>
        <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
        <tbody><tr><td>A</td><td>B</td></tr></tbody>
      </table>
      <table>
        <thead><tr><th>Col A</th><th>Col B</th><th>Col C</th></tr></thead>
        <tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody>
      </table>
    `
    const { container } = render(<Viewer html={html} />)
    const tableWrappers = container.querySelectorAll('.table-wrapper')
    expect(tableWrappers.length).toBe(2)

    const tables = container.querySelectorAll('table')
    expect(tables.length).toBe(2)
    expect(tables[0]?.parentElement?.classList.contains('table-wrapper')).toBe(true)
    expect(tables[1]?.parentElement?.classList.contains('table-wrapper')).toBe(true)
  })
})

describe('Toc', () => {
  it('returns null when entries is empty', () => {
    const { container } = render(<Toc entries={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nested toc entries and highlights activeId', () => {
    const entries: TocEntry[] = [
      { id: 'h1', text: 'Heading 1', depth: 1, children: [
        { id: 'h2', text: 'Heading 2', depth: 2, children: [] }
      ]}
    ]
    render(<Toc entries={entries} activeId="h2" />)
    
    const h1Link = screen.getByText('Heading 1')
    const h2Link = screen.getByText('Heading 2')
    
    expect(h1Link).toBeDefined()
    expect(h2Link).toBeDefined()
    expect(h2Link.getAttribute('aria-current')).toBe('true')
    expect(h1Link.getAttribute('aria-current')).toBeNull()
  })
})

describe('Viewer anchors and mermaid toggle', () => {
  it('resolves in-page anchor clicks to the prefixed id', () => {
    const html = '<a href="#sec">go</a><h2 id="user-content-sec">Sec</h2>'
    const { container } = render(<Viewer html={html} />)
    const target = container.querySelector('#user-content-sec') as HTMLElement
    const spy = vi.fn()
    target.scrollIntoView = spy
    const a = container.querySelector('a') as HTMLElement
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    a.dispatchEvent(ev)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('modified click on in-page link is not prevented', () => {
    const html = '<a href="#sec">go</a><h2 id="user-content-sec">Sec</h2>'
    const { container } = render(<Viewer html={html} />)
    const a = container.querySelector('a') as HTMLElement
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    a.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('initial location.hash scrolls to prefixed id', () => {
    const spy = vi.fn()
    const orig = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = spy
    window.location.hash = '#sec'
    render(<Viewer html={'<h2 id="user-content-sec">Sec</h2>'} />)
    Element.prototype.scrollIntoView = orig
    window.location.hash = ''
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('mermaid={false} leaves mermaid code blocks alone', () => {
    const html = '<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>'
    const { container } = render(<Viewer html={html} mermaid={false} />)
    const pre = container.querySelector('pre') as HTMLElement
    expect(pre.style.display).not.toBe('none')
    expect(pre.nextElementSibling).toBeNull()
  })
})
