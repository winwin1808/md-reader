import { hashText } from '../doc/hash.js'

export interface DiffLine {
  type: 'same' | 'added' | 'removed'
  text: string
  lineNumber?: number
}

export async function detectConflict(baseHash: string, currentDiskContent: string): Promise<boolean> {
  const currentHash = await hashText(currentDiskContent)
  return currentHash !== baseHash
}

type Edit = { type: 'same' | 'added' | 'removed'; ai: number; bi: number }

/** Myers greedy diff; returns edits in document order (indices into a / b). */
function myers(a: string[], b: string[]): Edit[] {
  const n = a.length
  const m = b.length
  const max = n + m
  const off = max + 1
  const v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  let found = -1
  for (let d = 0; d <= max && found < 0; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[off + k - 1]! < v[off + k + 1]!)) x = v[off + k + 1]!
      else x = v[off + k - 1]! + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[off + k] = x
      if (x >= n && y >= m) {
        found = d
        break
      }
    }
    trace.push(v.slice(off - d, off + d + 1))
  }
  const edits: Edit[] = []
  let x = n
  let y = m
  for (let d = found; d > 0; d--) {
    const pv = trace[d - 1]!
    const at = (k: number) => pv[k + d - 1]!
    const k = x - y
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1
    const prevX = at(prevK)
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      x--
      y--
      edits.push({ type: 'same', ai: x, bi: y })
    }
    if (x === prevX) {
      y--
      edits.push({ type: 'added', ai: x, bi: y })
    } else {
      x--
      edits.push({ type: 'removed', ai: x, bi: y })
    }
  }
  while (x > 0 && y > 0) {
    x--
    y--
    edits.push({ type: 'same', ai: x, bi: y })
  }
  return edits.reverse()
}

export function computeLineDiff(original: string, modified: string): DiffLine[] {
  const a = original.length === 0 ? [] : original.split('\n')
  const b = modified.length === 0 ? [] : modified.split('\n')

  let pre = 0
  const minLen = Math.min(a.length, b.length)
  while (pre < minLen && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < minLen - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++

  const out: DiffLine[] = []
  for (let i = 0; i < pre; i++) out.push({ type: 'same', text: a[i]!, lineNumber: i + 1 })

  const midA = a.slice(pre, a.length - suf)
  const midB = b.slice(pre, b.length - suf)
  const edits = myers(midA, midB)
  // Within a changed block, emit removed lines before added lines.
  let removed: DiffLine[] = []
  let added: DiffLine[] = []
  const flush = () => {
    out.push(...removed, ...added)
    removed = []
    added = []
  }
  for (const e of edits) {
    if (e.type === 'same') {
      flush()
      out.push({ type: 'same', text: midB[e.bi]!, lineNumber: pre + e.bi + 1 })
    } else if (e.type === 'removed') {
      removed.push({ type: 'removed', text: midA[e.ai]!, lineNumber: pre + e.ai + 1 })
    } else {
      added.push({ type: 'added', text: midB[e.bi]!, lineNumber: pre + e.bi + 1 })
    }
  }
  flush()

  for (let i = 0; i < suf; i++) {
    const bi = b.length - suf + i
    out.push({ type: 'same', text: b[bi]!, lineNumber: bi + 1 })
  }
  return out
}
