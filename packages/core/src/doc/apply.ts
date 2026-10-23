import * as Y from 'yjs'

export interface TextChange {
  index: number
  deleteCount: number
  insert: string
}

export const ORIGIN_LOAD = 'md:load'
export const ORIGIN_FORMAT = 'md:format'
export const ORIGIN_REVERT = 'md:revert'

const MAX_D = 2000

type Op = { del: boolean; ai: number; ch: string }

/** Myers shortest edit script; returns null if D exceeds MAX_D. */
function myers(a: string, b: string): Op[] | null {
  const N = a.length
  const M = b.length
  const max = Math.min(MAX_D, N + M)
  const off = max + 1
  const V = new Int32Array(2 * max + 3)
  const trace: { lo: number; arr: Int32Array }[] = []
  let found = -1
  for (let d = 0; d <= max && found < 0; d++) {
    trace.push({ lo: off - d - 1, arr: V.slice(off - d - 1, off + d + 2) })
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && V[off + k - 1]! < V[off + k + 1]!)) x = V[off + k + 1]!
      else x = V[off + k - 1]! + 1
      let y = x - k
      while (x < N && y < M && a.charCodeAt(x) === b.charCodeAt(y)) {
        x++
        y++
      }
      V[off + k] = x
      if (x >= N && y >= M) {
        found = d
        break
      }
    }
  }
  if (found < 0) return null
  const ops: Op[] = []
  let x = N
  let y = M
  for (let d = found; d > 0; d--) {
    const t = trace[d]!
    const get = (k: number) => t.arr[off + k - t.lo]!
    const k = x - y
    const prevK = k === -d || (k !== d && get(k - 1) < get(k + 1)) ? k + 1 : k - 1
    const px = get(prevK)
    const py = px - prevK
    const sx = prevK === k + 1 ? px : px + 1
    while (x > sx) {
      x--
      y--
    }
    if (prevK === k + 1) ops.push({ del: false, ai: px, ch: b[py]! })
    else ops.push({ del: true, ai: px, ch: '' })
    x = px
    y = py
  }
  return ops.reverse()
}

export function computeTextChanges(prev: string, next: string): TextChange[] {
  if (prev === next) return []
  let p = 0
  const minLen = Math.min(prev.length, next.length)
  while (p < minLen && prev.charCodeAt(p) === next.charCodeAt(p)) p++
  let s = 0
  while (
    s < minLen - p &&
    prev.charCodeAt(prev.length - 1 - s) === next.charCodeAt(next.length - 1 - s)
  )
    s++
  // never split a surrogate pair at the prefix/suffix boundary
  const isHi = (c: number) => c >= 0xd800 && c <= 0xdbff
  const isLo = (c: number) => c >= 0xdc00 && c <= 0xdfff
  if (p > 0 && isHi(prev.charCodeAt(p - 1))) p--
  if (s > 0 && isLo(prev.charCodeAt(prev.length - s))) s--
  const a = prev.slice(p, prev.length - s)
  const b = next.slice(p, next.length - s)
  const whole: TextChange[] = [{ index: p, deleteCount: a.length, insert: b }]
  if (a.length === 0 || b.length === 0) return whole
  const ops = myers(a, b)
  if (!ops) return whole
  const out: TextChange[] = []
  let cur: TextChange | null = null
  for (const op of ops) {
    const pos = p + op.ai
    if (cur && pos === cur.index + cur.deleteCount) {
      if (op.del) cur.deleteCount++
      else cur.insert += op.ch
    } else {
      cur = { index: pos, deleteCount: op.del ? 1 : 0, insert: op.del ? '' : op.ch }
      out.push(cur)
    }
  }
  // a change that would split a surrogate pair is unsafe in Y.Text: replace whole middle
  const splits = (str: string, q: number) =>
    q > 0 && q < str.length && isHi(str.charCodeAt(q - 1)) && isLo(str.charCodeAt(q))
  for (const c of out) {
    if (
      splits(prev, c.index) ||
      splits(prev, c.index + c.deleteCount) ||
      (c.insert && (isLo(c.insert.charCodeAt(0)) || isHi(c.insert.charCodeAt(c.insert.length - 1))))
    )
      return whole
  }
  return out
}

export function applyTextChange(yText: Y.Text, next: string, origin?: unknown): boolean {
  const prev = yText.toString()
  if (prev === next) return false
  const changes = computeTextChanges(prev, next)
  const run = () => {
    for (let i = changes.length - 1; i >= 0; i--) {
      const c = changes[i]!
      if (c.deleteCount > 0) yText.delete(c.index, c.deleteCount)
      if (c.insert) yText.insert(c.index, c.insert)
    }
  }
  if (yText.doc) yText.doc.transact(run, origin)
  else run()
  return true
}
