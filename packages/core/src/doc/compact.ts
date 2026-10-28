import * as Y from 'yjs'
import { getHistory, getMeta, getSource } from './doc.js'
import type { HistoryEntry } from './schema.js'

/** Meta keys tied to the room / collaboration; a compacted doc starts without them. */
export const COMPACT_DROPPED_META_KEYS = ['actors', 'remoteHash'] as const

/**
 * Builds a brand-new gc:false Y.Doc holding only the current state of `old`
 * (source text, primitive meta, one text-only checkpoint) and returns its update.
 */
export function compactDoc(old: Y.Doc): Uint8Array {
  const next = new Y.Doc({ gc: false })
  const dropped = new Set<string>(COMPACT_DROPPED_META_KEYS)
  next.transact(() => {
    const meta = getMeta(next)
    getMeta(old).forEach((v, k) => {
      if (dropped.has(k)) return
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) meta.set(k, v)
    })
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
  }, 'compact')
  const update = Y.encodeStateAsUpdate(next)
  next.destroy()
  return update
}
