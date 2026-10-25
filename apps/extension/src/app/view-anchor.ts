import { parseMarkdown, extractToc, HEADING_ID_PREFIX } from '@md-reader/core'
import type { TocEntry } from '@md-reader/core'

/** id of the last heading whose top <= container top + 8px */
export function nearestHeadingAtTop(container: HTMLElement, topY?: number): string | null {
  const limit = (topY ?? container.getBoundingClientRect().top) + 8
  let found: string | null = null
  container.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').forEach((h) => {
    if (h.getBoundingClientRect().top <= limit) found = h.id
  })
  return found
}

function flatten(entries: TocEntry[], out: TocEntry[] = []): TocEntry[] {
  for (const e of entries) { out.push(e); flatten(e.children, out) }
  return out
}

function headingLines(node: any, out: number[] = []): number[] {
  if (node?.type === 'heading') out.push((node.position?.start?.line ?? 1) - 1)
  if (Array.isArray(node?.children)) for (const c of node.children) headingLines(c, out)
  return out
}

/** 0-based source line of the heading with this id (slug rule shared with the Toc) */
export function lineOfHeading(source: string, headingId: string): number | null {
  const id = headingId.startsWith(HEADING_ID_PREFIX) ? headingId : HEADING_ID_PREFIX + headingId
  const parsed = parseMarkdown(source)
  // Toc is nested; order of a depth-first walk equals document order of headings.
  const flat = flatten(extractToc(parsed.tree))
  const lines = headingLines(parsed.tree)
  const i = flat.findIndex((e) => e.id === id)
  if (i < 0) return null
  return lines[i] ?? null
}

/** id of the last heading at or above a 0-based source line */
export function headingIdAtLine(source: string, line: number): string | null {
  const parsed = parseMarkdown(source)
  const flat = flatten(extractToc(parsed.tree))
  const lines = headingLines(parsed.tree)
  let found: string | null = null
  for (let i = 0; i < flat.length; i++) if ((lines[i] ?? Infinity) <= line) found = flat[i]!.id
  return found
}
