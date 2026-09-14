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

export function computeLineDiff(original: string, modified: string): DiffLine[] {
  if (original === modified) {
    if (original.length === 0) return []
    return original.split('\n').map((text) => ({ type: 'same', text }))
  }

  const a = original.length === 0 ? [] : original.split('\n')
  const b = modified.length === 0 ? [] : modified.split('\n')
  const n = a.length
  const m = b.length

  if (n === 0) {
    return b.map((text) => ({ type: 'added', text }))
  }
  if (m === 0) {
    return a.map((text) => ({ type: 'removed', text }))
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const diff: DiffLine[] = []
  let i = n
  let j = m

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      diff.push({ type: 'same', text: a[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.push({ type: 'added', text: b[j - 1] })
      j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      diff.push({ type: 'removed', text: a[i - 1] })
      i--
    }
  }

  return diff.reverse()
}
