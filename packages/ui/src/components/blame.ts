import type { Extension } from '@codemirror/state'
import { gutter, GutterMarker } from '@codemirror/view'
import type { BlameRange } from '@md-reader/core'
import { peerColor } from './PresenceBar'

export interface LineAuthor { clientId: number; actor: string | null }

/**
 * Majority author per line. Newline counts toward the line it ends.
 * Ties go to the earliest range. Empty text yields [null] (one empty line).
 */
export function lineAuthors(ranges: BlameRange[], text: string): Array<LineAuthor | null> {
  const out: Array<LineAuthor | null> = []
  const parts = text.split('\n')
  const byFrom = ranges.map((_, i) => i).sort((a, b) => ranges[a]!.from - ranges[b]!.from || a - b)
  let ptr = 0
  let active: number[] = []
  let start = 0
  for (let i = 0; i < parts.length; i++) {
    const end = start + parts[i]!.length + (i < parts.length - 1 ? 1 : 0)
    while (ptr < byFrom.length && ranges[byFrom[ptr]!]!.from <= (end === start ? start : end - 1)) active.push(byFrom[ptr++]!)
    active = active.filter((k) => ranges[k]!.to > start)
    // original input order keeps the first-seen tie-break
    const cand = active.slice().sort((a, b) => a - b)
    let best: BlameRange | null = null
    let bestOverlap = 0
    const totals = new Map<number, number>()
    const first = new Map<number, BlameRange>()
    const order: number[] = []
    for (const k of cand) {
      const r = ranges[k]!
      const o = Math.min(end, r.to) - Math.max(start, r.from)
      if (o <= 0) continue
      if (!totals.has(r.clientId)) {
        totals.set(r.clientId, 0)
        first.set(r.clientId, r)
        order.push(r.clientId)
      }
      totals.set(r.clientId, totals.get(r.clientId)! + o)
    }
    for (const id of order) {
      const o = totals.get(id)!
      if (o > bestOverlap) {
        bestOverlap = o
        best = first.get(id)!
      }
    }
    if (!best && end === start) {
      best = cand.map((k) => ranges[k]!).find((r) => r.from <= start && start < r.to) ?? null
    }
    out.push(best ? { clientId: best.clientId, actor: best.actor } : null)
    start = end
  }
  return out
}

class BlameMarker extends GutterMarker {
  constructor(readonly author: LineAuthor) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return (
      other instanceof BlameMarker &&
      other.author.clientId === this.author.clientId &&
      other.author.actor === this.author.actor
    )
  }
  toDOM(): Node {
    const el = document.createElement('span')
    el.className = 'cm-blame-mark'
    el.style.setProperty('--peer', peerColor(this.author.clientId))
    el.setAttribute('title', this.author.actor ?? 'Không rõ')
    return el
  }
}

export function blameGutter(lines: Array<LineAuthor | null>): Extension {
  return gutter({
    class: 'cm-blame-gutter',
    lineMarker(view, line) {
      const n = view.state.doc.lineAt(line.from).number
      const a = lines[n - 1]
      return a ? new BlameMarker(a) : null
    },
  })
}
