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

  test('renders complex markdown fixture with heading, table, task list, code block, link, image', () => {
    const markdown = `
# Title

| A | B |
|---|---|
| 1 | 2 |

- [ ] Task 1
- [x] Task 2

\`\`\`
No lang
\`\`\`

\`\`\`ts
const x = 1;
\`\`\`

[Link](https://example.com)
![Image](https://example.com/img.png)
`
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { highlight: true, allowRawHtml: false })
    
    expect(result.html).toContain('<h1 id="title">Title</h1>')
    expect(result.html).toContain('<table>')
    expect(result.html).toMatchSnapshot()
  })

  test('highlight: false -> <pre><code> does not have hljs classes', () => {
    const markdown = '```js\nconsole.log(1)\n```'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { highlight: false })
    expect(result.html).toContain('<pre><code class="language-js">console.log(1)\n</code></pre>')
    expect(result.html).not.toContain('hljs')
  })

  test('allowRawHtml: false -> removes <script> and on* attributes', () => {
    const markdown = '<script>alert("hack")</script>\n<button onclick="alert(1)">Click</button>'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { allowRawHtml: false })
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('onclick')
    expect(result.html).not.toContain('alert(1)')
    expect(result.html).toContain('Click')
  })

  test('allowRawHtml: true -> keeps safe HTML', () => {
    const markdown = '<div><span class="safe" style="color: red">Hello safe HTML</span></div>'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).toContain('<div>')
    expect(result.html).toContain('Hello safe HTML')
  })

  test('allowRawHtml: true -> handles > in attributes', () => {
    const markdown = '<div><span title=">">hello</span></div>'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).toContain('<span title=">">hello</span>')
  })

  test('allowRawHtml: true -> handles single and double quotes in attributes', () => {
    const markdown = '<div><span data-info=\'single > quote\'>test</span><span data-info="double > quote">test</span></div>'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).toContain('<span data-info="single > quote">test</span>')
    expect(result.html).toContain('<span data-info="double > quote">test</span>')
  })

  test('allowRawHtml: true -> still removes script and handler', () => {
    const markdown = '<div onclick="alert(1)">Hello<script>alert(2)</script></div>'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('alert(2)')
    expect(result.html).not.toContain('onclick')
    expect(result.html).not.toContain('alert(1)')
    expect(result.html).toContain('<div>Hello</div>')
  })

  test('ToC ID sync: every id in result.toc appears in result.html', () => {
    const markdown = `
# H1
## H2
### H3
## H2 again
`
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed)

    const checkTocIds = (items: typeof result.toc) => {
      for (const item of items) {
        expect(result.html).toContain(`id="${item.id}"`)
        if (item.children) {
          checkTocIds(item.children)
        }
      }
    }
    
    checkTocIds(result.toc)
    expect(result.toc.length).toBeGreaterThan(0)
  })

  test('Error handling: link javascript:... is sanitized, href removed or changed', () => {
    const markdown = '[hack](javascript:alert(1))'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { allowRawHtml: false })
    
    expect(result.html).not.toContain('javascript:')
  })
})
