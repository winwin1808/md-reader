import { describe, it, expect } from 'vitest'
import type { Root } from 'mdast'
import { mdastToDocx } from './docx.js'

describe('mdastToDocx', () => {
  it('converts headings of depths 1 through 6 to docx Blob', async () => {
    const mdast: Root = {
      type: 'root',
      children: [
        { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Heading 1' }] },
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Heading 2' }] },
        { type: 'heading', depth: 3, children: [{ type: 'text', value: 'Heading 3' }] },
        { type: 'heading', depth: 4, children: [{ type: 'text', value: 'Heading 4' }] },
        { type: 'heading', depth: 5, children: [{ type: 'text', value: 'Heading 5' }] },
        { type: 'heading', depth: 6, children: [{ type: 'text', value: 'Heading 6' }] },
      ],
    }

    const blob = await mdastToDocx({ mdast, title: 'Document Title' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('converts paragraphs with formatting (strong, emphasis, inlineCode, delete, link)', async () => {
    const mdast: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Normal text ' },
            { type: 'strong', children: [{ type: 'text', value: 'bold text' }] },
            { type: 'text', value: ' and ' },
            { type: 'emphasis', children: [{ type: 'text', value: 'italic text' }] },
            { type: 'text', value: ' and ' },
            { type: 'delete', children: [{ type: 'text', value: 'strikethrough text' }] },
            { type: 'text', value: ' and ' },
            { type: 'inlineCode', value: 'code snippet' },
            { type: 'text', value: ' with a ' },
            {
              type: 'link',
              url: 'https://example.com',
              children: [{ type: 'text', value: 'link' }],
            },
          ],
        },
      ],
    }

    const blob = await mdastToDocx({ mdast })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('converts unordered and ordered lists, including nested lists', async () => {
    const mdast: Root = {
      type: 'root',
      children: [
        {
          type: 'list',
          ordered: false,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Unordered item 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Unordered item 2' }],
                },
                {
                  type: 'list',
                  ordered: true,
                  children: [
                    {
                      type: 'listItem',
                      children: [
                        {
                          type: 'paragraph',
                          children: [{ type: 'text', value: 'Nested ordered 1' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'list',
          ordered: true,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Ordered item 1' }],
                },
              ],
            },
          ],
        },
      ],
    }

    const blob = await mdastToDocx({ mdast })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('converts blockquotes and code blocks', async () => {
    const mdast: Root = {
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', value: 'This is a quote' }],
            },
          ],
        },
        {
          type: 'code',
          lang: 'typescript',
          value: 'const hello = "world";\nconsole.log(hello);',
        },
      ],
    }

    const blob = await mdastToDocx({ mdast })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('converts tables with header and rows', async () => {
    const mdast: Root = {
      type: 'root',
      children: [
        {
          type: 'table',
          align: ['left', 'center', 'right'],
          children: [
            {
              type: 'tableRow',
              children: [
                { type: 'tableCell', children: [{ type: 'text', value: 'Col A' }] },
                { type: 'tableCell', children: [{ type: 'text', value: 'Col B' }] },
                { type: 'tableCell', children: [{ type: 'text', value: 'Col C' }] },
              ],
            },
            {
              type: 'tableRow',
              children: [
                { type: 'tableCell', children: [{ type: 'text', value: 'Cell 1' }] },
                { type: 'tableCell', children: [{ type: 'text', value: 'Cell 2' }] },
                { type: 'tableCell', children: [{ type: 'text', value: 'Cell 3' }] },
              ],
            },
          ],
        },
      ],
    }

    const blob = await mdastToDocx({ mdast })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('converts thematic breaks', async () => {
    const mdast: Root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Above divider' }] },
        { type: 'thematicBreak' },
        { type: 'paragraph', children: [{ type: 'text', value: 'Below divider' }] },
      ],
    }

    const blob = await mdastToDocx({ mdast })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles image with imageMap and fallback without imageMap', async () => {
    // 1x1 png array buffer
    const pngBytes = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6,
      0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1,
      13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ])
    const imageMap = {
      'test.png': {
        buffer: pngBytes.buffer,
        width: 100,
        height: 100,
      },
    }

    const mdast: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'image', url: 'test.png', alt: 'Test image' },
            { type: 'image', url: 'missing.png', alt: 'Missing image' },
          ],
        },
      ],
    }

    const blob = await mdastToDocx({ mdast, imageMap })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles unhandled nodes without throwing (fallback text extraction)', async () => {
    const mdast: Root = {
      type: 'root',
      children: [
        {
          type: 'customNode' as any,
          children: [{ type: 'text', value: 'Fallback content' }],
        } as any,
      ],
    }

    const blob = await mdastToDocx({ mdast })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles empty mdast root', async () => {
    const mdast: Root = {
      type: 'root',
      children: [],
    }

    const blob = await mdastToDocx({ mdast })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
