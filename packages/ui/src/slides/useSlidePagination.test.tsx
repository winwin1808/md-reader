import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import type { Slide } from '@md-reader/core'
import {
  useSlidePagination,
  type SlidePagination,
  defaultBlockMeasure,
  defaultSettle,
  mermaidSettled,
  type BlockMeasure,
  expandBoxes,
} from './useSlidePagination'

function mk(id: string, n: number): Slide {
  return {
    id,
    index: 0,
    title: id,
    html: Array.from({ length: n }, (_, i) => `<p>${id} block ${i}</p>`).join(''),
    notes: [],
    rawMarkdown: '',
  } as unknown as Slide
}

type Opts = Parameters<typeof useSlidePagination>[1]
type Out = SlidePagination & { stage: React.ReactNode }

// Mounts the stage like a real consumer so the hook can find it in the DOM.
function renderHook(fn: (p: { s: Slide[] }) => Out, { initialProps }: { initialProps: { s: Slide[] } }) {
  const result = { current: undefined as unknown as Out }
  function H({ s }: { s: Slide[] }) {
    result.current = fn({ s })
    return <div data-testid="host">{result.current.stage}</div>
  }
  const r = render(<H {...initialProps} />)
  return { result, rerender: (p: { s: Slide[] }) => r.rerender(<H {...p} />), container: r.container }
}
function hook(slides: Slide[], opts: Opts) {
  return renderHook(({ s }) => useSlidePagination(s, opts), { initialProps: { s: slides } })
}

const settle = async () => {}
// each block is 300 tall -> 592 content fits 1 block per page (2 blocks = 600 > 592)
const tall: BlockMeasure = () => ({ height: 300, width: 100, keepWithNext: false })

describe('useSlidePagination', () => {
  it('enabled:false returns input untouched', () => {
    const slides = [mk('a', 2)]
    const { result } = hook(slides, { enabled: false, mermaid: false })
    expect(result.current.slides).toBe(slides)
    expect(result.current.ready).toBe(true)
    expect(result.current.warnings).toEqual([])
    expect(result.current.stage).toBeNull()
  })

  it('shows hidden stage while measuring, then paginates with continuous index', async () => {
    const slides = [mk('a', 3), mk('b', 1)]
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { result, container } = renderHook(() =>
      useSlidePagination(slides, { enabled: true, mermaid: false, measure: tall, settle: () => gate })
    , { initialProps: { s: slides } })
    expect(result.current.ready).toBe(false)
    expect(result.current.slides).toBe(slides)
    const stage = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(stage.getAttribute('aria-hidden')).toBe('true')
    expect(stage.style.position).toBe('fixed')
    expect(container.querySelectorAll('.deck-slide-frame').length).toBe(2)
    await act(async () => {
      release()
      await gate
    })
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.slides.length).toBe(4)
    expect(result.current.slides.map((s) => s.index)).toEqual([0, 1, 2, 3])
    expect(result.current.stage).toBeNull()
  })

  it('keeps a slide whose measure throws, still splits others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const slides = [mk('a', 2), mk('b', 2)]
    const measure: BlockMeasure = (el) => {
      if (el.textContent?.startsWith('a')) throw new Error('boom')
      return { height: 300, width: 100, keepWithNext: false }
    }
    const { result } = renderHook(() =>
      useSlidePagination(slides, { enabled: true, mermaid: false, measure, settle })
    , { initialProps: { s: slides } })
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.slides.map((s) => s.id)).toEqual(['a', 'b-p0', 'b-p1'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not apply stale results when slides change mid-flight', async () => {
    const first = [mk('a', 3)]
    const second = [mk('z', 1)]
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    let calls = 0
    const st = () => (++calls === 1 ? gate : Promise.resolve())
    const { result, rerender } = renderHook(
      ({ s }) => useSlidePagination(s, { enabled: true, mermaid: false, measure: tall, settle: st }),
      { initialProps: { s: first } }
    )
    rerender({ s: second })
    await act(async () => {
      release()
      await gate
    })
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.slides.map((s) => s.id)).toEqual(['z'])
  })

  it('reports warnings for slides with zoom < 0.6', async () => {
    const slides = [mk('a', 1)]
    const measure: BlockMeasure = () => ({ height: 5000, width: 100, keepWithNext: false })
    const { result } = renderHook(() =>
      useSlidePagination(slides, { enabled: true, mermaid: false, measure, settle })
    , { initialProps: { s: slides } })
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.warnings.length).toBe(1)
    expect(result.current.warnings[0]!.slideId).toBe('a')
    expect(result.current.warnings[0]!.zoom).toBeLessThan(0.6)
  })
})

describe('defaultBlockMeasure', () => {
  const rect = (top: number, height: number, width = 100) =>
    ({ top, height, width, bottom: top + height, left: 0, right: width, x: 0, y: top }) as DOMRect

  it('measures the mermaid div in place of a hidden pre, and keeps headings with next', () => {
    const root = document.createElement('div')
    root.innerHTML = '<h2>T</h2><pre style="display: none"><code>x</code></pre><div data-deck-mermaid></div>'
    const [h, pre, mer] = Array.from(root.children) as [HTMLElement, HTMLElement, HTMLElement]
    h.getBoundingClientRect = () => rect(0, 40)
    pre.getBoundingClientRect = () => rect(0, 0, 0)
    mer.getBoundingClientRect = () => rect(50, 200, 400)
    const hBox = defaultBlockMeasure(h, pre)
    expect(hBox.keepWithNext).toBe(true)
    expect(hBox.height).toBe(50) // next resolved to mermaid: 50 - 0
    const pBox = defaultBlockMeasure(pre, null)
    expect(pBox.height).toBe(200)
    expect(pBox.width).toBeGreaterThanOrEqual(400)
    expect(pBox.keepWithNext).toBe(false)
  })
})

describe('defaultSettle', () => {
  function setup(html: string) {
    const root = document.createElement('div')
    root.innerHTML = html
    document.body.appendChild(root)
    return root
  }
  async function flag(p: Promise<void>) {
    const st = { done: false }
    void p.then(() => (st.done = true))
    return st
  }
  const adv = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

  it('mermaidSettled needs svg or p inside every mermaid div', () => {
    const root = setup('<div data-deck-mermaid><pre>x</pre></div>')
    expect(mermaidSettled(root)).toBe(false)
    root.querySelector('[data-deck-mermaid]')!.innerHTML = '<p>err</p>'
    expect(mermaidSettled(root)).toBe(true)
  })

  it('waits for mermaid svg, then 150ms stable, and leaves no timers', async () => {
    vi.useFakeTimers()
    try {
      const root = setup('<div class="deck-slide-content"><div data-deck-mermaid><pre>x</pre></div></div>')
      const st = await flag(defaultSettle(root))
      await adv(1000)
      expect(st.done).toBe(false)
      root.querySelector('[data-deck-mermaid]')!.innerHTML = '<svg></svg>'
      await adv(100)
      expect(st.done).toBe(false)
      await adv(200)
      expect(st.done).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats the error paragraph as settled', async () => {
    vi.useFakeTimers()
    try {
      const root = setup('<div class="deck-slide-content"><div data-deck-mermaid><p>err</p></div></div>')
      const st = await flag(defaultSettle(root))
      await adv(400)
      expect(st.done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('restarts the 150ms count when content height changes', async () => {
    vi.useFakeTimers()
    try {
      const root = setup('<div class="deck-slide-content"></div>')
      const c = root.querySelector('.deck-slide-content') as HTMLElement
      let h = 100
      Object.defineProperty(c, 'scrollHeight', { get: () => h })
      const st = await flag(defaultSettle(root))
      await adv(100)
      h = 200
      await adv(100)
      expect(st.done).toBe(false)
      await adv(200)
      expect(st.done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves at timeout when fonts.ready never settles, and img.decode rejecting is fine', async () => {
    vi.useFakeTimers()
    const orig = Object.getOwnPropertyDescriptor(document, 'fonts')
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise(() => {}) } })
    try {
      const root = setup('<div class="deck-slide-content"><img></div>')
      ;(root.querySelector('img') as HTMLImageElement).decode = () => Promise.reject(new Error('x'))
      const st = await flag(defaultSettle(root, 5000))
      await adv(4900)
      expect(st.done).toBe(false)
      await adv(200)
      expect(st.done).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      if (orig) Object.defineProperty(document, 'fonts', orig)
      else delete (document as unknown as Record<string, unknown>).fonts
      vi.useRealTimers()
    }
  })

  it('img.decode rejecting does not break settling', async () => {
    vi.useFakeTimers()
    try {
      const root = setup('<div class="deck-slide-content"><img></div>')
      ;(root.querySelector('img') as HTMLImageElement).decode = () => Promise.reject(new Error('x'))
      const st = await flag(defaultSettle(root))
      await adv(400)
      expect(st.done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useSlidePagination without stage', () => {
  it('falls back to input slides with ready:true after 5000ms', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const slides = [mk('a', 2)]
      const result = { current: undefined as unknown as Out }
      function H() {
        result.current = useSlidePagination(slides, { enabled: true, mermaid: false })
        return null
      }
      render(<H />)
      await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
      expect(result.current.ready).toBe(false)
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(result.current.ready).toBe(true)
      expect(result.current.slides).toBe(slides)
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
      vi.useRealTimers()
    }
  })
})

describe('splitting oversized lists and tables', () => {
  const html = (h: string): Slide => ({ id: 's', index: 0, title: 's', html: h, notes: [], rawMarkdown: '' }) as unknown as Slide
  const lis = (n: number) => Array.from({ length: n }, (_, i) => `<li>item ${i}</li>`).join('')
  const measure: BlockMeasure = (el) => ({
    height: el.tagName === 'UL' || el.tagName === 'OL' || el.tagName === 'TABLE' || el.tagName === 'PRE' ? 2000 : 100,
    width: 100,
    keepWithNext: false,
  })
  const measureChild = (c: HTMLElement) => (c.tagName === 'THEAD' ? 50 : 200)
  async function run(slide: Slide, m: BlockMeasure = measure) {
    const arr = [slide]
    const { result } = renderHook(
      () => useSlidePagination(arr, { enabled: true, mermaid: false, measure: m, measureChild, settle }),
      { initialProps: { s: arr } }
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    return result.current.slides
  }
  const count = (h: string, re: RegExp) => (h.match(re) ?? []).length

  it('splits a ul taller than maxH across slides keeping every item', async () => {
    const out = await run(html(`<ul>${lis(6)}</ul>`))
    expect(out.length).toBeGreaterThan(1)
    expect(out.reduce((n, s) => n + count(s.html, /<li>/g), 0)).toBe(6)
    for (let i = 0; i < 6; i++) expect(out.map((s) => s.html).join('')).toContain(`item ${i}<`)
  })

  it('repeats thead on every slide of a long table', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => `<tr><td>r${i}</td></tr>`).join('')
    const out = await run(html(`<table><thead><tr><th>H</th></tr></thead><tbody>${rows}</tbody></table>`))
    expect(out.length).toBeGreaterThan(1)
    for (const s of out) expect(s.html).toContain('<thead>')
    expect(out.reduce((n, s) => n + count(s.html, /<td>/g), 0)).toBe(6)
  })

  it('continues ol numbering with start', async () => {
    const out = await run(html(`<ol>${lis(6)}</ol>`))
    expect(out.length).toBeGreaterThan(1)
    expect(out[0]!.html).not.toContain('start=')
    expect(out[1]!.html).toContain('start="3"')
  })

  it('does not split a block that fits', async () => {
    const fit: BlockMeasure = () => ({ height: 100, width: 100, keepWithNext: false })
    const out = await run(html(`<ul>${lis(6)}</ul>`), fit)
    expect(out.length).toBe(1)
    expect(count(out[0]!.html, /<li>/g)).toBe(6)
  })

  it('keeps an unsplittable pre as one element', async () => {
    const out = await run(html('<pre><code>x</code></pre>'))
    expect(out.length).toBe(1)
    expect(count(out[0]!.html, /<pre>/g)).toBe(1)
  })

  describe('expandBoxes', () => {
    const mkEl = (h: string) => {
      const d = document.createElement('div')
      d.innerHTML = h
      return d.firstElementChild as HTMLElement
    }
    it('replaces only the oversized box and keeps other indexes', () => {
      const p = mkEl('<p>a</p>')
      const ul = mkEl(`<ul>${lis(4)}</ul>`)
      const q = mkEl('<p>b</p>')
      const live = [p, ul, q]
      const clean = [mkEl('<p>a</p>'), mkEl(`<ul>${lis(4)}</ul>`), mkEl('<p>b</p>')]
      const boxes = [
        { height: 10, width: 5, keepWithNext: false },
        { height: 800, width: 7, keepWithNext: true },
        { height: 10, width: 6, keepWithNext: false },
      ]
      const r = expandBoxes(live, clean, boxes, 500, measureChild)
      expect(r.boxes.length).toBe(r.elements.length)
      expect(r.boxes.length).toBe(4)
      expect(r.boxes[0]).toBe(boxes[0])
      expect(r.boxes[3]).toBe(boxes[2])
      expect(r.elements[0]).toBe(clean[0])
      expect(r.elements[3]).toBe(clean[2])
      expect(r.boxes[1]).toEqual({ height: 400, width: 7, keepWithNext: false })
      expect(r.elements[1]!.tagName).toBe('UL')
    })
  })
})
