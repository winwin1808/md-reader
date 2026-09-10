import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import yaml from 'yaml'
import type { Root } from 'mdast'

export interface ParseOptions {
  /** GFM: table, task list, strikethrough, autolink. Default: true */
  gfm?: boolean
}

export interface ParseResult {
  /** mdast, frontmatter đã bị tách ra khỏi cây */
  tree: Root
  /** YAML frontmatter đã parse. {} khi không có hoặc lỗi. */
  frontmatter: Record<string, unknown>
  /** source gốc, giữ nguyên từng ký tự */
  raw: string
}

export function parseMarkdown(source: string, options?: ParseOptions): ParseResult {
  const processor = unified().use(remarkParse)
  
  if (options?.gfm !== false) {
    processor.use(remarkGfm)
  }
  
  processor.use(remarkFrontmatter, ['yaml'])
  
  const tree = processor.parse(source) as Root
  let frontmatter: Record<string, unknown> = {}

  if (tree.children[0]?.type === 'yaml') {
    const yamlNode = tree.children[0] as any // actually yaml node type isn't in default mdast
    try {
      const parsed = yaml.parse(yamlNode.value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter = parsed
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
