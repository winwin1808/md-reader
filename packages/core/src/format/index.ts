import { unified } from 'unified'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { parseMarkdown } from '../parse/index.js'

export interface FormatOptions {
  bullet?: '-' | '*' | '+'
  emphasis?: '_' | '*'
  strong?: '_' | '*'
  /** true = ``` fence; false = indent 4 space. Default: true */
  fences?: boolean
  listIndent?: 'one' | 'tab' | 'mixed'
  /** Ngắt dòng mềm. 0 = không ngắt. Default: 0 */
  printWidth?: number
}

export const defaultFormatOptions: Required<FormatOptions> = {
  bullet: '-',
  emphasis: '_',
  strong: '*',
  fences: true,
  listIndent: 'one',
  printWidth: 0,
}

/** remark-parse → remark-stringify. Giữ frontmatter nguyên văn ở đầu output. */
export function formatMarkdown(source: string, options?: FormatOptions): string {
  if (!source || source.trim().length === 0) {
    return source
  }

  try {
    const match = source.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/)
    const rawFrontmatter = match?.[1] ?? ''
    const markdownBody = rawFrontmatter ? source.slice(rawFrontmatter.length) : source

    const opts = { ...defaultFormatOptions, ...options }
    const parsed = parseMarkdown(markdownBody)

    const processor = unified()
      .use(remarkGfm)
      .use(remarkStringify, {
        bullet: opts.bullet,
        emphasis: opts.emphasis,
        strong: opts.strong,
        fences: opts.fences,
        listItemIndent: opts.listIndent,
        lineWidth: opts.printWidth > 0 ? opts.printWidth : Infinity,
        resourceLink: true,
      })

    const formatted = String(processor.stringify(parsed.tree as any)).trimEnd()

    let result = ''
    if (rawFrontmatter) {
      result = rawFrontmatter.endsWith('\n') ? rawFrontmatter : rawFrontmatter + '\n'
      if (formatted.length > 0) {
        result += formatted + '\n'
      }
    } else {
      result = formatted.length > 0 ? formatted + '\n' : ''
    }

    if (source.trim().length > 0 && result.trim().length === 0) {
      return source
    }

    return result
  } catch {
    return source
  }
}
