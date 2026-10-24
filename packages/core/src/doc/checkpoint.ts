import * as Y from 'yjs'
import type { HistoryEntry } from './schema.js'
import { getHistory, getMeta, getSource } from './doc.js'

export const ORIGIN_CHECKPOINT = 'md:checkpoint'

export interface CheckpointTracker {
  flush(label: 'save' | 'auto' | 'import', actor: string, opts?: { force?: boolean }): HistoryEntry | null
  dispose(): void
}

/**
 * Tracks which clients touched the source text and records history checkpoints
 * with snapshots. Expects a gc:false doc (createDoc gives one); snapshots of a
 * gc:true doc cannot be restored faithfully, but nothing throws here.
 */
export function createCheckpointTracker(
  doc: Y.Doc,
  opts?: { quietMs?: number; onAuto?: (e: HistoryEntry) => void; actor?: string },
): CheckpointTracker {
  const quietMs = opts?.quietMs ?? 30000
  const clients = new Set<number>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const flush: CheckpointTracker['flush'] = (label, actor, fopts) => {
    if (clients.size === 0 && !fopts?.force) return null
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      actor,
      ts: Date.now(),
      label,
      clientIds: [...clients].sort((a, b) => a - b),
      snapshot: Y.encodeSnapshot(Y.snapshot(doc)),
    }
    clients.clear()
    clearTimer()
    doc.transact(() => {
      getHistory(doc).push([entry])
    }, ORIGIN_CHECKPOINT)
    return entry
  }

  const onAfter = (tr: Y.Transaction) => {
    if (!tr.changed.has(getSource(doc) as unknown as Y.AbstractType<any>)) return
    if (tr.origin === ORIGIN_CHECKPOINT) return
    tr.afterState.forEach((clock, client) => {
      if (clock > (tr.beforeState.get(client) ?? 0)) clients.add(client)
    })
    // deleteSet.clients are the deleted items' authors, not the deleters, so unused.
    // Local delete-only edits are covered by doc.clientID; remote delete-only edits
    // are not attributed yet — phase 8: provider supplies the sender.
    if (tr.local) clients.add(doc.clientID)
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      const e = flush('auto', opts?.actor ?? 'local')
      if (e) opts?.onAuto?.(e)
    }, quietMs)
  }

  doc.on('afterTransaction', onAfter)

  return {
    flush,
    dispose() {
      doc.off('afterTransaction', onAfter)
      clearTimer()
    },
  }
}

export function registerActor(doc: Y.Doc, name: string): void {
  const meta = getMeta(doc)
  doc.transact(() => {
    const raw = meta.get('actors')
    if (raw instanceof Y.Map) {
      raw.set(String(doc.clientID), name)
      return
    }
    const map = new Y.Map<string>()
    meta.set('actors', map)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, string>)) map.set(k, v)
    }
    map.set(String(doc.clientID), name)
  })
}
