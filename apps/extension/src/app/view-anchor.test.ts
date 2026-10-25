import { describe, it, expect } from 'vitest'
import { nearestHeadingAtTop, lineOfHeading } from './view-anchor'

function mockContainer(top: number, heads: Array<[string, number]>): HTMLElement {
  const nodes = heads.map(([id, t]) => ({ id, getBoundingClientRect: () => ({ top: t }) }))
  return {
    getBoundingClientRect: () => ({ top }),
    querySelectorAll: () => nodes,
  } as unknown as HTMLElement
}

describe('nearestHeadingAtTop', () => {
  it('picks the last heading whose top <= container top + 8', () => {
    const c = mockContainer(100, [['user-content-a', -300], ['user-content-b', 50], ['user-content-c', 107], ['user-content-d', 400]])
    expect(nearestHeadingAtTop(c)).toBe('user-content-c')
  })
  it('null when none above', () => {
    expect(nearestHeadingAtTop(mockContainer(0, [['x', 300]]))).toBeNull()
  })
})

describe('lineOfHeading', () => {
  const src = '# A\n\ntext\n## Bé ơi'
  it('maps slug to 0-based line', () => {
    expect(lineOfHeading(src, 'user-content-bé-ơi')).toBe(3)
    expect(lineOfHeading(src, 'bé-ơi')).toBe(3)
  })
  it('unknown -> null', () => {
    expect(lineOfHeading(src, 'nope')).toBeNull()
  })
})
