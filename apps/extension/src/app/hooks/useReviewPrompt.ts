import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LIFECYCLE_KEY, parseLifecycleState, shouldAskReview, bumpDocOpens, setReview,
} from '../../worker/lifecycle'
import type { LifecycleState } from '../../worker/lifecycle'

export const REVIEW_URL = 'https://chromewebstore.google.com/detail/eolclccibhickmpbpbdodbhopnddcdog/reviews'

async function readState(): Promise<LifecycleState> {
  const r = (await chrome.storage?.local?.get(LIFECYCLE_KEY)) as Record<string, unknown> | undefined
  return parseLifecycleState(r?.[LIFECYCLE_KEY])
}

async function update(fn: (s: LifecycleState) => LifecycleState): Promise<LifecycleState> {
  const next = fn(await readState())
  await chrome.storage?.local?.set({ [LIFECYCLE_KEY]: next })
  return next
}

export function useReviewPrompt(docId: string | null): { show: boolean; onRate(): void; onDismiss(): void } {
  const [state, setState] = useState<LifecycleState | null>(null)
  const [hidden, setHidden] = useState(false)
  const lastDoc = useRef<string | null>(null)

  useEffect(() => {
    let alive = true
    readState().then(
      (s) => { if (alive) setState(s) },
      (e) => { console.warn('review prompt read failed', e) },
    )
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !changes[LIFECYCLE_KEY]) return
      setState(parseLifecycleState(changes[LIFECYCLE_KEY].newValue))
    }
    chrome.storage?.onChanged?.addListener(onChanged)
    return () => {
      alive = false
      chrome.storage?.onChanged?.removeListener(onChanged)
    }
  }, [])

  useEffect(() => {
    if (docId === null || docId === lastDoc.current) return
    lastDoc.current = docId
    update(bumpDocOpens).then(
      (s) => { setState(s) },
      (e) => { console.warn('review prompt bump failed', e) },
    )
  }, [docId])

  const onRate = useCallback(() => {
    setHidden(true)
    try { chrome.tabs?.create?.({ url: REVIEW_URL }) } catch (e) { console.warn('review tab failed', e) }
    update((s) => setReview(s, 'accepted')).catch((e) => console.warn('review write failed', e))
  }, [])

  const onDismiss = useCallback(() => {
    setHidden(true)
    update((s) => setReview(s, 'dismissed')).catch((e) => console.warn('review write failed', e))
  }, [])

  const isFirefox = /Firefox\//.test(navigator.userAgent)
  const show = !hidden && !isFirefox && state !== null && shouldAskReview(state, Date.now())
  return { show, onRate, onDismiss }
}
