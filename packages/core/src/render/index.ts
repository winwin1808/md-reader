import type { Root } from 'mdast'
import { Slugger } from './slug.js'

export interface TocEntry {
  /** id do rehype-slug sinh; khớp id trong html */
  id: string
  depth: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  children: TocEntry[]
}

export interface RenderOptions {
  /** Default: true. Content script có thể tắt để giữ ngân sách. */
  highlight?: boolean
  /** Default: false. Toggle "tin tài liệu này". */
  allowRawHtml?: boolean
}

export interface RenderResult {
  html: string
  toc: TocEntry[]
}

function getHeadingText(node: any): string {
  if (node.type === 'text' || node.type === 'inlineCode') {
    return node.value || ''
  }
  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as any[]).map(getHeadingText).join('')
  }
  return ''
}

export function extractToc(tree: Root): TocEntry[] {
  const slugger = new Slugger()
  const toc: TocEntry[] = []
  const stack: TocEntry[] = []

  const traverse = (node: any) => {
    if (node.type === 'heading') {
      const depth = node.depth as 1 | 2 | 3 | 4 | 5 | 6
      const text = getHeadingText(node)
      const id = slugger.slug(text)

      const entry: TocEntry = { id, depth, text, children: [] }

      while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
        stack.pop()
      }

      if (stack.length === 0) {
        toc.push(entry)
      } else {
        stack[stack.length - 1]!.children.push(entry)
      }

      stack.push(entry)
    } else if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children as any[]) {
        traverse(child)
      }
    }
  }

  traverse(tree)

  return toc
}
