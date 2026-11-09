export interface BlockBox {
  /** Includes the gap to the following block. */
  height: number
  width: number
  keepWithNext: boolean
}

export interface SlidePage {
  /** Inclusive block index. */
  start: number
  /** Exclusive block index. */
  end: number
  zoom: number
}

export const SMALL_ZOOM = 0.6

/**
 * Split measured blocks into pages. Pure: measurements come from the caller.
 * Oversize blocks get their own page, scaled down to fit (no zoom floor).
 */
export function paginateBlocks(blocks: BlockBox[], maxH: number, maxW: number): SlidePage[] {
  if (blocks.length === 0) return []
  if (maxH <= 0 || maxW <= 0) return [{ start: 0, end: blocks.length, zoom: 1 }]

  const pages: SlidePage[] = []
  let start = 0
  let used = 0
  const isOver = (x: BlockBox) => x.height > maxH || x.width > maxW
  const close = (end: number) => {
    if (end > start) pages.push({ start, end, zoom: 1 })
    start = end
    used = 0
  }

  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i]!
    if (isOver(cur)) {
      close(i)
      pages.push({ start: i, end: i + 1, zoom: Math.min(maxH / cur.height, maxW / cur.width, 1) })
      start = i + 1
      used = 0
      continue
    }
    const next = cur.keepWithNext ? blocks[i + 1] : undefined
    if (next) {
      if (isOver(next)) {
        // heading alone on its own page right before the oversize block
        close(i)
        pages.push({ start: i, end: i + 1, zoom: 1 })
        start = i + 1
        used = 0
        continue
      }
      if (used + cur.height + next.height > maxH) close(i)
    } else if (used + cur.height > maxH) {
      close(i)
    }
    used += cur.height
  }
  close(blocks.length)
  return pages
}
