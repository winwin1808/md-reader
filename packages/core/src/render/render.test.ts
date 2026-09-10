import { test, expect, describe } from 'vitest'
import { extractToc, renderToHtml } from './index.js'
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

describe('renderToHtml', () => {
  test('renders markdown to html with highlight, sanitize, slug', () => {
    const markdown = '# Hello World\n\n```js\nconsole.log(1)\n```\n\n<script>alert(1)</script>'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { highlight: true, allowRawHtml: false })
    
    expect(result.html).toContain('<h1 id="hello-world">Hello World</h1>')
    expect(result.html).toContain('<span class="hljs-variable">console</span>')
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('alert(1)') // Text may remain, but <script> is stripped
    expect(result.toc).toHaveLength(1)
    expect(result.toc[0]!.id).toBe('hello-world')
  })
})
