import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { computeTextChanges, applyTextChange, type TextChange } from './apply'

function prng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}
const ALPHA = ['a', 'b', '\n', 'ư', 'ệ', '📖', ' ']
function rstr(r: () => number, max: number) {
  const n = Math.floor(r() * max)
  let o = ''
  for (let i = 0; i < n; i++) o += ALPHA[Math.floor(r() * ALPHA.length)]
  return o
}
function applyPlain(prev: string, cs: TextChange[]) {
  let s = prev
  for (let i = cs.length - 1; i >= 0; i--) {
    const c = cs[i]!
    s = s.slice(0, c.index) + c.insert + s.slice(c.index + c.deleteCount)
  }
  return s
}
function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
}

describe('apply', () => {
  it('property: changes convert prev to next', () => {
    const r = prng(42)
    for (let i = 0; i < 200; i++) {
      const prev = rstr(r, 30)
      const next = r() < 0.5 ? rstr(r, 30) : prev.slice(0, 5) + rstr(r, 6) + prev.slice(8)
      const cs = computeTextChanges(prev, next)
      expect(applyPlain(prev, cs)).toBe(next)
      for (let j = 1; j < cs.length; j++) {
        expect(cs[j]!.index).toBeGreaterThanOrEqual(cs[j - 1]!.index + cs[j - 1]!.deleteCount)
      }
      const doc = new Y.Doc()
      const t = doc.getText('source')
      t.insert(0, prev)
      applyTextChange(t, next)
      expect(t.toString()).toBe(next)
    }
  })

  it('equal strings: false and no update', () => {
    const doc = new Y.Doc()
    const t = doc.getText('source')
    t.insert(0, 'abc')
    let n = 0
    doc.on('update', () => n++)
    expect(applyTextChange(t, 'abc')).toBe(false)
    expect(n).toBe(0)
    expect(computeTextChanges('x', 'x')).toEqual([])
  })

  it('attribution preserved', () => {
    const A = new Y.Doc()
    const B = new Y.Doc()
    A.getText('s').insert(0, 'hello world')
    sync(A, B)
    applyTextChange(B.getText('s'), 'hello there world')
    sync(A, B)
    const t: any = A.getText('s')
    const owners: Record<number, number> = {}
    for (let it = t._start; it; it = it.right) {
      if (!it.deleted) owners[it.id.client] = (owners[it.id.client] ?? 0) + it.length
    }
    expect(A.getText('s').toString()).toBe('hello there world')
    expect(owners[A.clientID]).toBe('hello world'.length)
  })

  it('convergence without duplication', () => {
    const A = new Y.Doc()
    const B = new Y.Doc()
    A.getText('s').insert(0, '* a\n* b\n')
    sync(A, B)
    applyTextChange(A.getText('s'), '- a\n- b\n')
    applyTextChange(B.getText('s'), '* a\n* b\n\nc')
    sync(A, B)
    expect(A.getText('s').toString()).toBe('- a\n- b\n\nc')
    expect(B.getText('s').toString()).toBe('- a\n- b\n\nc')
  })

  it('large middle: single change', () => {
    const r = prng(7)
    const mk = () => Array.from({ length: 50000 }, () => String.fromCharCode(33 + Math.floor(r() * 90))).join('')
    const prev = 'X' + mk() + 'Y'
    const next = 'X' + mk() + 'Y'
    const cs = computeTextChanges(prev, next)
    expect(cs.length).toBe(1)
    expect(applyPlain(prev, cs)).toBe(next)
  })
})
