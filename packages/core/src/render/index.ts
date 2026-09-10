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

import rehypeRaw from 'rehype-raw'
import { unified } from 'unified'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { ParseResult } from '../parse/index.js'
import { sanitizeSchema } from '../parse/index.js'

export function renderToHtml(parsed: ParseResult, options?: RenderOptions): RenderResult {
  const highlight = options?.highlight ?? true
  const allowRawHtml = options?.allowRawHtml ?? false

  const toc = extractToc(parsed.tree)

  const processor = unified()
  
  processor.use(remarkRehype, { allowDangerousHtml: allowRawHtml })
  processor.use(rehypeSlug)
  
  if (allowRawHtml) {
    processor.use(rehypeRaw)
  }

  if (highlight !== false) {
    processor.use(rehypeHighlight)
  }

  const codeAttributes = (sanitizeSchema.attributes?.code || []).filter(
    (attr: any) => !(Array.isArray(attr) && attr[0] === 'className')
  )
  const spanAttributes = (sanitizeSchema.attributes?.span || []).filter(
    (attr: any) => !(Array.isArray(attr) && attr[0] === 'className')
  )

  const baseSchema: typeof sanitizeSchema = {
    ...sanitizeSchema,
    attributes: {
      ...sanitizeSchema.attributes,
      code: [
        ...codeAttributes,
        ['className', 'hljs', /^hljs-/, /^language-/],
      ],
      span: [
        ...spanAttributes,
        ['className', 'hljs', /^hljs-/, /^language-/],
      ],
    },
  }

  const schema = allowRawHtml
    ? {
        ...baseSchema,
        attributes: {
          ...baseSchema.attributes,
          '*': [...((baseSchema.attributes as any)['*'] ?? []), 'style', 'className', 'data-info'],
        }
      }
    : baseSchema

  processor.use(rehypeSanitize, schema as any)
  processor.use(rehypeStringify, { allowDangerousHtml: allowRawHtml })

  try {
    const hast = processor.runSync(parsed.tree)
    const html = processor.stringify(hast)
    return { html: String(html), toc }
  } catch (error) {
    console.error('Render error:', error)
    return { html: '', toc }
  }
}
