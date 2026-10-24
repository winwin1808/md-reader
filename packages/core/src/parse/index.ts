import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import type { Root } from 'mdast'

export interface ParseOptions {
  /** GFM: table, task list, strikethrough, autolink. Default: true */
  gfm?: boolean
  /** Math ($..$, $$..$$) via remark-math. Default: true */
  math?: boolean
  /** YAML parser; without it frontmatter is {} (node still stripped) */
  parseYaml?: (src: string) => unknown
}

export interface ParseResult {
  /** mdast, frontmatter đã bị tách ra khỏi cây */
  tree: Root
  /** YAML frontmatter đã parse. {} khi không có hoặc lỗi. */
  frontmatter: Record<string, unknown>
  /** source gốc, giữ nguyên từng ký tự */
  raw: string
}

function remarkMathGuard(tree: Root, source: string): void {
  const walk = (node: any): void => {
    const kids = node.children
    if (!Array.isArray(kids)) return
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i]
      if (k.type === 'inlineMath') {
        const start = k.position?.start.offset
        const end = k.position?.end.offset
        if (typeof start !== 'number' || typeof end !== 'number') continue
        const slice = source.slice(start, end)
        const m = /^(\$+)([\s\S]*?)(\$+)$/.exec(slice)
        const inner = (m ? m[2] : '') ?? ''
        const keep =
          !!m &&
          inner.length > 0 &&
          !/\s/.test(inner[0]!) &&
          !/\s/.test(inner[inner.length - 1]!) &&
          !/[0-9]/.test(source[end] ?? '')
        if (!keep) kids[i] = { type: 'text', value: slice, position: k.position }
      } else {
        walk(k)
      }
    }
  }
  walk(tree)
}

export function parseMarkdown(source: string, options?: ParseOptions): ParseResult {
  const processor = unified().use(remarkParse)
  
  if (options?.gfm !== false) {
    processor.use(remarkGfm)
  }
  
  if (options?.math !== false) {
    processor.use(remarkMath)
  }

  processor.use(remarkFrontmatter, ['yaml'])
  
  const tree = processor.parse(source) as Root
  if (options?.math !== false) remarkMathGuard(tree, source)
  let frontmatter: Record<string, unknown> = {}

  if (tree.children[0]?.type === 'yaml') {
    const yamlNode = tree.children[0] as any // actually yaml node type isn't in default mdast
    try {
      const parsed = options?.parseYaml ? options.parseYaml(yamlNode.value) : undefined
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>
      }
    } catch (err: unknown) {
      frontmatter = { 
        __parseError: err instanceof Error ? err.message : String(err) 
      }
    }
    tree.children.shift()
  }

  return {
    tree,
    frontmatter,
    raw: source
  }
}

export { sanitizeSchema } from './sanitize-schema.js'
