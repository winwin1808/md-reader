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
        id: 'user-content-title',
        depth: 1,
        text: 'Title',
        children: [
          {
            id: 'user-content-section-1',
            depth: 2,
            text: 'Section 1',
            children: [
              { id: 'user-content-subsection-11', depth: 3, text: 'Subsection 1.1', children: [] }
            ]
          },
          { id: 'user-content-section-2', depth: 2, text: 'Section 2', children: [] }
        ]
      },
      {
        id: 'user-content-another-title',
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
    expect(toc[0]!.id).toBe('user-content-hello-world-code')
  })
})

describe('renderToHtml', () => {
  test('renders markdown to html with highlight, sanitize, slug', () => {
    const markdown = '# Hello World\n\n```js\nconsole.log(1)\n```\n\n<script>alert(1)</script>'
    const parsed = parseMarkdown(markdown)
    const result = renderToHtml(parsed, { highlight: true, allowRawHtml: false })
    
    expect(result.html).toContain('<h1 id="user-content-hello-world">Hello World</h1>')
    expect(result.html).toContain('<span class="hljs-variable">console</span>')
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('alert(1)') // Text may remain, but <script> is stripped
    expect(result.toc).toHaveLength(1)
    expect(result.toc[0]!.id).toBe('user-content-hello-world')
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
    
    expect(result.html).toContain('<h1 id="user-content-title">Title</h1>')
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

  test('1. Thẻ inline HTML lồng text', () => {
    const parsed = parseMarkdown('Hello <span>text</span>')
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).toContain('<p>Hello <span>text</span></p>')
  })

  test('2. Entity HTML', () => {
    const parsed = parseMarkdown('<div>&amp;</div>')
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).toContain('&#x26;')
    expect(result.html).not.toContain('&#x26;amp;')
  })

  test('3. Script và on* vẫn bị loại bỏ triệt để', () => {
    const parsed = parseMarkdown('<div onclick="alert(1)"><script>alert(2)</script>Safe</div>')
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('alert(2)')
    expect(result.html).not.toContain('onclick')
    expect(result.html).toContain('<div>Safe</div>')
  })

  test('4. Attribute chứa >', () => {
    const parsed = parseMarkdown('<span title="> ">hello</span>')
    const result = renderToHtml(parsed, { allowRawHtml: true })
    expect(result.html).toContain('title="> "')
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

  test('highlight: block contains class hljs and language-*', () => {
    const result = renderToHtml(parseMarkdown('```ts\nconst x = 1\n```'))
    expect(result.html).toMatch(/<code[^>]*class="[^"]*hljs language-ts[^"]*"[^>]*>/)
  })

  test('ToC ID collision sync: duplicates get unique suffixes and sync perfectly with html', () => {
    const markdown = '# Heading\n# Heading\n# Heading'
    const result = renderToHtml(parseMarkdown(markdown))
    
    expect(result.toc).toHaveLength(3)
    expect(result.toc[0]!.id).toBe('user-content-heading')
    expect(result.toc[1]!.id).toBe('user-content-heading-1')
    expect(result.toc[2]!.id).toBe('user-content-heading-2')
    
    expect(result.html).toContain('<h1 id="user-content-heading">')
    expect(result.html).toContain('<h1 id="user-content-heading-1">')
    expect(result.html).toContain('<h1 id="user-content-heading-2">')
  })
})

describe('prefixed ids', () => {
  test('headings and toc are prefixed', () => {
    const { html, toc } = renderToHtml(parseMarkdown('# Hello'))
    expect(html).toContain('<h1 id="user-content-hello">')
    expect(toc[0]!.id).toBe('user-content-hello')
  })
  test('raw html id/name are prefixed', () => {
    const { html } = renderToHtml(parseMarkdown('<a id="x" name="y">t</a>'), { allowRawHtml: true })
    expect(html).toContain('id="user-content-x"')
    expect(html).toContain('name="user-content-y"')
  })
  test('footnote target id exists exactly once', () => {
    const { html } = renderToHtml(parseMarkdown('a[^1]\n\n[^1]: n'))
    const m = html.match(/<a href="#([^"]+)"[^>]*data-footnote-ref/) ?? html.match(/href="#([^"]*fn-1)"/)
    expect(m).not.toBeNull()
    let id = m![1]!
    if (!id.startsWith('user-content-')) id = 'user-content-' + id
    expect(html.split(`id="${id}"`).length - 1).toBe(1)
  })
  test('foreignObject is stripped', () => {
    const { html } = renderToHtml(parseMarkdown('<svg><foreignObject><div>x</div></foreignObject></svg>'), { allowRawHtml: true })
    expect(html.toLowerCase()).not.toContain('foreignobject')
  })
})
