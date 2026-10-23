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
      { type: 'same', text: 'line 1', lineNumber: 1 },
      { type: 'same', text: 'line 2', lineNumber: 2 },
      { type: 'same', text: 'line 3', lineNumber: 3 },
    ])
  })

  it('handles added lines', () => {
    const orig = 'line 1\nline 3'
    const mod = 'line 1\nline 2\nline 3'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'same', text: 'line 1', lineNumber: 1 },
      { type: 'added', text: 'line 2', lineNumber: 2 },
      { type: 'same', text: 'line 3', lineNumber: 3 },
    ])
  })

  it('handles removed lines', () => {
    const orig = 'line 1\nline 2\nline 3'
    const mod = 'line 1\nline 3'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'same', text: 'line 1', lineNumber: 1 },
      { type: 'removed', text: 'line 2', lineNumber: 2 },
      { type: 'same', text: 'line 3', lineNumber: 2 },
    ])
  })

  it('handles modified lines (removed then added)', () => {
    const orig = 'line 1\nline 2\nline 3'
    const mod = 'line 1\nline 2 modified\nline 3'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'same', text: 'line 1', lineNumber: 1 },
      { type: 'removed', text: 'line 2', lineNumber: 2 },
      { type: 'added', text: 'line 2 modified', lineNumber: 2 },
      { type: 'same', text: 'line 3', lineNumber: 3 },
    ])
  })

  it('handles completely different contents', () => {
    const orig = 'alpha\nbeta'
    const mod = 'gamma\ndelta'
    const diff = computeLineDiff(orig, mod)
    expect(diff).toEqual([
      { type: 'removed', text: 'alpha', lineNumber: 1 },
      { type: 'removed', text: 'beta', lineNumber: 2 },
      { type: 'added', text: 'gamma', lineNumber: 1 },
      { type: 'added', text: 'delta', lineNumber: 2 },
    ])
  })

  it('handles empty inputs', () => {
    expect(computeLineDiff('', '')).toEqual([])
  })

  it('handles empty original with new modified lines', () => {
    expect(computeLineDiff('', 'line 1\nline 2')).toEqual([
      { type: 'added', text: 'line 1', lineNumber: 1 },
      { type: 'added', text: 'line 2', lineNumber: 2 },
    ])
  })

  it('handles original lines with empty modified', () => {
    expect(computeLineDiff('line 1\nline 2', '')).toEqual([
      { type: 'removed', text: 'line 1', lineNumber: 1 },
      { type: 'removed', text: 'line 2', lineNumber: 2 },
    ])
  })

  it('assigns line numbers on a mixed diff', () => {
    const diff = computeLineDiff('a\nb\nc\nd', 'a\nc\nx\nd\ne')
    expect(diff).toEqual([
      { type: 'same', text: 'a', lineNumber: 1 },
      { type: 'removed', text: 'b', lineNumber: 2 },
      { type: 'same', text: 'c', lineNumber: 2 },
      { type: 'added', text: 'x', lineNumber: 3 },
      { type: 'same', text: 'd', lineNumber: 4 },
      { type: 'added', text: 'e', lineNumber: 5 },
    ])
  })

  it('marks everything same for identical inputs', () => {
    const diff = computeLineDiff('x\ny', 'x\ny')
    expect(diff.every((l) => l.type === 'same')).toBe(true)
  })

  it('is fast on 20000 lines with 3 spread edits', () => {
    const lines = Array.from({ length: 20000 }, (_, i) => `line ${i}`)
    const mod = lines.slice()
    for (const i of [2000, 10000, 18000]) mod[i] = `changed ${i}`
    const t0 = performance.now()
    const diff = computeLineDiff(lines.join('\n'), mod.join('\n'))
    expect(performance.now() - t0).toBeLessThan(200)
    expect(diff.filter((l) => l.type === 'removed')).toHaveLength(3)
    expect(diff.filter((l) => l.type === 'added')).toHaveLength(3)
  })
})
