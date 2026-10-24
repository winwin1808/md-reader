// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { lineAuthors, blameGutter } from './blame'

const r = (from: number, to: number, clientId: number, actor: string | null = null) => ({ from, to, clientId, actor })

describe('lineAuthors', () => {
  it('3 lines each by one client', () => {
    const res = lineAuthors([r(0, 2, 1, 'A'), r(2, 4, 2), r(4, 6, 3)], 'a\nb\nc\n'.slice(0, 5) + 'x')
    expect(res.map((x) => x?.clientId)).toEqual([1, 2, 3])
    expect(res[0]!.actor).toBe('A')
  })
  it('majority wins', () => {
    const res = lineAuthors([r(0, 3, 1), r(3, 10, 2)], '0123456789')
    expect(res[0]!.clientId).toBe(2)
  })
  it('tie goes to earliest range', () => {
    const res = lineAuthors([r(0, 2, 1), r(2, 4, 2)], 'abcd')
    expect(res[0]!.clientId).toBe(1)
  })
  it('empty middle line', () => {
    const res = lineAuthors([r(0, 2, 1), r(2, 3, 2), r(3, 5, 3)], 'a\n\nb\n')
    expect(res.length).toBe(4)
    expect(res[1]!.clientId).toBe(2)
  })
  it('empty middle line without overlap -> range containing start, else null', () => {
    const res = lineAuthors([r(0, 2, 1)], 'a\n\n')
    expect(res[1]).toBeNull()
    expect(res.length).toBe(3)
  })
  it('trailing newline gives extra empty line', () => {
    const res = lineAuthors([r(0, 2, 1)], 'a\n')
    expect(res.length).toBe(2)
    expect(res[0]!.clientId).toBe(1)
    expect(res[1]).toBeNull()
  })
  it('empty text gives [null] (length 1)', () => {
    expect(lineAuthors([], '')).toEqual([null])
    expect(lineAuthors([r(0, 0, 1)], '')).toEqual([null])
  })
  it('no ranges -> all null', () => {
    expect(lineAuthors([], 'a\nb')).toEqual([null, null])
  })
})

describe('blameGutter', () => {
  it('renders mark with title and --peer', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({
      parent,
      state: EditorState.create({ doc: 'a\nb', extensions: [blameGutter([{ clientId: 1, actor: 'An' }, null])] }),
    })
    const marks = parent.querySelectorAll('.cm-blame-mark')
    expect(marks.length).toBe(1)
    expect(marks[0]!.getAttribute('title')).toBe('An')
    expect((marks[0] as HTMLElement).style.cssText).toMatch(/--peer:\s*var\(--peer-\d\)/)
    expect(parent.querySelector('.cm-blame-gutter')).not.toBeNull()
    view.destroy()
  })
})

describe('Editor blame prop', () => {
  it('adds and removes the gutter without rebuilding the view', async () => {
    const React = await import('react')
    const { render } = await import('@testing-library/react')
    const Y = await import('yjs')
    const { Editor } = await import('./Editor')
    if (!Range.prototype.getClientRects) {
      Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
      Range.prototype.getBoundingClientRect = () => new DOMRect()
    }
    const yText = new Y.Doc().getText('s')
    yText.insert(0, 'a\nb')
    let ready = 0
    const el = (blame: Parameters<typeof Editor>[0]['blame']) =>
      React.createElement(Editor, { yText, blame, onEditorReady: () => { ready++ } })
    const { container, rerender } = render(el(undefined))
    expect(container.querySelector('.cm-blame-mark')).toBeNull()
    rerender(el([{ clientId: 2, actor: 'Bo' }, null]))
    expect(container.querySelector('.cm-blame-mark')).not.toBeNull()
    rerender(el(null))
    expect(container.querySelector('.cm-blame-mark')).toBeNull()
    expect(ready).toBe(1)
  })
})

describe('lineAuthors sweep', () => {
  function reference(ranges: Array<{ from: number; to: number; clientId: number; actor: string | null }>, text: string) {
    const out: Array<{ clientId: number; actor: string | null } | null> = []
    const parts = text.split('\n')
    let start = 0
    for (let i = 0; i < parts.length; i++) {
      const end = start + parts[i]!.length + (i < parts.length - 1 ? 1 : 0)
      let best: (typeof ranges)[number] | null = null
      let bestOverlap = 0
      const totals = new Map<number, number>()
      const first = new Map<number, (typeof ranges)[number]>()
      const order: number[] = []
      for (const r of ranges) {
        const o = Math.min(end, r.to) - Math.max(start, r.from)
        if (o <= 0) continue
        if (!totals.has(r.clientId)) {
          totals.set(r.clientId, 0)
          first.set(r.clientId, r)
          order.push(r.clientId)
        }
        totals.set(r.clientId, totals.get(r.clientId)! + o)
      }
      for (const id of order) {
        const o = totals.get(id)!
        if (o > bestOverlap) {
          bestOverlap = o
          best = first.get(id)!
        }
      }
      if (!best && end === start) best = ranges.find((x) => x.from <= start && start < x.to) ?? null
      out.push(best ? { clientId: best.clientId, actor: best.actor } : null)
      start = end
    }
    return out
  }
  function rng(seed: number) {
    let s = seed
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  }
  it('matches reference on 200 random cases (overlaps included)', () => {
    const rand = rng(42)
    for (let c = 0; c < 200; c++) {
      const len = Math.floor(rand() * 80)
      let text = ''
      for (let i = 0; i < len; i++) text += rand() < 0.2 ? '\n' : 'x'
      const n = Math.floor(rand() * 12)
      const rs = []
      for (let i = 0; i < n; i++) {
        const from = Math.floor(rand() * (len + 3))
        const to = from + Math.floor(rand() * 30)
        rs.push(r(from, to, 1 + Math.floor(rand() * 4), rand() < 0.5 ? 'a' : null))
      }
      expect(lineAuthors(rs, text)).toEqual(reference(rs, text))
    }
  })
  it('5000 lines x 5000 ranges under 250ms', () => {
    const text = Array.from({ length: 5000 }, () => 'abcdefghi').join('\n')
    const rs = Array.from({ length: 5000 }, (_, i) => r(i * 10, i * 10 + 10, i % 7))
    const t0 = performance.now()
    lineAuthors(rs, text)
    expect(performance.now() - t0).toBeLessThan(250)
  })
})
