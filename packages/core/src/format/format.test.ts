import { describe, it, expect } from 'vitest'
import { formatMarkdown, defaultFormatOptions, parseMarkdown } from '../index.js'

function extractAllText(node: any): string {
  let text = ''
  if (typeof node.value === 'string') {
    text += node.value
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      text += extractAllText(child)
    }
  }
  return text
}

describe('formatMarkdown', () => {
  describe('Idempotence: formatMarkdown(formatMarkdown(x)) === formatMarkdown(x)', () => {
    const fixtures: Record<string, string> = {
      'Nested lists (ordered & unordered)': `1. First item
   - Sub item A
   - Sub item B
2. Second item
   1. Sub item 2.1
   2. Sub item 2.2
`,
      'Tables (GFM table with alignment)': `| Left Align | Center Align | Right Align |
| :--- | :---: | ---: |
| Alpha | Beta | Gamma |
| 10 | 20 | 30 |
`,
      'Code fence inside list item': `- First item
  \`\`\`ts
  const message = 'hello'
  console.log(message)
  \`\`\`
- Second item
`,
      'Frontmatter + Markdown content': `---
title: Test Document
tags: [one, two]
# arbitrary comment
nested:
  val: 42
---

# Title

This is a paragraph with **bold** text and _italic_ text.

- List item 1
- List item 2
`,
      'Task list (checked & unchecked)': `- [ ] Incomplete task
- [x] Completed task
  - [ ] Sub task
`,
      'Reference links & definitions': `Here is [first link][ref1] and [second link][ref2].

[ref1]: https://example.com "Example Title"
[ref2]: https://sub.example.com
`,
    }

    for (const [name, fixture] of Object.entries(fixtures)) {
      it(`is idempotent on: ${name}`, () => {
        const pass1 = formatMarkdown(fixture)
        const pass2 = formatMarkdown(pass1)
        expect(pass2).toBe(pass1)
      })
    }
  })

  describe('Content preservation', () => {
    it('preserves text content between input and formatted output', () => {
      const source = `# Main Heading

This is a paragraph with **strong text** and _emphasized text_ and \`inline code\`.

## Sub Heading

Here is a list:
- Item 1
- Item 2 with more description

And a code block:

\`\`\`javascript
function add(a, b) {
  return a + b
}
\`\`\`
`
      const formatted = formatMarkdown(source)
      const originalAst = parseMarkdown(source).tree
      const formattedAst = parseMarkdown(formatted).tree

      const originalText = extractAllText(originalAst)
      const formattedText = extractAllText(formattedAst)

      expect(formattedText).toBe(originalText)
    })
  })

  describe('Frontmatter preservation', () => {
    it('preserves exact frontmatter including custom format, comments, and spacing', () => {
      const rawFrontmatter = `---
# Important YAML comment
title: "Custom Title with Quotes"
custom_spacing:   true
weird_indent:
    - a
    - b
---
`
      const body = `# Markdown Body

Content here.
`
      const source = rawFrontmatter + body
      const formatted = formatMarkdown(source)

      expect(formatted.startsWith(rawFrontmatter)).toBe(true)
    })
  })

  describe('Default format options', () => {
    it('exports defaultFormatOptions with specified defaults', () => {
      expect(defaultFormatOptions).toEqual({
        bullet: '-',
        emphasis: '_',
        strong: '*',
        fences: true,
        listIndent: 'one',
        printWidth: 0,
      })
    })

    it('applies default format options: bullet -, strong **, emphasis _, fences ```', () => {
      const input = `* list item 1
* list item 2

__strong text__ and *italic text*

    const a = 1
`
      const formatted = formatMarkdown(input)

      // Bullet should be '-'
      expect(formatted).toContain('- list item 1')
      expect(formatted).toContain('- list item 2')

      // Strong should be '**'
      expect(formatted).toContain('**strong text**')

      // Emphasis should be '_'
      expect(formatted).toContain('_italic text_')

      // Fences should be used instead of 4-space indent
      expect(formatted).toContain('```')
    })

    it('respects custom format options', () => {
      const input = `- item 1
- item 2

**strong** and _italic_
`
      const formatted = formatMarkdown(input, {
        bullet: '+',
        strong: '_',
        emphasis: '*',
      })

      expect(formatted).toContain('+ item 1')
      expect(formatted).toContain('+ item 2')
      expect(formatted).toContain('__strong__')
      expect(formatted).toContain('*italic*')
    })
  })

  describe('Error handling & Edge cases', () => {
    it('returns empty string when given empty string', () => {
      expect(formatMarkdown('')).toBe('')
    })

    it('returns original string when given only whitespace', () => {
      expect(formatMarkdown('   \n  \t  ')).toBe('   \n  \t  ')
    })

    it('preserves frontmatter when input has only frontmatter', () => {
      const onlyFrontmatter = `---
title: Only Frontmatter
date: 2026-09-11
---
`
      expect(formatMarkdown(onlyFrontmatter)).toBe(onlyFrontmatter)
    })

    it('returns original source if formatting produces empty output for non-empty input', () => {
      // Safety guard check
      const input = 'some input'
      const res = formatMarkdown(input)
      expect(res.trim().length).toBeGreaterThan(0)
    })
  })
})
