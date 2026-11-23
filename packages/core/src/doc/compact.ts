import * as Y from 'yjs'
import { getHistory, getMeta, getSource } from './doc.js'
import type { HistoryEntry } from './schema.js'
import { getComments, listThreads, validateCommentValue } from '../comments/comments.js'
import type { CommentEntry, CommentAnchor } from '../comments/comments.js'

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

/** Meta keys tied to the room / collaboration; a compacted doc starts without them. */
export const COMPACT_DROPPED_META_KEYS = ['actors', 'remoteHash'] as const

/**
 * Builds a brand-new gc:false Y.Doc holding only the current state of `old`
 * (source text, primitive meta, one text-only checkpoint) and returns its update.
 */
export function compactDoc(old: Y.Doc): Uint8Array {
  const next = new Y.Doc({ gc: false })
  const ranges = new Map<string, { from: number; to: number } | null>()
  for (const t of listThreads(old)) ranges.set(t.id, t.range)
  const dropped = new Set<string>(COMPACT_DROPPED_META_KEYS)
  next.transact(() => {
    const meta = getMeta(next)
    getMeta(old).forEach((v, k) => {
      if (dropped.has(k)) return
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) meta.set(k, v)
    })
    // Server forbids edit links from creating `actors`; the owner seeds an empty map.
    meta.set('actors', new Y.Map())
    const text = getSource(old).toString()
    if (text) getSource(next).insert(0, text)
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      actor: 'local',
      ts: Date.now(),
      label: 'compact',
      clientIds: [],
    }
    getHistory(next).push([entry])
    const newSource = getSource(next)
    const target = getComments(next)
    for (const [key, val] of getComments(old).entries()) {
      if (validateCommentValue(key, val) !== null) continue
      if (key.startsWith('c:')) {
        const e = val as CommentEntry
        const copy: CommentEntry = {
          v: 1,
          thread: e.thread,
          author: e.author,
          clientId: e.clientId,
          ts: e.ts,
          body: e.body,
        }
        if (e.thread === null && e.anchor) {
          const range = ranges.get(key) ?? null
          const anchor: CommentAnchor = range
            ? {
                start: toB64(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(newSource, range.from, 0))),
                end: toB64(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(newSource, range.to, -1))),
                quote: e.anchor.quote,
              }
            : { start: e.anchor.start, end: e.anchor.end, quote: e.anchor.quote }
          copy.anchor = anchor
        }
        target.set(key, copy)
      } else {
        const st = val as { resolved: boolean; by: string; clientId: number; ts: number }
        target.set(key, { resolved: st.resolved, by: st.by, clientId: st.clientId, ts: st.ts })
      }
    }
  }, 'compact')
  const update = Y.encodeStateAsUpdate(next)
  next.destroy()
  return update
}
