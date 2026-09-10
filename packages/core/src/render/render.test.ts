import { test, expect, describe } from 'vitest'
import { extractToc } from './index.js'
import { Slugger } from './slug.js'
import { parseMarkdown } from '../parse/index.js'

describe('Slugger', () => {
  test('slug generation', () => {
    const slugger = new Slugger()
    expect(slugger.slug('Hello World')).toBe('hello-world')
    expect(slugger.slug('Hello World')).toBe('hello-world-1')
    expect(slugger.slug('Hello World')).toBe('hello-world-2')
    expect(slugger.slug('hello-world-1')).toBe('hello-world-1-1')
    slugger.reset()
    expect(slugger.slug('Hello World')).toBe('hello-world')
  })
})

describe('extractToc', () => {
  test('extracts table of contents', () => {
    const markdown = `
# Title
## Section 1
### Subsection 1.1
## Section 2
# Another Title
`
    const { tree } = parseMarkdown(markdown)
    const toc = extractToc(tree)
    
    expect(toc).toEqual([
      {
        id: 'title',
        depth: 1,
        text: 'Title',
        children: [
          {
            id: 'section-1',
            depth: 2,
            text: 'Section 1',
            children: [
              { id: 'subsection-11', depth: 3, text: 'Subsection 1.1', children: [] }
            ]
          },
          { id: 'section-2', depth: 2, text: 'Section 2', children: [] }
        ]
      },
      {
        id: 'another-title',
        depth: 1,
        text: 'Another Title',
        children: []
      }
    ])
  })
  
  test('handles inline formatting in headings', () => {
    const markdown = '## Hello **World** `code`'
    const { tree } = parseMarkdown(markdown)
    const toc = extractToc(tree)
    
    expect(toc[0]!.text).toBe('Hello World code')
    expect(toc[0]!.id).toBe('hello-world-code')
  })
})
