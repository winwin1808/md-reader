import type * as Y from 'yjs'
import { getMeta, getSource } from './doc.js'

export interface BlameRange {
  from: number
  to: number
  clientId: number
  actor: string | null
}

interface ItemLike {
  id: { client: number }
  length: number
  deleted: boolean
  countable: boolean
  right: ItemLike | null
}

/** The only private-API use: walk Y.Text's internal item list (`_start` -> `right`). */
function liveRuns(text: Y.Text): Array<{ client: number; length: number }> {
  const runs: Array<{ client: number; length: number }> = []
  let item = (text as unknown as { _start: ItemLike | null })._start
  while (item) {
    if (!item.deleted && item.countable) runs.push({ client: item.id.client, length: item.length })
    item = item.right
  }
  return runs
}

export function computeBlame(doc: Y.Doc): BlameRange[] {
  const actors = getMeta(doc).get('actors') as Y.Map<string> | undefined
  const out: BlameRange[] = []
  let pos = 0
  for (const run of liveRuns(getSource(doc))) {
    const last = out[out.length - 1]
    if (last && last.clientId === run.client) last.to += run.length
    else {
      out.push({
        from: pos,
        to: pos + run.length,
        clientId: run.client,
        actor: actors?.get?.(String(run.client)) ?? null,
      })
    }
    pos += run.length
  }
  return out
}
