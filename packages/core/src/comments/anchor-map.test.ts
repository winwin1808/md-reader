import { describe, it, expect } from 'vitest'
import { parseSourcePos, selectionToSourceRange } from './anchor-map.js'

function sel(src: string, text: string, occ = 0, block = { start: 0, end: src.length }) {
  const r = selectionToSourceRange(src, block, text, occ)
  return { ...r, got: src.slice(r.from, r.to) }
}

describe('parseSourcePos', () => {
  it('parses valid', () => {
    expect(parseSourcePos('12:40')).toEqual({ start: 12, end: 40 })
    expect(parseSourcePos('0:0')).toEqual({ start: 0, end: 0 })
  })
  it('rejects invalid', () => {
    for (const v of [null, '', 'a:b', '1:', '5:3', '-1:4', '1.5:3', '1:2:3', ' 1:2'])
      expect(parseSourcePos(v)).toBeNull()
  })
})

describe('selectionToSourceRange', () => {
  it('plain paragraph', () => {
    expect(sel('hello world', 'world')).toMatchObject({ exact: true, got: 'world' })
  })
  it('inside bold', () => {
    expect(sel('a **đậm** b', 'đậm')).toMatchObject({ exact: true, got: 'đậm' })
  })
  it('across bold', () => {
    expect(sel('x\n\na **b** c\n\ny', 'a b c', 0, { start: 3, end: 12 })).toMatchObject({
      exact: true,
      got: 'a **b** c',
    })
  })
  it('link label', () => {
    expect(sel('see [nhãn](http://x) now', 'nhãn')).toMatchObject({ exact: true, got: 'nhãn' })
  })
  it('link across text', () => {
    expect(sel('see [nhãn](http://x) now', 'see nhãn now')).toMatchObject({
      exact: true,
      got: 'see [nhãn](http://x) now',
    })
  })
  it('list item', () => {
    const src = '- one\n- two\n- three'
    expect(sel(src, 'two', 0, { start: 6, end: 11 })).toMatchObject({ exact: true, got: 'two' })
  })
  it('table cell', () => {
    const src = '| a | b |\n|---|---|\n| c | d |'
    expect(sel(src, 'd', 0, { start: 20, end: src.length })).toMatchObject({ exact: true, got: 'd' })
  })
  it('repeated text occurrence', () => {
    const r = sel('foo bar foo', 'foo', 1)
    expect(r.from).toBe(8)
    expect(r.got).toBe('foo')
  })
  it('occurrence beyond uses last', () => {
    const r = sel('foo bar foo', 'foo', 5)
    expect(r).toMatchObject({ from: 8, exact: true })
  })
  it('no match gives whole block', () => {
    expect(selectionToSourceRange('hello', { start: 0, end: 5 }, 'zzz', 0)).toEqual({
      from: 0,
      to: 5,
      exact: false,
    })
  })
  it('blank selection gives whole block and never throws', () => {
    expect(selectionToSourceRange('hello', { start: 0, end: 99 }, '  ', 0)).toEqual({
      from: 0,
      to: 5,
      exact: false,
    })
  })
})
