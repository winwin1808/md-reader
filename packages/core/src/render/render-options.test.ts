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
  })

  describe('renderToHtml pipeline', () => {
    it('applies options during render', () => {
      const parsed = parseMarkdown('> [!NOTE]\n> This is a note.\n\n"test"')
      const result = renderToHtml(parsed, { githubAlerts: true, typographer: true })
      expect(result.html).toContain('markdown-alert-note')
      expect(result.html).toContain('“test”')
    })
  })
})
