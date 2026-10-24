import { describe, it, expect } from 'vitest'
import { processFrontmatter } from './options.js'
import { parseMarkdown } from '../parse/index.js'
import { renderToHtml } from './render.js'
import { defaultRenderPlugins, parseYaml } from '../plugins/index.js'

describe('Render Options', () => {
  const r = (md: string, o: Record<string, unknown>) => renderToHtml(parseMarkdown(md), { plugins: defaultRenderPlugins(), ...o } as any).html

  describe('typographer', () => {
    it('replaces symbols and smart quotes', () => {
      const html = r('Hello "world", it\'s a test (c) (tm) (r) -- ---', { typographer: true })
      expect(html).toContain('Hello “world”, it’s a test © ™ ® – —')
    })
    it('preserves code blocks', () => {
      const html = r('```\n"test" (c)\n```\n\n"test"', { typographer: true, highlight: false })
      expect(html).toContain('<code>"test" (c)\n</code>')
      expect(html).toContain('<p>“test”</p>')
    })
    it('leaves inline code untouched', () => {
      const html = r('a -- b `--x--`', { typographer: true })
      expect(html).toContain('a – b')
      expect(html).toContain('<code>--x--</code>')
    })
  })

  describe('external links', () => {
    it('adds attributes and svg to external links', () => {
      const result = r('[Example](https://example.com)', { externalLinks: true })
      expect(result).toContain('class="external-link"')
      expect(result).toContain('target="_blank"')
      expect(result).toContain('rel="noopener noreferrer"')
      expect(result).toContain('external-link-icon')
    })
    it('does not touch relative links', () => {
      const result = r('[Example](./a.md)', { externalLinks: true })
      expect(result).not.toContain('external-link')
    })
    it('javascript: links get no target/rel and no javascript: href', () => {
      const result = r('[x](javascript:alert(1))', { externalLinks: true })
      expect(result).not.toContain('target')
      expect(result).not.toContain('rel=')
      expect(result).not.toContain('javascript:')
    })
  })

  describe('github alerts', () => {
    it('transforms note alert', () => {
      const result = r('> [!NOTE]\n> This is a note.', { githubAlerts: true })
      expect(result).toContain('markdown-alert-note')
      expect(result).toContain('Note')
      expect(result).toContain('This is a note.')
      expect(result).not.toContain('[!NOTE]')
    })
    it('localizes alert title to vi', () => {
      const result = r('> [!TIP]\n> This is a tip.', { githubAlerts: true, localizeAlerts: 'vi' })
      expect(result).toContain('markdown-alert-tip')
      expect(result).toContain('Mẹo')
    })
    it('renders alert svg icons with attributes', () => {
      const result = r('> [!WARNING]\n> Watch out!', { githubAlerts: true })
      expect(result).toContain('markdown-alert-warning')
      expect(result).toContain('class="markdown-alert-icon"')
      expect(result).toContain('viewBox="0 0 16 16"')
      expect(result).toContain('aria-hidden="true"')
      expect(result).toContain('<path')
      expect(result).toContain('role="region"')
    })
    it('does not let alert content bypass sanitize (raw html off)', () => {
      const result = r('> [!NOTE]\n> <img src=x onerror=alert(1)>', { githubAlerts: true, allowRawHtml: false })
      expect(result).not.toContain('<img')
      expect(result).not.toContain('onerror')
    })
    it('does not let alert content bypass sanitize (raw html on)', () => {
      const result = r('> [!NOTE]\n> <img src=x onerror=alert(1)>', { githubAlerts: true, allowRawHtml: true })
      expect(result).not.toContain('onerror')
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
      const parsed = parseMarkdown('---\ntitle: <script>xss</script>\nauthor: Alice & Bob\n---\n# Content', { parseYaml })
      const result = renderToHtml(parsed, { displayMetadata: true })
      expect(result.html).toContain('markdown-metadata-card')
      expect(result.html).toContain('&#x3C;script>xss&#x3C;/script>')
      expect(result.html).toContain('Alice &#x26; Bob')
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

  describe('6g1.2 review fixes', () => {
    it('forces noopener noreferrer on targeted raw links without externalLinks', () => {
      const html = r('<a href="https://e" target="_blank">x</a>', { allowRawHtml: true })
      expect(html).toContain('noopener')
      expect(html).toContain('noreferrer')
    })
    it('normalizes author external-link anchors with exactly one icon', () => {
      const html = r('<a href="https://e" class="external-link" target="_self">x</a>', {
        allowRawHtml: true,
        externalLinks: true,
      })
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
      expect(html.match(/<svg/g)?.length).toBe(1)
      expect(html.match(/external-link"/g)?.length).toBe(1)
    })
    it('transforms nested alerts', () => {
      const html = r('> [!NOTE]\n> a\n>\n> > [!TIP]\n> > b', { githubAlerts: true })
      expect(html.match(/class="markdown-alert /g)?.length).toBe(2)
      expect(html).not.toContain('[!TIP]')
    })
  })
})

describe('math', () => {
  const rm = (md: string, o: Record<string, unknown> = {}, p: Record<string, unknown> = {}) =>
    renderToHtml(parseMarkdown(md, p as any), { plugins: defaultRenderPlugins(), ...o } as any).html

  it('renders inline math with katex', () => {
    expect(rm('$a^2$')).toContain('class="katex"')
  })
  it('renders display math', () => {
    expect(rm('$$\n\\int x\n$$')).toContain('katex-display')
  })
  it('math:false leaves literal text', () => {
    const html = rm('$a^2$', { math: false }, { math: false })
    expect(html).toContain('$a^2$')
    expect(html).not.toContain('katex')
  })
  it('guards inline $ per Pandoc rules', () => {
    const t = rm('costs $5 and $10 total')
    expect(t).not.toContain('katex')
    expect(t).toContain('costs $5 and $10 total')
    expect(rm('$a^2$')).toContain('katex')
    expect(rm('x $a$.')).toContain('katex')
    expect(rm('$ a$')).not.toContain('katex')
    expect(rm('$a$5')).not.toContain('katex')
    expect(rm('$a$5')).toContain('$a$5')
    expect(rm('$$x$$ inline')).toContain('katex')
  })
  it('does not emit script tags', () => {
    expect(rm('$<script>alert(1)</script>$')).not.toContain('<script')
  })
  it('does not emit javascript: hrefs', () => {
    expect(rm('$\\href{javascript:alert(1)}{x}$')).not.toMatch(/href="?javascript:/i)
  })
})

describe('injected plugins (8h1)', () => {
  it('uses injected highlight plugin', () => {
    const fake = () => (tree: any) => {
      const walk = (n: any) => {
        if (n.tagName === 'code') n.properties = { ...(n.properties ?? {}), className: ['language-data-fake'] }
        for (const c of n.children ?? []) walk(c)
      }
      walk(tree)
    }
    const html = renderToHtml(parseMarkdown('```js\nvar a = 1\n```'), { plugins: { highlight: fake as any } }).html
    expect(html).toContain('data-fake')
    expect(html).not.toContain('hljs')
  })
  it('uses injected math plugin', () => {
    const fake = () => () => {}
    const html = renderToHtml(parseMarkdown('$x^2$'), { plugins: { math: fake as any } }).html
    expect(html).not.toContain('katex')
  })
  it('uses injected parseYaml', () => {
    expect(parseMarkdown('---\na: 1\n---\nx', { parseYaml: () => ({ injected: true }) }).frontmatter).toEqual({ injected: true })
  })
})
