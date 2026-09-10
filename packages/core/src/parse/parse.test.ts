import { describe, it, expect } from 'vitest'
import { parseMarkdown, sanitizeSchema } from './index'

describe('parseMarkdown', () => {
  it('parses basic markdown', () => {
    const result = parseMarkdown('# Hello World')
    expect(result.raw).toBe('# Hello World')
    expect(result.frontmatter).toEqual({})
    expect(result.tree.children.length).toBe(1)
    expect(result.tree.children[0]?.type).toBe('heading')
  })

  it('extracts valid yaml frontmatter and removes it from tree', () => {
    const md = '---\ntitle: test\n---\n# Content'
    const result = parseMarkdown(md)
    expect(result.frontmatter).toEqual({ title: 'test' })
    expect(result.tree.children.length).toBe(1) // YAML removed
    expect(result.tree.children[0]?.type).toBe('heading')
    expect(result.raw).toBe(md)
  })

  it('handles invalid yaml frontmatter without throwing', () => {
    const md = '---\ntitle: : invalid\n---\n# Content'
    const result = parseMarkdown(md)
    expect(result.frontmatter).toHaveProperty('__parseError')
    expect(typeof result.frontmatter.__parseError).toBe('string')
    expect(result.tree.children.length).toBe(1) // YAML removed
    expect(result.tree.children[0]?.type).toBe('heading')
  })

  it('handles empty source', () => {
    const result = parseMarkdown('')
    expect(result.tree.children).toEqual([])
    expect(result.frontmatter).toEqual({})
    expect(result.raw).toBe('')
  })

  it('parses GFM by default (tables)', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    const result = parseMarkdown(md)
    expect(result.tree.children[0]?.type).toBe('table')
  })

  it('disables GFM when options.gfm is false', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    const result = parseMarkdown(md, { gfm: false })
    // Without GFM, a table is parsed as a paragraph usually
    expect(result.tree.children[0]?.type).not.toBe('table')
  })
})

describe('sanitizeSchema', () => {
  it('extends default schema with required configuration', () => {
    expect(sanitizeSchema.clobberPrefix).toBe('')
    
    const tags = sanitizeSchema.tagNames ?? []
    expect(tags).toContain('svg')
    expect(tags).toContain('path')
    expect(tags).toContain('rect')
    expect(tags).toContain('circle')
    
    expect(sanitizeSchema.attributes?.h1).toContain('id')
    expect(sanitizeSchema.attributes?.h6).toContain('id')
    
    const codeClasses = sanitizeSchema.attributes?.code?.filter(
      attr => Array.isArray(attr) && attr[0] === 'className'
    )
    expect(codeClasses?.length).toBeGreaterThan(0)
    const hasCodeHljs = codeClasses?.some(c => Array.isArray(c) && c.some(r => r instanceof RegExp && r.source === '^hljs-'))
    const hasCodeLanguage = codeClasses?.some(c => Array.isArray(c) && c.some(r => r instanceof RegExp && r.source === '^language-'))
    expect(hasCodeHljs).toBe(true)
    expect(hasCodeLanguage).toBe(true)
    
    const spanClasses = sanitizeSchema.attributes?.span?.filter(
      attr => Array.isArray(attr) && attr[0] === 'className'
    )
    expect(spanClasses?.length).toBeGreaterThan(0)
    const hasSpanHljs = spanClasses?.some(c => Array.isArray(c) && c.some(r => r instanceof RegExp && r.source === '^hljs-'))
    const hasSpanLanguage = spanClasses?.some(c => Array.isArray(c) && c.some(r => r instanceof RegExp && r.source === '^language-'))
    expect(hasSpanHljs).toBe(true)
    expect(hasSpanLanguage).toBe(true)
  })
})
