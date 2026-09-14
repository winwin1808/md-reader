import * as Y from 'yjs'
import { DOC_KEYS, type HistoryEntry } from './schema.js'
import { getHistory, getSource } from './doc.js'

export function appendHistory(
  doc: Y.Doc,
  entry: Omit<HistoryEntry, 'id' | 'ts'> & { ts?: number },
): HistoryEntry {
  if (!entry.actor || entry.actor.trim() === '') {
    throw new TypeError('history entry requires an actor')
  }

  const newEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    actor: entry.actor,
    ts: entry.ts ?? Date.now(),
    label: entry.label,
    clientIds: [...entry.clientIds],
  }

  getHistory(doc).push([newEntry])
  return newEntry
}

export function listHistory(doc: Y.Doc): HistoryEntry[] {
  return getHistory(doc).toArray()
}

/** clientID của mọi struct đang sống trong Y.Text "source". Nền cho blame phase 6. */
export function sourceClientIds(doc: Y.Doc): number[] {
  const ids = new Set<number>()
  let item = (getSource(doc) as any)._start
  while (item !== null) {
    if (!item.deleted) {
      ids.add(item.id.client)
    }
    item = item.right
  }
  return Array.from(ids).sort((a, b) => a - b)
}
