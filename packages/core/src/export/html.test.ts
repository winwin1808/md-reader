import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportToHtml, type ExportHtmlOptions } from './html.js'
import { exportToHtml as indexExportToHtml } from '../index.js'

describe('exportToHtml', () => {
  const sampleCss = 'body { font-family: sans-serif; } .md-viewer { color: #333; }'
  const sampleHtml = '<h1>Hello World</h1><p>This is markdown content.</p>'
  const sampleTitle = 'My Document'

  it('is exported properly from core index entry point', () => {
    expect(indexExportToHtml).toBe(exportToHtml)
  })

  it('generates a self-contained HTML document with all required elements', async () => {
    const result = await exportToHtml({
      html: sampleHtml,
      cssContent: sampleCss,
      title: sampleTitle,
    })

    expect(result).toMatch(/^<!DOCTYPE html>/i)
    expect(result).toContain('<html')
    expect(result).toContain('</html>')
    expect(result).toContain('<head>')
    expect(result).toContain('</head>')
    expect(result).toMatch(/<meta\s+charset=["']?utf-8["']?/i)
    expect(result).toMatch(/<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*["']/i)
    expect(result).toContain(`<title>${sampleTitle}</title>`)
    expect(result).toContain(`<style>${sampleCss}</style>`)
    expect(result).toContain('<body>')
    expect(result).toContain('</body>')
    expect(result).toContain(`<div class="md-viewer">${sampleHtml}</div>`)
  })

  it('escapes special characters in the title', async () => {
    const dangerousTitle = '<script>alert("xss")</script> & "quotes" \'single\''
    const result = await exportToHtml({
      html: sampleHtml,
      cssContent: sampleCss,
      title: dangerousTitle,
    })

    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;quotes&quot; &#39;single&#39;')
  })

  it('preserves existing data URIs in image src attributes', async () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const htmlWithDataUri = `<p><img src="${dataUri}" alt="pixel" /></p>`

    const fetchImageMock = vi.fn()
    const result = await exportToHtml({
      html: htmlWithDataUri,
      cssContent: sampleCss,
      title: sampleTitle,
      fetchImage: fetchImageMock,
    })

    expect(result).toContain(`src="${dataUri}"`)
    expect(fetchImageMock).not.toHaveBeenCalled()
  })

  it('converts image URLs to data URIs using custom fetchImage', async () => {
    const imgUrl = 'https://example.com/image.png'
    const htmlWithImg = `<p><img src="${imgUrl}" alt="example" class="responsive" /></p>`
    const fakeBase64 = 'iVBORw0KGgoAAAA='
    const fakeMime = 'image/png'

    const fetchImage = vi.fn().mockResolvedValue({
      base64: fakeBase64,
      mimeType: fakeMime,
    })

    const result = await exportToHtml({
      html: htmlWithImg,
      cssContent: sampleCss,
      title: sampleTitle,
      fetchImage,
    })

    expect(fetchImage).toHaveBeenCalledWith(imgUrl)
    expect(result).toContain(`src="data:${fakeMime};base64,${fakeBase64}"`)
    expect(result).toContain('alt="example"')
    expect(result).toContain('class="responsive"')
    expect(result).not.toContain(imgUrl)
  })

  it('retains original src if fetchImage returns null', async () => {
    const imgUrl = 'https://example.com/nonexistent.png'
    const htmlWithImg = `<p><img src="${imgUrl}" alt="missing" /></p>`

    const fetchImage = vi.fn().mockResolvedValue(null)

    const result = await exportToHtml({
      html: htmlWithImg,
      cssContent: sampleCss,
      title: sampleTitle,
      fetchImage,
    })

    expect(fetchImage).toHaveBeenCalledWith(imgUrl)
    expect(result).toContain(`src="${imgUrl}"`)
  })

  it('retains original src if fetchImage throws an error', async () => {
    const imgUrl = 'https://example.com/error.png'
    const htmlWithImg = `<p><img src="${imgUrl}" alt="error" /></p>`

    const fetchImage = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await exportToHtml({
      html: htmlWithImg,
      cssContent: sampleCss,
      title: sampleTitle,
      fetchImage,
    })

    expect(fetchImage).toHaveBeenCalledWith(imgUrl)
    expect(result).toContain(`src="${imgUrl}"`)
  })

  it('handles multiple images with mixed success and failure', async () => {
    const url1 = 'https://example.com/ok.png'
    const url2 = 'https://example.com/fail.png'
    const html = `<p><img src="${url1}"><img src="${url2}"></p>`

    const fetchImage = vi.fn().mockImplementation(async (url: string) => {
      if (url === url1) {
        return { base64: 'okbase64', mimeType: 'image/png' }
      }
      return null
    })

    const result = await exportToHtml({
      html,
      cssContent: sampleCss,
      title: sampleTitle,
      fetchImage,
    })

    expect(result).toContain('src="data:image/png;base64,okbase64"')
    expect(result).toContain(`src="${url2}"`)
  })

  it('handles img tags without src or with empty src gracefully', async () => {
    const html = '<p><img alt="no src"><img><img src=""></p>'
    const fetchImage = vi.fn()

    const result = await exportToHtml({
      html,
      cssContent: sampleCss,
      title: sampleTitle,
      fetchImage,
    })

    expect(fetchImage).not.toHaveBeenCalled()
    expect(result).toContain('<img alt="no src">')
  })

  describe('default fetchImage using global fetch', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('uses global fetch when fetchImage is not provided and converts image', async () => {
      const imgUrl = 'https://example.com/default-fetch.png'
      const html = `<img src="${imgUrl}">`

      const fakeArrayBuffer = new Uint8Array([1, 2, 3, 4]).buffer
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: vi.fn().mockResolvedValue(fakeArrayBuffer),
      }
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await exportToHtml({
        html,
        cssContent: sampleCss,
        title: sampleTitle,
      })

      const expectedBase64 = Buffer.from([1, 2, 3, 4]).toString('base64')
      expect(result).toContain(`src="data:image/png;base64,${expectedBase64}"`)
    })

    it('keeps original src if global fetch fails', async () => {
      const imgUrl = 'https://example.com/fetch-error.png'
      const html = `<img src="${imgUrl}">`

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Fetch failed'))

      const result = await exportToHtml({
        html,
        cssContent: sampleCss,
        title: sampleTitle,
      })

      expect(result).toContain(`src="${imgUrl}"`)
    })
  })
})
