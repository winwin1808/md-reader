import { useCallback, useEffect, useMemo, useState } from 'react'
import type * as Y from 'yjs'
import {
  addComment,
  deleteComment,
  getComments,
  listThreads,
  replyComment,
  setResolved,
  type CommentThread,
} from '@md-reader/core'
import type { CommentsPanelProps } from '@md-reader/ui'

const DEBOUNCE_MS = 120
const EMPTY: CommentThread[] = []

function sameThreads(a: CommentThread[], b: CommentThread[]): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

interface State {
  doc: Y.Doc | null
  threads: CommentThread[]
  activeId: string | null
}

export function useComments(
  doc: Y.Doc | null,
  actor: string,
): {
  threads: CommentThread[]
  openCount: number
  activeId: string | null
  setActive(id: string | null): void
  create(range: { from: number; to: number }, body: string): string | null
  reply(threadId: string, body: string): void
  resolve(threadId: string, resolved: boolean): void
  remove(id: string): void
  me: CommentsPanelProps['me']
} {
  const [state, setState] = useState<State>(() => ({
    doc,
    threads: doc ? listThreads(doc) : EMPTY,
    activeId: null,
  }))

  // Doc changed: recompute immediately and reset the active thread.
  const current: State =
    state.doc === doc ? state : { doc, threads: doc ? listThreads(doc) : EMPTY, activeId: null }
  if (current !== state) setState(current)

  const refresh = useCallback(() => {
    setState((s) => {
      if (s.doc !== doc) return s
      const next = doc ? listThreads(doc) : EMPTY
      return sameThreads(s.threads, next) ? s : { ...s, threads: next }
    })
  }, [doc])

  useEffect(() => {
    if (!doc) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        refresh()
      }, DEBOUNCE_MS)
    }
    const comments = getComments(doc)
    const text = doc.getText('source')
    comments.observeDeep(schedule)
    text.observe(schedule)
    const meta = doc.getMap('meta')
    meta.observeDeep(schedule)
    return () => {
      if (timer) clearTimeout(timer)
      comments.unobserveDeep(schedule)
      text.unobserve(schedule)
      meta.unobserveDeep(schedule)
    }
  }, [doc, refresh])

  const setActive = useCallback(
    (id: string | null) => setState((s) => (s.doc === doc ? { ...s, activeId: id } : s)),
    [doc],
  )

  const create = useCallback(
    (range: { from: number; to: number }, body: string): string | null => {
      if (!doc) return null
      try {
        const id = addComment(doc, { author: actor, body, from: range.from, to: range.to })
        setState({ doc, threads: listThreads(doc), activeId: id })
        return id
      } catch (e) {
        if (e instanceof RangeError) return null
        throw e
      }
    },
    [doc, actor],
  )

  const guarded = useCallback(
    (fn: () => void) => {
      if (!doc) return
      try {
        fn()
      } catch (e) {
        if (!(e instanceof RangeError)) throw e
      }
      refresh()
    },
    [doc, refresh],
  )

  const reply = useCallback(
    (threadId: string, body: string) =>
      guarded(() => void replyComment(doc!, threadId, { author: actor, body })),
    [guarded, doc, actor],
  )
  const resolve = useCallback(
    (threadId: string, resolved: boolean) =>
      guarded(() => setResolved(doc!, threadId, resolved, actor)),
    [guarded, doc, actor],
  )
  const remove = useCallback(
    (id: string) => guarded(() => deleteComment(doc!, id)),
    [guarded, doc],
  )

  const threads = current.threads
  const openCount = useMemo(
    () => threads.filter((t) => !t.deleted && !t.resolved).length,
    [threads],
  )

  const [, bumpMeta] = useState(0)
  useEffect(() => {
    if (!doc) return
    const meta = doc.getMap('meta')
    const bump = () => bumpMeta((n) => n + 1)
    meta.observeDeep(bump)
    return () => meta.unobserveDeep(bump)
  }, [doc])

  const actorsKey = (() => {
    if (!doc) return ''
    const actors = doc.getMap('meta').get('actors') as Y.Map<string> | undefined
    if (!actors || typeof actors.forEach !== 'function') return ''
    const ids: string[] = []
    actors.forEach((name, k) => {
      if (name === actor) ids.push(k)
    })
    return ids.join(',')
  })()

  const me = useMemo<CommentsPanelProps['me']>(() => {
    const ids = new Set<number>()
    if (doc) ids.add(doc.clientID)
    for (const k of actorsKey.split(',')) {
      const n = Number(k)
      if (k !== '' && Number.isFinite(n)) ids.add(n)
    }
    return { clientIds: [...ids], canModerate: true, canResolveAll: true }
  }, [doc, actorsKey])

  return { threads, openCount, activeId: current.activeId, setActive, create, reply, resolve, remove, me }
}
