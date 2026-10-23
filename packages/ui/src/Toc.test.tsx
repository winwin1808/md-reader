import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Toc } from './Toc'
import { Viewer } from './Viewer'
import type { TocEntry } from '@md-reader/core'

describe('Toc', () => {
  it('marks exactly one link current and calls onNavigate on click', () => {
    const onNavigate = vi.fn()
    render(<Toc entries={[{ id: 'a', text: 'A', depth: 1, children: [] }, { id: 'b', text: 'B', depth: 1, children: [] }]} activeId="a" onNavigate={onNavigate} />)
    expect(document.querySelectorAll('[aria-current="location"]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: 'B' }))
    expect(onNavigate).toHaveBeenCalledWith('b')
  })

  afterEach(() => {
    cleanup()
  })

  const sampleEntries: TocEntry[] = [
    {
      id: 'heading-1',
      text: 'Heading 1',
      depth: 1,
      children: [
        {
          id: 'heading-1-1',
          text: 'Heading 1.1',
          depth: 2,
          children: [],
        },
      ],
    },
    {
      id: 'heading-2',
      text: 'Heading 2',
      depth: 1,
      children: [],
    },
  ]

  it('renders null when entries is empty', () => {
    const { container } = render(<Toc entries={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders table of contents with title "Mục lục"', () => {
    render(<Toc entries={sampleEntries} />)
    const title = screen.getByRole('heading', { name: 'Mục lục', level: 2 })
    expect(title.className).toBe('sr-only')
    expect(screen.queryByText('MỤC LỤC')).toBeNull()
  })

  it('renders items with proper flex layout and depth indentation on li', () => {
    render(<Toc entries={sampleEntries} />)
    const h1Link = screen.getByRole('link', { name: 'Heading 1' })
    const h11Link = screen.getByRole('link', { name: 'Heading 1.1' })

    const h1Li = h1Link.closest('li')!
    const h11Li = h11Link.closest('li')!

    expect(h1Li.style.display).toBe('flex')
    expect(h1Li.style.alignItems).toBe('center')
    expect(h1Li.style.paddingLeft).toBe('0px')
    expect(h1Li.className).toContain('md-toc-item depth-1')

    expect(h11Li.style.display).toBe('flex')
    expect(h11Li.style.alignItems).toBe('center')
    expect(h11Li.style.paddingLeft).toBe('12px')
    expect(h11Li.className).toContain('md-toc-item depth-2')
  })

  it('marks activeId with active class and aria-current="location"', () => {
    render(<Toc entries={sampleEntries} activeId="heading-1-1" />)
    const activeLink = screen.getByRole('link', { name: 'Heading 1.1' })
    expect(activeLink.getAttribute('aria-current')).toBe('location')
    const activeLi = activeLink.closest('li')!
    expect(activeLi.className).toContain('active')

    const inactiveLink = screen.getByRole('link', { name: 'Heading 1' })
    expect(inactiveLink.getAttribute('aria-current')).toBeNull()
    const inactiveLi = inactiveLink.closest('li')!
    expect(inactiveLi.className).not.toContain('active')
  })

  it('invokes onSelect when link clicked', () => {
    const onSelect = vi.fn()
    render(<Toc entries={sampleEntries} onSelect={onSelect} />)
    const link = screen.getByRole('link', { name: 'Heading 2' })
    fireEvent.click(link)
    expect(onSelect).toHaveBeenCalledWith('heading-2')
  })

  it('renders toggle button for entries with deeper children, spacer for leaf entries, and truncates anchor text', () => {
    render(<Toc entries={sampleEntries} />)
    const toggleBtn = screen.getByRole('button', { name: 'Thu gọn hoặc mở rộng Heading 1' })
    expect(toggleBtn).toBeDefined()
    expect(toggleBtn.textContent).toBe('▼')
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true')
    expect(toggleBtn.className).toBe('toc-collapse-btn')

    const h1Link = screen.getByRole('link', { name: 'Heading 1' })
    expect(h1Link.getAttribute('title')).toBe('Heading 1')
    expect(h1Link.className).toBe('md-toc-link')
    expect(h1Link.style.textOverflow).toBe('ellipsis')
    expect(h1Link.style.overflow).toBe('hidden')
    expect(h1Link.style.whiteSpace).toBe('nowrap')

    const h2Link = screen.getByRole('link', { name: 'Heading 2' })
    const h2Li = h2Link.closest('li')!
    const spacer = h2Li.querySelector('span')
    expect(spacer).not.toBeNull()
    expect(spacer?.style.width).toBe('16px')
    expect(spacer?.style.display).toBe('inline-block')

    const buttons = screen.getAllByRole('button', { name: /Thu gọn hoặc mở rộng/ })
    expect(buttons).toHaveLength(1)
  })

  it('toggles section collapse when toggle button is clicked', () => {
    render(<Toc entries={sampleEntries} />)
    expect(screen.getByRole('link', { name: 'Heading 1.1' })).toBeDefined()

    const toggleBtn = screen.getByRole('button', { name: 'Thu gọn hoặc mở rộng Heading 1' })
    expect(toggleBtn.textContent).toBe('▼')
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true')

    // Collapse
    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toBe('▶')
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: 'Heading 1.1' })).toBeNull()

    // Expand again
    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toBe('▼')
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'Heading 1.1' })).toBeDefined()
  })

  it('supports collapsible hierarchy with flat entries', () => {
    const flatEntries: TocEntry[] = [
      { id: 'sec-1', text: 'Section 1', depth: 1, children: [] },
      { id: 'sec-1-1', text: 'Section 1.1', depth: 2, children: [] },
      { id: 'sec-2', text: 'Section 2', depth: 1, children: [] },
    ]
    render(<Toc entries={flatEntries} />)
    const toggleBtn = screen.getByRole('button', { name: 'Thu gọn hoặc mở rộng Section 1' })
    expect(toggleBtn.textContent).toBe('▼')
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'Section 1.1' })).toBeDefined()

    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toBe('▶')
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: 'Section 1.1' })).toBeNull()
  })
})


describe('Viewer scroll-spy', () => {
  const orig = (globalThis as any).IntersectionObserver
  afterEach(() => { cleanup(); ;(globalThis as any).IntersectionObserver = orig })

  it('does not throw without IntersectionObserver', () => {
    ;(globalThis as any).IntersectionObserver = undefined
    expect(() => render(<Viewer html={'<h2 id="x">X</h2>'} onActiveHeadingChange={() => {}} />)).not.toThrow()
  })
})
