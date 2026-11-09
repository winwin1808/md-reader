import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import type { Slide } from '@md-reader/core'
import { useSlidePagination, type SlidePagination, defaultBlockMeasure, type BlockMeasure } from './useSlidePagination'

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
