import { describe, it, expect } from 'vitest'
import { applyTypographer, applyExternalLinks, applyGitHubAlerts, processFrontmatter } from './options.js'
import { parseMarkdown } from '../parse/index.js'
import { renderToHtml } from './render.js'

describe('Render Options', () => {
  describe('applyTypographer', () => {
    it('replaces symbols and smart quotes', () => {
      const input = '<p>Hello "world", it\'s a test (c) (tm) (r) -- ---</p>'
      const expected = '<p>Hello “world”, it’s a test © ™ ® – —</p>'
      expect(applyTypographer(input)).toBe(expected)
    })
    it('preserves code blocks', () => {
      const input = '<pre><code>"test" (c)</code></pre><p>"test"</p>'
      const expected = '<pre><code>"test" (c)</code></pre><p>“test”</p>'
      expect(applyTypographer(input)).toBe(expected)
    })
  })

  describe('applyExternalLinks', () => {
    it('adds attributes and svg to external links', () => {
      const input = '<a href="https://example.com">Example</a>'
      const result = applyExternalLinks(input)
      expect(result).toContain('class="external-link"')
      expect(result).toContain('target="_blank"')
      expect(result).toContain('rel="noopener noreferrer"')
      expect(result).toContain('external-link-icon')
    })
    it('does not double apply to existing external links', () => {
      const input = '<a href="https://example.com" class="external-link">Example</a>'
      const result = applyExternalLinks(input)
      expect(result).toBe(input)
    })
  })

  describe('applyGitHubAlerts', () => {
    it('transforms note alert', () => {
      const input = '<blockquote><p>[!NOTE]<br>This is a note.</p></blockquote>'
      const result = applyGitHubAlerts(input)
      expect(result).toContain('markdown-alert-note')
      expect(result).toContain('Note') // Default title
      expect(result).toContain('This is a note.')
    })
    it('localizes alert title to vi', () => {
      const input = '<blockquote>\n<p>[!TIP]\nThis is a tip.</p>\n</blockquote>'
      const result = applyGitHubAlerts(input, 'vi')
      expect(result).toContain('markdown-alert-tip')
      expect(result).toContain('Mẹo')
    })
    it('renders alert svg icons with attributes', () => {
      const input = '<blockquote><p>[!WARNING]<br>Watch out!</p></blockquote>'
      const result = applyGitHubAlerts(input)
      expect(result).toContain('markdown-alert-warning')
      expect(result).toContain('class="markdown-alert-icon"')
      expect(result).toContain('viewBox="0 0 16 16"')
      expect(result).toContain('aria-hidden="true"')
      expect(result).toContain('<path')
    })
  })

  describe('processFrontmatter', () => {
    it('strips frontmatter when stripFrontmatter is true', () => {
      const input = '---\ntitle: Hello\n---\n# World'
      const result = processFrontmatter(input, { stripFrontmatter: true })
      expect(result.cleanMarkdown.trim()).toBe('# World')
    })
    it('displays metadata when displayMetadata is true', () => {
      const input = '---\ntitle: Hello\n---\n# World'
      const result = processFrontmatter(input, { displayMetadata: true })
      expect(result.cleanMarkdown.trim()).toBe('# World')
      expect(result.metadataHtml).toContain('markdown-metadata-card')
      expect(result.metadataHtml).toContain('title')
      expect(result.metadataHtml).toContain('Hello')
    })
    it('handles CRLF line endings in frontmatter', () => {
      const input = '---\r\ntitle: Windows\r\nauthor: Dev\r\n---\r\n# Hello CRLF'
      const result = processFrontmatter(input, { displayMetadata: true })
      expect(result.cleanMarkdown.trim()).toBe('# Hello CRLF')
      expect(result.metadataHtml).toContain('Windows')
      expect(result.metadataHtml).toContain('Dev')
    })
    it('escapes html entities in metadata keys and values to prevent XSS', () => {
      const input = '---\n<tag>: <script>alert("xss")</script> & \'test\'\n---\n# Body'
      const result = processFrontmatter(input, { displayMetadata: true })
      expect(result.metadataHtml).toContain('&lt;tag&gt;')
      expect(result.metadataHtml).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(result.metadataHtml).toContain('&amp;')
      expect(result.metadataHtml).toContain('&#39;test&#39;')
      expect(result.metadataHtml).not.toContain('<script>')
      expect(result.metadataHtml).not.toContain('<tag>')
    })
  })

  describe('renderToHtml pipeline', () => {
    it('applies options during render', () => {
      const parsed = parseMarkdown('> [!NOTE]\n> This is a note.\n\n"test"')
      const result = renderToHtml(parsed, { githubAlerts: true, typographer: true })
      expect(result.html).toContain('markdown-alert-note')
      expect(result.html).toContain('“test”')
    })
    it('renders metadata card when displayMetadata is true with escaped content', () => {
      const parsed = parseMarkdown('---\ntitle: <script>xss</script>\nauthor: Alice & Bob\n---\n# Content')
      const result = renderToHtml(parsed, { displayMetadata: true })
      expect(result.html).toContain('markdown-metadata-card')
      expect(result.html).toContain('&lt;script&gt;xss&lt;/script&gt;')
      expect(result.html).toContain('Alice &amp; Bob')
      expect(result.html).not.toContain('<script>xss</script>')
      expect(result.html.startsWith('<div class="markdown-metadata-card">')).toBe(true)
    })
    it('inserts external-link class and svg icon inside <a> when externalLinks is true', () => {
      const parsed = parseMarkdown('[Example](https://example.com)')
      const result = renderToHtml(parsed, { externalLinks: true })
      expect(result.html).toContain('class="external-link"')
      expect(result.html).toContain('target="_blank"')
      expect(result.html).toContain('rel="noopener noreferrer"')
      expect(result.html).toContain('external-link-icon')
    })
    it('renders alert svg icons when githubAlerts is true', () => {
      const parsed = parseMarkdown('> [!WARNING]\n> Danger zone')
      const result = renderToHtml(parsed, { githubAlerts: true })
      expect(result.html).toContain('markdown-alert-warning')
      expect(result.html).toContain('class="markdown-alert-icon"')
      expect(result.html).toContain('viewBox="0 0 16 16"')
      expect(result.html).toContain('aria-hidden="true"')
    })
  })
})
