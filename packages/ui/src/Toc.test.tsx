import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Toc } from './Toc'
import type { TocEntry } from '@md-reader/core'

describe('Toc', () => {
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
    const title = screen.getByText('Mục lục')
    expect(title).toBeDefined()
    expect(title.className).toBe('md-toc-title')
  })

  it('renders links with proper depth indentation style', () => {
    render(<Toc entries={sampleEntries} />)
    const h1Link = screen.getByRole('link', { name: 'Heading 1' })
    const h11Link = screen.getByRole('link', { name: 'Heading 1.1' })

    expect(h1Link.style.paddingLeft).toBe('8px')
    expect(h11Link.style.paddingLeft).toBe('20px')
  })

  it('marks activeId with aria-current="true"', () => {
    render(<Toc entries={sampleEntries} activeId="heading-1-1" />)
    const activeLink = screen.getByRole('link', { name: 'Heading 1.1' })
    expect(activeLink.getAttribute('aria-current')).toBe('true')

    const inactiveLink = screen.getByRole('link', { name: 'Heading 1' })
    expect(inactiveLink.getAttribute('aria-current')).toBeNull()
  })

  it('invokes onSelect when link clicked', () => {
    const onSelect = vi.fn()
    render(<Toc entries={sampleEntries} onSelect={onSelect} />)
    const link = screen.getByRole('link', { name: 'Heading 2' })
    fireEvent.click(link)
    expect(onSelect).toHaveBeenCalledWith('heading-2')
  })

  it('renders toggle button for entries with deeper children and truncates anchor text', () => {
    render(<Toc entries={sampleEntries} />)
    const toggleBtn = screen.getByRole('button', { name: 'Thu gọn / Mở rộng mục' })
    expect(toggleBtn).toBeDefined()
    expect(toggleBtn.textContent).toBe('▼')

    const h1Link = screen.getByRole('link', { name: 'Heading 1' })
    expect(h1Link.getAttribute('title')).toBe('Heading 1')
    expect(h1Link.style.textOverflow).toBe('ellipsis')
    expect(h1Link.style.overflow).toBe('hidden')
    expect(h1Link.style.whiteSpace).toBe('nowrap')

    const buttons = screen.getAllByRole('button', { name: 'Thu gọn / Mở rộng mục' })
    expect(buttons).toHaveLength(1)
  })

  it('toggles section collapse when toggle button is clicked', () => {
    render(<Toc entries={sampleEntries} />)
    expect(screen.getByRole('link', { name: 'Heading 1.1' })).toBeDefined()

    const toggleBtn = screen.getByRole('button', { name: 'Thu gọn / Mở rộng mục' })
    expect(toggleBtn.textContent).toBe('▼')

    // Collapse
    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toBe('▶')
    expect(screen.queryByRole('link', { name: 'Heading 1.1' })).toBeNull()

    // Expand again
    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toBe('▼')
    expect(screen.getByRole('link', { name: 'Heading 1.1' })).toBeDefined()
  })

  it('supports collapsible hierarchy with flat entries', () => {
    const flatEntries: TocEntry[] = [
      { id: 'sec-1', text: 'Section 1', depth: 1, children: [] },
      { id: 'sec-1-1', text: 'Section 1.1', depth: 2, children: [] },
      { id: 'sec-2', text: 'Section 2', depth: 1, children: [] },
    ]
    render(<Toc entries={flatEntries} />)
    const toggleBtn = screen.getByRole('button', { name: 'Thu gọn / Mở rộng mục' })
    expect(toggleBtn.textContent).toBe('▼')
    expect(screen.getByRole('link', { name: 'Section 1.1' })).toBeDefined()

    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toBe('▶')
    expect(screen.queryByRole('link', { name: 'Section 1.1' })).toBeNull()
  })
})

