import { describe, it, expect } from 'vitest'
import { parseMarkdown } from './index'

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
