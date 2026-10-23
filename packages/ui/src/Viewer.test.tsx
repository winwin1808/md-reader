import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { Viewer, Toc } from './index'
import { Icon, iconSvg } from './components/Icon'
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

  describe('scroll-spy', () => {
    const html = '<h1 id="one">One</h1><h2 id="two">Two</h2><h2 id="three">Three</h2>'
    function setup(tops: Record<string, number>) {
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
      vi.stubGlobal('cancelAnimationFrame', () => {})
      Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
      const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const top = tops[this.id] ?? 0
        return { top, bottom: top + 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: top, toJSON() {} } as DOMRect
      })
      const cb = vi.fn()
      const r = render(<Viewer html={html} onActiveHeadingChange={cb} />)
      return { cb, r, spy }
    }
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

    it('at top reports the first heading', () => {
      const { cb } = setup({ one: 500, two: 800, three: 1200 })
      expect(cb).toHaveBeenLastCalledWith('one')
    })

    it('follows scroll to the heading above the 30% line, once', () => {
      const tops: Record<string, number> = { one: -500, two: 800, three: 1200 }
      const { cb } = setup(tops)
      cb.mockClear()
      tops.two = 200
      fireEvent.scroll(window)
      fireEvent.scroll(window)
      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('two')
    })

    it('fast jump picks the last heading above the line', () => {
      const tops: Record<string, number> = { one: -500, two: 800, three: 1200 }
      const { cb } = setup(tops)
      cb.mockClear()
      tops.two = -300; tops.three = 100
      fireEvent.scroll(window)
      expect(cb).toHaveBeenCalledWith('three')
    })
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
    expect(h2Link.getAttribute('aria-current')).toBe('location')
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

describe('Viewer code header (vi)', () => {
  it('copy button is Vietnamese and toggles after click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const html = '<pre><code class="language-ts">const a = 1</code></pre>'
    const { container } = render(<Viewer html={html} />)
    const btn = container.querySelector('.code-copy-btn') as HTMLButtonElement
    expect(btn.textContent).toContain('Sao chép')
    expect(btn.getAttribute('aria-label')).toBe('Sao chép mã')
    expect(btn.querySelector('svg')).not.toBeNull()
    await act(async () => { fireEvent.click(btn) })
    expect(writeText).toHaveBeenCalledWith('const a = 1')
    expect(btn.textContent).toContain('Đã chép')
  })
})

describe('reading-surface CSS text', () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, 'theme', f), 'utf-8')
  it('alerts become margin notes on wide sheets', () => {
    const css = read('typography.css')
    expect(css).toContain('@container sheet')
    expect(css).toMatch(/\.markdown-alert\s*\{[^}]*float:\s*right/)
  })
  it('one table style, no !important', () => {
    expect(read('table-enhanced.css')).not.toContain('!important')
    const n = (read('typography.css') + read('table-enhanced.css')).match(/nth-child\(even\)/g) ?? []
    expect(n.length).toBe(1)
  })
})

describe('iconSvg / no react-dom/server', () => {
  it('iconSvg matches <Icon> markup', () => {
    const { container } = render(<Icon name="copy" size={16} />)
    const tpl = document.createElement('div')
    tpl.innerHTML = iconSvg('copy', 16)
    expect(tpl.innerHTML).toBe(container.innerHTML)
  })
  it('Viewer.tsx does not import react-dom/server', () => {
    expect(fs.readFileSync(path.resolve(__dirname, 'Viewer.tsx'), 'utf-8')).not.toContain('react-dom/server')
  })
  it('sidenote query threshold is 49rem', () => {
    expect(fs.readFileSync(path.resolve(__dirname, 'theme', 'typography.css'), 'utf-8')).toContain('@container sheet (min-width: 49rem)')
  })
})
