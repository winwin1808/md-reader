import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'

export interface TourStep {
  id: string
  target: string[] | null
  title: string
  body: string
}
export interface GuidedTourProps {
  steps: TourStep[]
  open: boolean
  onClose(result: 'done' | 'skipped'): void
}

interface Layout {
  spot: { top: number; left: number; width: number; height: number; centered: boolean }
  pop: { top: number; left: number; placement: 'below' | 'above' | 'center' }
}

function findTarget(target: string[] | null): HTMLElement | null {
  if (!target) return null
  for (const sel of target) {
    let el: HTMLElement | null = null
    try {
      el = document.querySelector<HTMLElement>(sel)
    } catch {
      el = null
    }
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

export function GuidedTour({ steps, open, onClose }: GuidedTourProps): React.JSX.Element | null {
  const t = useT()
  const [index, setIndex] = useState(0)
  const [layout, setLayout] = useState<Layout | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const prevFocus = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()
  const bodyId = useId()
  const active = open && steps.length > 0
  const total = steps.length
  const last = index >= total - 1

  // restart from step 0 and manage focus on open/close
  useLayoutEffect(() => {
    if (!active) return
    setIndex(0)
    prevFocus.current = document.activeElement
    return () => {
      const el = prevFocus.current as HTMLElement | null
      if (el && document.contains(el) && typeof el.focus === 'function') el.focus()
    }
  }, [active])

  const compute = useCallback(() => {
    const step = steps[index]
    if (!step) return
    const el = findTarget(step.target)
    const popEl = popRef.current
    const popW = popEl?.offsetWidth ?? 0
    const popH = popEl?.offsetHeight ?? 0
    const iw = window.innerWidth
    const ih = window.innerHeight
    if (!el) {
      setLayout({
        spot: { top: ih / 2, left: iw / 2, width: 0, height: 0, centered: true },
        pop: { top: Math.max(16, ih / 2 - popH / 2), left: Math.max(16, iw / 2 - popW / 2), placement: 'center' },
      })
      return
    }
    const r = el.getBoundingClientRect()
    const below = r.bottom + 12 + popH <= ih - 16
    const top = below ? r.bottom + 12 : Math.max(16, r.top - 12 - popH)
    const left = Math.max(16, Math.min(r.left + r.width / 2 - popW / 2, iw - 16 - popW))
    setLayout({
      spot: { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12, centered: false },
      pop: { top, left, placement: below ? 'below' : 'above' },
    })
  }, [steps, index])

  useLayoutEffect(() => {
    if (!active) {
      setLayout(null)
      return
    }
    const el = findTarget(steps[index]?.target ?? null)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.bottom < 0 || r.top > window.innerHeight) el.scrollIntoView?.({ block: 'center' })
    }
    compute()
  }, [active, index, steps, compute])

  useEffect(() => {
    if (!active) return
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [active, compute])

  const goNext = useCallback(() => {
    if (index >= total - 1) onCloseRef.current('done')
    else setIndex(index + 1)
  }, [index, total])
  const goPrev = useCallback(() => {
    if (index > 0) setIndex(index - 1)
  }, [index])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current('skipped')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Tab') {
        const pop = popRef.current
        if (!pop) return
        const items = Array.from(pop.querySelectorAll<HTMLElement>('button'))
        if (items.length === 0) return
        const first = items[0]!
        const lastEl = items[items.length - 1]!
        const cur = document.activeElement
        if (!pop.contains(cur)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && cur === first) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && cur === lastEl) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, goNext, goPrev])

  useEffect(() => {
    if (active) nextRef.current?.focus()
  }, [active, index])

  if (!active) return null
  const step = steps[Math.min(index, total - 1)]!
  const params = { current: index + 1, total }
  const spot = layout?.spot
  const pop = layout?.pop

  return createPortal(
    <>
      <div className="tour-layer" aria-hidden="true" />
      <div
        className="tour-spotlight"
        data-centered={spot ? String(spot.centered) : 'true'}
        aria-hidden="true"
        style={{
          top: spot?.top ?? window.innerHeight / 2,
          left: spot?.left ?? window.innerWidth / 2,
          width: spot?.width ?? 0,
          height: spot?.height ?? 0,
        }}
      />
      <div
        ref={popRef}
        className="tour-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-placement={pop?.placement ?? 'center'}
        style={{ top: pop?.top ?? 0, left: pop?.left ?? 0 }}
      >
        <p className="tour-progress" aria-label={t('tour.progressLabel', params)}>
          {t('tour.progress', params)}
        </p>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        <p id={bodyId} className="tour-body">
          {step.body}
        </p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={() => onClose('skipped')}>
            {t('tour.skip')}
          </button>
          {index > 0 && (
            <button type="button" className="tour-prev" onClick={goPrev}>
              {t('tour.prev')}
            </button>
          )}
          <button type="button" className="tour-next" ref={nextRef} onClick={goNext}>
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
