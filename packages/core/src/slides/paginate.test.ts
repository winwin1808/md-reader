import { describe, it, expect } from 'vitest'
import { paginateBlocks, SMALL_ZOOM, type BlockBox } from './paginate.js'

const b = (height: number, keepWithNext = false, width = 10): BlockBox => ({ height, width, keepWithNext })

describe('paginateBlocks', () => {
  it('exposes SMALL_ZOOM', () => {
    expect(SMALL_ZOOM).toBe(0.6)
  })

  it('returns [] for empty input', () => {
    expect(paginateBlocks([], 100, 100)).toEqual([])
  })

  it('returns a single page when maxH or maxW <= 0', () => {
    const blocks = [b(50), b(70), b(90)]
    expect(paginateBlocks(blocks, 0, 100)).toEqual([{ start: 0, end: 3, zoom: 1 }])
    expect(paginateBlocks(blocks, 100, -1)).toEqual([{ start: 0, end: 3, zoom: 1 }])
  })

  it('keeps blocks that exactly fill maxH on one page', () => {
    expect(paginateBlocks([b(40), b(60)], 100, 100)).toEqual([{ start: 0, end: 2, zoom: 1 }])
  })

  it('moves to a new page when exceeding by 1', () => {
    expect(paginateBlocks([b(40), b(61)], 100, 100)).toEqual([
      { start: 0, end: 1, zoom: 1 },
      { start: 1, end: 2, zoom: 1 },
    ])
  })

  it('does not leave a heading at the bottom of a page', () => {
    // 80 used; heading 10 fits alone, but heading + next (30) does not
    const pages = paginateBlocks([b(80), b(10, true), b(30)], 100, 100)
    expect(pages).toEqual([
      { start: 0, end: 1, zoom: 1 },
      { start: 1, end: 3, zoom: 1 },
    ])
  })

  it('terminates on a run of only headings', () => {
    const pages = paginateBlocks([b(60, true), b(60, true), b(60, true)], 100, 100)
    expect(pages.map((p) => [p.start, p.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ])
  })

  it('handles a trailing heading', () => {
    const pages = paginateBlocks([b(90), b(20, true)], 100, 100)
    expect(pages.map((p) => [p.start, p.end])).toEqual([
      [0, 1],
      [1, 2],
    ])
  })

  it('zooms a too-tall block', () => {
    expect(paginateBlocks([b(400)], 100, 100)).toEqual([{ start: 0, end: 1, zoom: 0.25 }])
  })

  it('zooms a too-wide block', () => {
    expect(paginateBlocks([b(50, false, 400)], 100, 100)).toEqual([{ start: 0, end: 1, zoom: 0.25 }])
  })

  it('has no zoom floor', () => {
    expect(paginateBlocks([b(10000)], 100, 100)[0]!.zoom).toBe(0.01)
  })

  it('closes the page before and opens a new one after an oversize block', () => {
    const pages = paginateBlocks([b(30), b(200), b(30)], 100, 100)
    expect(pages).toEqual([
      { start: 0, end: 1, zoom: 1 },
      { start: 1, end: 2, zoom: 0.5 },
      { start: 2, end: 3, zoom: 1 },
    ])
  })

  it('puts a heading on its own page right before an oversize next block', () => {
    const pages = paginateBlocks([b(30), b(10, true), b(200)], 100, 100)
    expect(pages).toEqual([
      { start: 0, end: 1, zoom: 1 },
      { start: 1, end: 2, zoom: 1 },
      { start: 2, end: 3, zoom: 0.5 },
    ])
  })

  it('covers every block contiguously on mixed data', () => {
    const blocks: BlockBox[] = []
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 200; i++) {
      const r = rnd()
      blocks.push(b(Math.ceil(rnd() * 140) + 5, r < 0.25, r > 0.95 ? 300 : 50))
    }
    const maxH = 100
    const pages = paginateBlocks(blocks, maxH, 100)
    let next = 0
    for (const p of pages) {
      expect(p.start).toBe(next)
      expect(p.end).toBeGreaterThan(p.start)
      next = p.end
      if (p.zoom === 1) {
        const sum = blocks.slice(p.start, p.end).reduce((s, x) => s + x.height, 0)
        expect(sum).toBeLessThanOrEqual(maxH)
      }
    }
    expect(next).toBe(blocks.length)
  })
})
