import * as Y from 'yjs'

/** Reason a link-edit peer's transaction is not allowed, or null. Peers may only write `source` and their own `meta.actors` entry. */
export function peerTxViolation(tr: Y.Transaction, doc: Y.Doc): string | null {
  const source = doc.getText('source')
  const meta = doc.getMap('meta')
  const actorsRaw = meta.get('actors')
  const actors = actorsRaw instanceof Y.Map ? actorsRaw : null
  for (const [t, keys] of tr.changed) {
    const type = t as unknown
    if (type === source) continue
    if (actors && type === actors) {
      for (const k of keys) {
        if (k === null) return 'actors: unexpected change'
        const id = Number(k)
        const after = tr.afterState.get(id) ?? 0
        const before = tr.beforeState.get(id) ?? 0
        if (String(id) !== k || after <= before) return `actors: foreign key ${k}`
      }
      continue
    }
    if (type === meta) return 'meta: direct write'
    return 'forbidden type changed'
  }
  return null
}
