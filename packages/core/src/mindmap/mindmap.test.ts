import { describe, it, expect } from 'vitest'
import { extractMindmap, type MindNode } from './mindmap.js'
import { parseMarkdown } from '../index.js'
import { extractToc } from '../render/index.js'

describe('extractMindmap', () => {
  it('creates root node with fallbackTitle', () => {
    const mdast = { type: 'root', children: [] }
    const result = extractMindmap(mdast, 'My Project')
    expect(result).toEqual({
      id: 'root',
      text: 'My Project',
      depth: 0,
      children: [],
    })
  })

  it('defaults root text to "Root" when fallbackTitle is not provided or empty', () => {
    const mdast = { type: 'root', children: [] }
    expect(extractMindmap(mdast).text).toBe('Root')
    expect(extractMindmap(mdast, '').text).toBe('Root')
    expect(extractMindmap(mdast, '   ').text).toBe('Root')
  })

  it('safely handles null, undefined, or empty mdast', () => {
    expect(extractMindmap(null as any)).toEqual({
      id: 'root',
      text: 'Root',
      depth: 0,
      children: [],
    })
    expect(extractMindmap(undefined as any)).toEqual({
      id: 'root',
      text: 'Root',
      depth: 0,
      children: [],
    })
    expect(extractMindmap({} as any)).toEqual({
      id: 'root',
      text: 'Root',
      depth: 0,
      children: [],
    })
  })

  it('extracts a single H1 heading under root', () => {
    const md = '# Getting Started'
    const { tree } = parseMarkdown(md)
    const result = extractMindmap(tree, 'Guide')

    expect(result.id).toBe('root')
    expect(result.text).toBe('Guide')
    expect(result.depth).toBe(0)
    expect(result.children).toHaveLength(1)

    const h1 = result.children[0]
    expect(h1).toEqual({
      id: 'getting-started',
      headingId: 'getting-started',
      depth: 1,
      text: 'Getting Started',
      children: [],
    })
  })

  it('nests headings naturally according to depth', () => {
    const md = `
# Overview
## Architecture
### Backend
### Frontend
## Deployment
# FAQ
`
    const { tree } = parseMarkdown(md)
    const result = extractMindmap(tree, 'Docs')

    expect(result.depth).toBe(0)
    expect(result.children).toHaveLength(2)

    const [overview, faq] = result.children
    expect(overview.text).toBe('Overview')
    expect(overview.depth).toBe(1)
    expect(overview.headingId).toBe('overview')
    expect(overview.children).toHaveLength(2)

    const [arch, deploy] = overview.children
    expect(arch.text).toBe('Architecture')
    expect(arch.depth).toBe(2)
    expect(arch.children).toHaveLength(2)

    const [backend, frontend] = arch.children
    expect(backend.text).toBe('Backend')
    expect(backend.depth).toBe(3)
    expect(frontend.text).toBe('Frontend')
    expect(frontend.depth).toBe(3)

    expect(deploy.text).toBe('Deployment')
    expect(deploy.depth).toBe(2)
    expect(deploy.children).toHaveLength(0)

    expect(faq.text).toBe('FAQ')
    expect(faq.depth).toBe(1)
    expect(faq.headingId).toBe('faq')
    expect(faq.children).toHaveLength(0)
  })

  it('handles skipping depth levels (e.g. H1 followed directly by H3)', () => {
    const md = `
# Chapter 1
### Deep Section
## Normal Section
`
    const { tree } = parseMarkdown(md)
    const result = extractMindmap(tree)

    const ch1 = result.children[0]
    expect(ch1.depth).toBe(1)
    expect(ch1.children).toHaveLength(2)
    expect(ch1.children[0].text).toBe('Deep Section')
    expect(ch1.children[0].depth).toBe(3)
    expect(ch1.children[1].text).toBe('Normal Section')
    expect(ch1.children[1].depth).toBe(2)
  })

  it('handles documents starting with H2 or lower when no H1 exists', () => {
    const md = `
## First H2
### Child H3
## Second H2
`
    const { tree } = parseMarkdown(md)
    const result = extractMindmap(tree)

    expect(result.children).toHaveLength(2)
    expect(result.children[0].text).toBe('First H2')
    expect(result.children[0].depth).toBe(2)
    expect(result.children[0].children).toHaveLength(1)
    expect(result.children[0].children[0].text).toBe('Child H3')
    expect(result.children[1].text).toBe('Second H2')
    expect(result.children[1].depth).toBe(2)
  })

  it('recursively extracts text from phrasing/inline nodes and trims whitespace', () => {
    const mdast = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 2,
          children: [
            { type: 'text', value: '   Leading and ' },
            { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
            { type: 'text', value: ' with ' },
            { type: 'emphasis', children: [{ type: 'text', value: 'italic' }] },
            { type: 'text', value: ' and ' },
            { type: 'inlineCode', value: 'code()' },
            { type: 'text', value: ' plus ' },
            {
              type: 'link',
              url: 'https://example.com',
              children: [{ type: 'text', value: 'link' }],
            },
            { type: 'text', value: ' trailing   ' },
          ],
        },
      ],
    }

    const result = extractMindmap(mdast)
    const node = result.children[0]
    expect(node.text).toBe('Leading and bold with italic and code() plus link trailing')
    expect(node.depth).toBe(2)
  })

  it('generates headingId consistent with extractToc including slug deduplication', () => {
    const md = `
# Same Title
# Same Title
# Same Title
`
    const { tree } = parseMarkdown(md)
    const toc = extractToc(tree)
    const mindmap = extractMindmap(tree)

    expect(mindmap.children).toHaveLength(3)
    expect(mindmap.children[0].headingId).toBe(toc[0].id)
    expect(mindmap.children[1].headingId).toBe(toc[1].id)
    expect(mindmap.children[2].headingId).toBe(toc[2].id)

    expect(mindmap.children[0].headingId).toBe('same-title')
    expect(mindmap.children[1].headingId).toBe('same-title-1')
    expect(mindmap.children[2].headingId).toBe('same-title-2')
  })

  it('produces deterministic output across multiple calls', () => {
    const md = `
# Root Item
## Branch A
### Leaf 1
## Branch B
`
    const { tree } = parseMarkdown(md)
    const run1 = extractMindmap(tree, 'Consistent Title')
    const run2 = extractMindmap(tree, 'Consistent Title')

    expect(run1).toEqual(run2)
  })

  it('is exported from packages/core index', async () => {
    const core = await import('../index.js')
    expect(typeof core.extractMindmap).toBe('function')
  })
})

