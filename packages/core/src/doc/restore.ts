import * as Y from 'yjs'
import type { HistoryEntry } from './schema.js'
import { getSource } from './doc.js'
import { applyTextChange, ORIGIN_REVERT } from './apply.js'
import { createCheckpointTracker } from './checkpoint.js'

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

export function restoreCheckpoint(doc: Y.Doc, entry: HistoryEntry, actor: string): boolean {
  const text = textAtCheckpoint(doc, entry)
  if (text === null) return false
  const src = getSource(doc)
  if (src.toString() === text) return true
  const tracker = createCheckpointTracker(doc, { quietMs: 1e9 })
  try {
    applyTextChange(src, text, ORIGIN_REVERT)
    tracker.flush(`Khôi phục: ${entry.label}` as 'save', actor, { force: true })
  } finally {
    tracker.dispose()
  }
  return true
}
