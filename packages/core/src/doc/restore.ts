import * as Y from 'yjs'
import type { HistoryEntry } from './schema.js'
import { getSource } from './doc.js'
import { applyTextChange, ORIGIN_REVERT } from './apply.js'
import { createCheckpointTracker, type CheckpointTracker } from './checkpoint.js'

/** Nội dung Y.Text "source" tại thời điểm checkpoint; null nếu không có/không đọc được snapshot. */
export function textAtCheckpoint(doc: Y.Doc, entry: HistoryEntry): string | null {
  if (!entry.snapshot) return null
  let tmp: Y.Doc | null = null
  try {
    tmp = Y.createDocFromSnapshot(doc, Y.decodeSnapshot(entry.snapshot))
    return tmp.getText('source').toString()
  } catch {
    return null
  } finally {
    tmp?.destroy()
  }
}

/**
 * Callers with a live (long-lived) tracker MUST pass it: otherwise the app's
 * tracker sees the revert as a fresh edit and later writes a duplicate 'auto'
 * entry. Without a tracker a temporary one is used.
 */
export function restoreCheckpoint(
  doc: Y.Doc,
  entry: HistoryEntry,
  actor: string,
  tracker?: CheckpointTracker,
): boolean {
  const text = textAtCheckpoint(doc, entry)
  if (text === null) return false
  const src = getSource(doc)
  if (src.toString() === text) return true
  const label = `Khôi phục: ${entry.label}`
  if (tracker) {
    tracker.flush('auto', actor)
    applyTextChange(src, text, ORIGIN_REVERT)
    tracker.flush(label, actor, { force: true })
    return true
  }
  const tmp = createCheckpointTracker(doc, { quietMs: 1e9 })
  try {
    applyTextChange(src, text, ORIGIN_REVERT)
    tmp.flush(label, actor, { force: true })
  } finally {
    tmp.dispose()
  }
  return true
}
