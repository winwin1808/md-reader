import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Icon, ICON_NAMES } from './Icon'

describe('Icon', () => {
  it('renders at least one path for every icon name', () => {
    expect(ICON_NAMES.length).toBe(31)
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      expect(container.querySelectorAll('svg path').length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('label gives role img with accessible name', () => {
    const { getByRole } = render(<Icon name="search" label="Tìm" />)
    expect(getByRole('img', { name: 'Tìm' })).toBeDefined()
  })

  it('without label is aria-hidden and defaults to size 20', () => {
    const { container } = render(<Icon name="close" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('width')).toBe('20')
  })

  it('toolbar, deck and mindmap sources contain no emoji or glyph icons', () => {
    for (const f of ['TopToolbar.tsx', 'Deck.tsx', 'MindmapModal.tsx']) {
      const src = readFileSync(join(__dirname, f), 'utf8')
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}|[←→⛶◫☑⊞⊟✕✍−]/u)
    }
  })
})
