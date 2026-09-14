import { describe, it, expect } from 'vitest'
import { computeLineDiff, detectConflict, type DiffLine } from '../index.js'
import { hashText } from '../doc/hash.js'

describe('detectConflict', () => {
  it('returns false when currentDiskContent matches baseHash', async () => {
    const content = 'Hello world\nThis is a doc'
    const hash = await hashText(content)
    expect(await detectConflict(hash, content)).toBe(false)
  })

  it('returns true when currentDiskContent does not match baseHash', async () => {
    const content = 'Hello world\nThis is a doc'
    const hash = await hashText(content)
    expect(await detectConflict(hash, 'Hello world\nDifferent content')).toBe(true)
  })
})

describe('computeLineDiff', () => {
  it('handles identical contents', () => {
    const text = 'line 1\nline 2\nline 3'
    const diff = computeLineDiff(text, text)
    expect(diff).toEqual([
      { type: 'same', text: 'line 1' },
      { type: 'same', text: 'line 2' },
      { type: 'same', text: 'line 3' },
    ])
  })

  it('handles added lines', () => {
    const orig = 'line 1\nline 3'
    const mod = 'line 1\nline 2\nline 3'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'same', text: 'line 1' },
      { type: 'added', text: 'line 2' },
      { type: 'same', text: 'line 3' },
    ])
  })

  it('handles removed lines', () => {
    const orig = 'line 1\nline 2\nline 3'
    const mod = 'line 1\nline 3'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'same', text: 'line 1' },
      { type: 'removed', text: 'line 2' },
      { type: 'same', text: 'line 3' },
    ])
  })

  it('handles modified lines (removed then added)', () => {
    const orig = 'line 1\nline 2\nline 3'
    const mod = 'line 1\nline 2 modified\nline 3'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'same', text: 'line 1' },
      { type: 'removed', text: 'line 2' },
      { type: 'added', text: 'line 2 modified' },
      { type: 'same', text: 'line 3' },
    ])
  })

  it('handles completely different contents', () => {
    const orig = 'alpha\nbeta'
    const mod = 'gamma\ndelta'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'removed', text: 'alpha' },
      { type: 'removed', text: 'beta' },
      { type: 'added', text: 'gamma' },
      { type: 'added', text: 'delta' },
    ])
  })

  it('handles empty inputs', () => {
    expect(computeLineDiff('', '')).toEqual([])
  })

  it('handles empty original with new modified lines', () => {
    expect(computeLineDiff('', 'line 1\nline 2')).toEqual([
      { type: 'added', text: 'line 1' },
      { type: 'added', text: 'line 2' },
    ])
  })

  it('handles original lines with empty modified', () => {
    expect(computeLineDiff('line 1\nline 2', '')).toEqual([
      { type: 'removed', text: 'line 1' },
      { type: 'removed', text: 'line 2' },
    ])
  })
})
