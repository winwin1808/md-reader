export interface SourceBlock {
  start: number
  end: number
}

export function parseSourcePos(attr: string | null): SourceBlock | null {
  if (!attr) return null
  const m = /^(\d+):(\d+)$/.exec(attr)
  if (!m) return null
  const start = Number(m[1])
  const end = Number(m[2])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) return null
  return { start, end }
}

function findAll(hay: string, needle: string): number[] {
  const out: number[] = []
  if (!needle) return out
  let i = hay.indexOf(needle)
  while (i !== -1) {
    out.push(i)
    i = hay.indexOf(needle, i + needle.length)
  }
  return out
}

function pick(hits: number[], occurrence: number): number | undefined {
  if (hits.length === 0) return undefined
  const k = Number.isFinite(occurrence) ? Math.max(0, Math.floor(occurrence)) : 0
  return hits[Math.min(k, hits.length - 1)]
}

function displayText(seg: string): { text: string; map: number[] } {
  let text = ''
  const map: number[] = []
  let i = 0
  while (i < seg.length) {
    const ch = seg[i] as string
    if (ch === '*' || ch === '_' || ch === '~' || ch === '`' || ch === '[') {
      i++
    } else if (ch === ']' && seg[i + 1] === '(') {
      const close = seg.indexOf(')', i + 2)
      i = close === -1 ? i + 1 : close + 1
    } else if (/\s/.test(ch)) {
      const at = i
      while (i < seg.length && /\s/.test(seg[i] as string)) i++
      text += ' '
      map.push(at)
    } else {
      text += ch
      map.push(i)
      i++
    }
  }
  return { text, map }
}

export function selectionToSourceRange(
  source: string,
  block: SourceBlock,
  selectedText: string,
  occurrence: number,
): { from: number; to: number; exact: boolean } {
  const start = Math.min(Math.max(0, Math.floor(block.start) || 0), source.length)
  const end = Math.min(Math.max(start, Math.floor(block.end) || 0), source.length)
  const whole = { from: start, to: end, exact: false }
  const seg = source.slice(start, end)
  if (!selectedText || !selectedText.trim() || seg.length === 0) return whole

  const i = pick(findAll(seg, selectedText), occurrence)
  if (i !== undefined) return { from: start + i, to: start + i + selectedText.length, exact: true }

  const norm = selectedText.replace(/\s+/g, ' ').trim()
  const { text, map } = displayText(seg)
  const j = pick(findAll(text, norm), occurrence)
  if (j !== undefined) {
    const a = map[j]
    const b = map[j + norm.length - 1]
    if (a !== undefined && b !== undefined) return { from: start + a, to: start + b + 1, exact: true }
  }
  return whole
}
