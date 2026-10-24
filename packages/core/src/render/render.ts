import type { Root } from 'mdast'
import { Slugger } from './slug.js'
import type { TocEntry, RenderOptions, RenderResult } from './types.js'
import { rehypeGithubAlerts, rehypeExternalLinks, rehypeTypographer, rehypeMetadataCard, rehypeSafeLinkTargets, rehypePrefixFragmentLinks } from './plugins.js'

export const HEADING_ID_PREFIX = 'user-content-'

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
      const id = HEADING_ID_PREFIX + slugger.slug(text)

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
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { ParseResult } from '../parse/index.js'
import { sanitizeSchema } from '../parse/index.js'

export function renderToHtml(parsed: ParseResult, options?: RenderOptions): RenderResult {
  const highlight = options?.highlight ?? true
  const allowRawHtml = options?.allowRawHtml ?? false

  const toc = extractToc(parsed.tree)

  const processor = unified()
  
  processor.use(remarkRehype, { allowDangerousHtml: allowRawHtml, clobberPrefix: '' })
  processor.use(rehypeSlug)
  
  if (allowRawHtml) {
    processor.use(options?.plugins?.raw ?? rehypeRaw)
  }

  if (highlight !== false) {
    processor.use(options?.plugins?.highlight ?? rehypeHighlight)
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
        ['className', 'hljs', /^hljs-/, /^language-/, 'math', 'math-inline', 'math-display', /^math-/],
      ],
      span: [
        ...spanAttributes,
        ['className', 'hljs', /^hljs-/, /^language-/, 'math', 'math-inline', 'math-display', /^math-/],
      ],
    },
  }

  const attrs: Record<string, any[]> = (baseSchema.attributes ?? {}) as any
  const ext = (tag: string, ...more: any[]) => {
    const base = attrs[tag] ?? []
    const out = [...base]
    for (const m of more) {
      const i = Array.isArray(m) ? out.findIndex((x: any) => Array.isArray(x) && x[0] === m[0]) : -1
      if (i >= 0) out[i] = [...out[i], ...m.slice(1)]
      else out.push(m)
    }
    return out
  }
  const svgClass = ['className', 'markdown-alert-icon', 'external-link-icon']
  const widened: typeof sanitizeSchema = {
    ...baseSchema,
    attributes: {
      ...baseSchema.attributes,
      div: ext('div', ['className', 'math', 'math-display', /^math-/, 'markdown-metadata-card', /^markdown-alert(-[a-z]+)?$/], 'role', 'ariaLabel'),
      p: ext('p', ['className', 'markdown-alert-title']),
      span: ext('span'),
      a: ext('a', ['className', 'external-link'], 'target', 'rel'),
      svg: ext('svg', svgClass, 'ariaHidden'),
    } as any,
  }

  const schema = allowRawHtml
    ? {
        ...widened,
        attributes: {
          ...widened.attributes,
          '*': [...((widened.attributes as any)['*'] ?? []), 'style', 'className', 'data-info'],
        }
      }
    : widened

  if (options?.githubAlerts === true) {
    processor.use(rehypeGithubAlerts, { locale: options?.localizeAlerts === 'vi' ? 'vi' : 'en' })
  }
  if (options?.externalLinks === true) {
    processor.use(rehypeExternalLinks)
  }
  if (options?.typographer === true) {
    processor.use(rehypeTypographer)
  }
  if (options?.displayMetadata === true && parsed.frontmatter && Object.keys(parsed.frontmatter).length > 0) {
    processor.use(rehypeMetadataCard, parsed.frontmatter as Record<string, unknown>)
  }

  processor.use(rehypePrefixFragmentLinks, HEADING_ID_PREFIX)
  processor.use(rehypeSafeLinkTargets)
  processor.use(rehypeSanitize, schema as any)
  if (options?.math !== false) {
    processor.use(options?.plugins?.math ?? rehypeKatex, { throwOnError: false, strict: 'ignore' } as any)
  }
  processor.use(rehypeStringify, { allowDangerousHtml: allowRawHtml })

  try {
    const hast = processor.runSync(parsed.tree)
    const html = String(processor.stringify(hast))

    return { html, toc }
  } catch (error) {
    console.error('Render error:', error)
    return { html: '', toc }
  }
}
