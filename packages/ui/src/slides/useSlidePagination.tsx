import React, { useEffect, useRef, useState } from 'react'
import { paginateBlocks, SMALL_ZOOM, type BlockBox, type Slide } from '@md-reader/core'
import { splitBlockElements, pristineBlocks, buildPagedSlides } from './slide-blocks'
import { SlideContent, SLIDE_W, SLIDE_H, slideCssVars, type PresentationSettings } from '../components/Deck'

export interface SlideFitWarning {
  slideId: string
  zoom: number
}
export interface SlidePagination {
  slides: Slide[]
  ready: boolean
  warnings: SlideFitWarning[]
}
export type BlockMeasure = (el: HTMLElement, next: HTMLElement | null) => BlockBox

const FALLBACK_W = 1120
const FALLBACK_H = 592
const SETTLE_MAX = 5000
const SETTLE_STABLE = 150

function resolveMeasured(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  const sib = el.nextElementSibling as HTMLElement | null
  if (el.style.display === 'none' && sib && sib.hasAttribute('data-deck-mermaid')) return sib
  return el
}

export function defaultBlockMeasure(el: HTMLElement, next: HTMLElement | null): BlockBox {
  const m = resolveMeasured(el) as HTMLElement
  const n = resolveMeasured(next)
  const rect = m.getBoundingClientRect()
  const height = n ? n.getBoundingClientRect().top - rect.top : rect.height
  return {
    height,
    width: Math.max(m.scrollWidth || 0, rect.width),
    keepWithNext: /^H[1-6]$/.test(el.tagName),
  }
}

export function mermaidSettled(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll('[data-deck-mermaid]')).every((el) => el.querySelector('svg, p'))
}

function contentHeight(root: HTMLElement): number {
  let total = 0
  root.querySelectorAll<HTMLElement>('.deck-slide-content').forEach((el) => {
    total += Math.max(el.scrollHeight || 0, el.getBoundingClientRect().height || 0)
  })
  return total
}

export async function defaultSettle(root: HTMLElement, timeoutMs: number = SETTLE_MAX): Promise<void> {
  let aborted = false
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const sleep = (ms: number) =>
    new Promise<void>((r) => {
      const t = setTimeout(() => {
        timers.delete(t)
        r()
      }, ms)
      timers.add(t)
    })
  const run = async () => {
    try {
      await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready
    } catch {
      /* ignore */
    }
    await Promise.all(
      Array.from(root.querySelectorAll('img')).map((img) =>
        typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()
      )
    )
    let last = contentHeight(root)
    let since = Date.now()
    while (!aborted) {
      await sleep(30)
      if (aborted) return
      const h = contentHeight(root)
      if (h !== last || !mermaidSettled(root)) {
        last = h
        since = Date.now()
      } else if (Date.now() - since >= SETTLE_STABLE) {
        return
      }
    }
  }
  try {
    await Promise.race([run(), sleep(timeoutMs)])
  } finally {
    aborted = true
    timers.forEach(clearTimeout)
    timers.clear()
  }
}

function contentArea(frame: HTMLElement): { w: number; h: number } {
  const cs = getComputedStyle(frame)
  const num = (v: string) => parseFloat(v) || 0
  const w = frame.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight)
  const h = frame.clientHeight - num(cs.paddingTop) - num(cs.paddingBottom)
  return { w: w > 0 ? w : FALLBACK_W, h: h > 0 ? h : FALLBACK_H }
}

interface Done {
  slides: Slide[]
  mermaid: boolean
  settings: PresentationSettings | undefined
  out: Slide[]
  warnings: SlideFitWarning[]
}

export function useSlidePagination(
  slides: Slide[],
  opts: {
    enabled: boolean
    mermaid: boolean
    presentationSettings?: PresentationSettings
    measure?: BlockMeasure
    settle?: (root: HTMLElement) => Promise<void>
  }
): SlidePagination & { stage: React.ReactNode } {
  const { enabled, mermaid, presentationSettings } = opts
  const stageRef = useRef<HTMLDivElement | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const [done, setDone] = useState<Done | null>(null)

  const fresh =
    done !== null && done.slides === slides && done.mermaid === mermaid && done.settings === presentationSettings

  useEffect(() => {
    if (!enabled || fresh) return
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const run = async () => {
      let root = stageRef.current
      const startedAt = Date.now()
      while (!root) {
        if (Date.now() - startedAt >= SETTLE_MAX) {
          console.warn('[slides] measuring stage never mounted; keeping slides as is')
          if (!cancelled) setDone({ slides, mermaid, settings: presentationSettings, out: slides, warnings: [] })
          return
        }
        await new Promise<void>((r) => {
          retryTimer = setTimeout(r, 50)
        })
        if (cancelled) return
        root = stageRef.current
      }
      await (optsRef.current.settle ?? defaultSettle)(root)
      if (cancelled) return
      const measure = optsRef.current.measure ?? defaultBlockMeasure
      const frames = Array.from(root.children) as HTMLElement[]
      const out: Slide[] = []
      const warnings: SlideFitWarning[] = []
      slides.forEach((source, i) => {
        let result: Slide[] = [source]
        try {
          const frame = frames[i]
          const content = frame?.querySelector('.deck-slide-content') as HTMLElement | null
          if (!frame || !content) throw new Error('missing frame')
          const visible = splitBlockElements(content)
          const pristine = pristineBlocks(source.html)
          if (visible.length !== pristine.length) {
            console.warn(`[slides] block count mismatch for ${source.id}; keeping slide as is`)
          } else {
            const boxes = visible.map((el, k) => measure(el, visible[k + 1] ?? null))
            const { w, h } = contentArea(frame)
            const pages = paginateBlocks(boxes, h, w)
            result = buildPagedSlides(source, pristine, pages)
          }
        } catch (err) {
          console.warn(`[slides] measure failed for ${source.id}`, err)
          result = [source]
        }
        for (const s of result) {
          if (typeof s.zoom === 'number' && s.zoom < SMALL_ZOOM) warnings.push({ slideId: s.id, zoom: s.zoom })
          out.push(s)
        }
      })
      setDone({
        slides,
        mermaid,
        settings: presentationSettings,
        out: out.map((s, index) => ({ ...s, index })),
        warnings,
      })
    }
    run().catch((err) => {
      if (!cancelled) console.warn('[slides] pagination failed', err)
    })
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [enabled, fresh, slides, mermaid, presentationSettings])

  if (!enabled) return { slides, ready: true, warnings: [], stage: null }
  if (fresh && done) return { slides: done.out, ready: true, warnings: done.warnings, stage: null }

  const stage = (
    <div
      ref={stageRef}
      aria-hidden="true"
      style={{ position: 'fixed', left: -99999, top: 0, visibility: 'hidden' }}
    >
      {slides.map((s) => (
        <div
          key={s.id}
          className="deck-slide deck-slide-frame deck-slide-container"
          style={{ width: SLIDE_W, height: SLIDE_H, ...slideCssVars(presentationSettings) }}
        >
          <SlideContent html={s.html} mermaid={mermaid} />
        </div>
      ))}
    </div>
  )
  return { slides, ready: false, warnings: [], stage }
}
