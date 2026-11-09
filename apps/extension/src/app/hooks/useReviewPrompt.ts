import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LIFECYCLE_KEY, parseLifecycleState, shouldAskReview, bumpDocOpens, setReview,
} from '../../worker/lifecycle'
import type { LifecycleState } from '../../worker/lifecycle'

export const REVIEW_URL = 'https://chromewebstore.google.com/detail/eolclccibhickmpbpbdodbhopnddcdog/reviews'

export const REVIEW_DECISION_KEY = 'mdr:review-decision'

type Decision = 'accepted' | 'dismissed' | null

function parseDecision(v: unknown): Decision {
  return v === 'accepted' || v === 'dismissed' ? v : null
}

async function readAll(): Promise<{ state: LifecycleState; decision: Decision }> {
  const r = (await chrome.storage?.local?.get([LIFECYCLE_KEY, REVIEW_DECISION_KEY])) as Record<string, unknown> | undefined
  return { state: parseLifecycleState(r?.[LIFECYCLE_KEY]), decision: parseDecision(r?.[REVIEW_DECISION_KEY]) }
}

async function writeDecision(d: 'accepted' | 'dismissed'): Promise<void> {
  try { await chrome.storage?.local?.set({ [REVIEW_DECISION_KEY]: d }) } catch (e) { console.warn('review decision write failed', e) }
}

async function updateLifecycle(fn: (s: LifecycleState) => LifecycleState): Promise<void> {
  const { state } = await readAll()
  await chrome.storage?.local?.set({ [LIFECYCLE_KEY]: fn(state) })
}

export function useReviewPrompt(docId: string | null): { show: boolean; onRate(): void; onDismiss(): void } {
  const [state, setState] = useState<LifecycleState | null>(null)
  const [decision, setDecision] = useState<Decision>(null)
  const [hidden, setHidden] = useState(false)
  const lastDoc = useRef<string | null>(null)
  const gen = useRef(0)

  useEffect(() => {
    let alive = true
    const mountGen = gen.current
    readAll().then(
      (r) => { if (alive && gen.current === mountGen) { setState(r.state); setDecision(r.decision) } },
      (e) => { console.warn('review prompt read failed', e) },
    )
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local') return
      if (!changes[LIFECYCLE_KEY] && !changes[REVIEW_DECISION_KEY]) return
      gen.current++
      if (changes[LIFECYCLE_KEY]) setState(parseLifecycleState(changes[LIFECYCLE_KEY].newValue))
      if (changes[REVIEW_DECISION_KEY]) setDecision(parseDecision(changes[REVIEW_DECISION_KEY].newValue))
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
    const startGen = gen.current
    ;(async () => {
      const { state: cur, decision: d } = await readAll()
      const next = bumpDocOpens(cur)
      await chrome.storage?.local?.set({ [LIFECYCLE_KEY]: next })
      if (gen.current === startGen) { setState(next); setDecision(d) }
    })().catch((e) => { console.warn('review prompt bump failed', e) })
  }, [docId])

  const onRate = useCallback(() => {
    setHidden(true)
    try { chrome.tabs?.create?.({ url: REVIEW_URL }) } catch (e) { console.warn('review tab failed', e) }
    void writeDecision('accepted')
      .then(() => updateLifecycle((s) => setReview(s, 'accepted')))
      .catch((e) => console.warn('review write failed', e))
  }, [])

  const onDismiss = useCallback(() => {
    setHidden(true)
    void writeDecision('dismissed')
      .then(() => updateLifecycle((s) => setReview(s, 'dismissed')))
      .catch((e) => console.warn('review write failed', e))
  }, [])

  const isFirefox = /Firefox\//.test(navigator.userAgent)
  const show = !hidden && !isFirefox && !decision && state !== null && shouldAskReview(state, Date.now())
  return { show, onRate, onDismiss }
}
