import { useCallback, useEffect, useRef, useState } from 'react'
import type { TourStep } from '@md-reader/ui'

export const TOUR_DONE_KEY = 'mdr:tour-done'
export const TOUR_PARAM = 'tour'
export const TOUR_STEP_IDS = [
  'intro', 'view-mode', 'toc', 'search', 'present', 'mindmap', 'export', 'share', 'settings',
] as const

export function tourSteps(t: (key: string) => string): TourStep[] {
  return TOUR_STEP_IDS.map((id) => ({
    id,
    title: t(`ext.tour.${id}.title`),
    body: t(`ext.tour.${id}.body`),
    target:
      id === 'intro'
        ? null
        : id === 'view-mode' || id === 'toc'
          ? [`[data-tour="${id}"]`]
          : [`[data-tour="${id}"]`, '[data-tour="more"]'],
  }))
}

export function useGuidedTour(ready: boolean): {
  open: boolean
  start(): void
  onClose(result: 'done' | 'skipped'): void
} {
  const [open, setOpen] = useState(false)
  const attempted = useRef(false)

  useEffect(() => {
    if (!ready || attempted.current) return
    attempted.current = true
    if (new URLSearchParams(location.search).get(TOUR_PARAM) !== '1') return
    void (async () => {
      try {
        const got = await chrome?.storage?.local?.get(TOUR_DONE_KEY)
        if (got?.[TOUR_DONE_KEY] !== true) setOpen(true)
      } catch (e) {
        console.warn('tour: cannot read state', e)
      }
    })()
  }, [ready])

  const start = useCallback(() => setOpen(true), [])
  const onClose = useCallback((_result: 'done' | 'skipped') => {
    setOpen(false)
    try {
      void Promise.resolve(chrome?.storage?.local?.set({ [TOUR_DONE_KEY]: true })).catch((e) =>
        console.warn('tour: cannot save state', e),
      )
    } catch (e) {
      console.warn('tour: cannot save state', e)
    }
    const url = new URL(location.href)
    url.searchParams.delete(TOUR_PARAM)
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
  }, [])

  return { open, start, onClose }
}
