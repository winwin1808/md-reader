import { describe, it, expect, beforeAll } from 'vitest'
import { splitIntoSlides } from './index.js'
import { defaultRenderPlugins, loadMathPlugin } from '../plugins/index.js'
beforeAll(() => loadMathPlugin())

describe('splitIntoSlides', () => {
  it('returns a single empty slide for empty source', () => {
    const slides = splitIntoSlides('')
    expect(slides).toHaveLength(1)
    expect(slides[0]).toEqual({
      id: 'slide-0',
      index: 0,
      rawMarkdown: '',
      html: '',
      notes: [],
    })
  })

  it('splits on horizontal rules (---)', () => {
    const md = `# Slide 1\n\nContent 1\n\n---\n\n# Slide 2\n\nContent 2`
    const slides = splitIntoSlides(md, { strategy: 'hr' })
    expect(slides).toHaveLength(2)
    expect(slides[0]!.id).toBe('slide-0')
    expect(slides[0]!.index).toBe(0)
    expect(slides[0]!.title).toBe('Slide 1')
    expect(slides[0]!.rawMarkdown).toBe('# Slide 1\n\nContent 1')
    expect(slides[0]!.html).toContain('Slide 1')
    expect(slides[1]!.id).toBe('slide-1')
    expect(slides[1]!.index).toBe(1)
    expect(slides[1]!.title).toBe('Slide 2')
    expect(slides[1]!.rawMarkdown).toBe('# Slide 2\n\nContent 2')
    expect(slides[1]!.html).toContain('Slide 2')
  })

  it('splits on headings with depth <= headingDepth', () => {
    const md = `# Slide 1\n\nIntro\n\n## Slide 2\n\nDetails\n\n### Subheading\n\nMore details\n\n# Slide 3\n\nConclusion`
    const slides = splitIntoSlides(md, { strategy: 'heading', headingDepth: 2 })
    expect(slides).toHaveLength(3)
    expect(slides[0]!.title).toBe('Slide 1')
    expect(slides[1]!.title).toBe('Slide 2')
    expect(slides[1]!.html).toContain('Subheading')
    expect(slides[2]!.title).toBe('Slide 3')
  })

  it('respects custom headingDepth', () => {
    const md = `# Slide 1\n\n## Not a new slide\n\n# Slide 2`
    const slides = splitIntoSlides(md, { strategy: 'heading', headingDepth: 1 })
    expect(slides).toHaveLength(2)
    expect(slides[0]!.title).toBe('Slide 1')
    expect(slides[0]!.rawMarkdown).toContain('## Not a new slide')
    expect(slides[1]!.title).toBe('Slide 2')
  })

  it('auto strategy detects hr when present', () => {
    const md = `# Title\n\nSlide 1\n\n---\n\n## Slide 2\n\nSlide 2 body`
    const slides = splitIntoSlides(md) // default auto
    expect(slides).toHaveLength(2)
    expect(slides[0]!.title).toBe('Title')
    expect(slides[1]!.title).toBe('Slide 2')
  })

  it('auto strategy ignores hr inside fenced code blocks', () => {
    const md = '# Code Slide\n\n```yaml\n---\nkey: value\n---\n```\n\n## Slide 2\n\nEnd'
    const slides = splitIntoSlides(md) // should split on headings because hr is inside code block
    expect(slides).toHaveLength(2)
    expect(slides[0]!.title).toBe('Code Slide')
    expect(slides[0]!.rawMarkdown).toContain('```yaml\n---\nkey: value\n---\n```')
    expect(slides[1]!.title).toBe('Slide 2')
  })

  it('falls back to single slide when neither hr nor matching heading is present', () => {
    const md = `Just a plain paragraph without any headings or hr.`
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(1)
    expect(slides[0]!.id).toBe('slide-0')
    expect(slides[0]!.index).toBe(0)
    expect(slides[0]!.rawMarkdown).toBe(md)
    expect(slides[0]!.title).toBeUndefined()
  })

  it('extracts speaker notes and strips them from html', () => {
    const md = `# Slide With Notes\n\nSome slide content.\n\n<!-- note: Remember to speak slowly! -->\n\nMore content.\n<!-- speaker: Check elapsed time -->`
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(1)
    expect(slides[0]!.notes).toEqual(['Remember to speak slowly!', 'Check elapsed time'])
    expect(slides[0]!.html).toContain('Some slide content.')
    expect(slides[0]!.html).toContain('More content.')
    expect(slides[0]!.html).not.toContain('Remember to speak slowly!')
    expect(slides[0]!.html).not.toContain('Check elapsed time')
    expect(slides[0]!.html).not.toContain('note:')
    expect(slides[0]!.html).not.toContain('speaker:')
  })

  it('extracts multiline and case-insensitive speaker notes', () => {
    const md = `# Slide\n\n<!-- NOTE:\nLine 1 of note\nLine 2 of note\n-->\n\n<!-- Speaker:\nAnother note\n-->`
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(1)
    expect(slides[0]!.notes).toEqual(['Line 1 of note\nLine 2 of note', 'Another note'])
    expect(slides[0]!.html).not.toContain('Line 1 of note')
    expect(slides[0]!.html).not.toContain('Another note')
  })

  it('handles leading and trailing hr delimiters cleanly', () => {
    const md = `---\n# Slide 1\n---\n# Slide 2\n---`
    const slides = splitIntoSlides(md, { strategy: 'hr' })
    expect(slides).toHaveLength(2)
    expect(slides[0]!.title).toBe('Slide 1')
    expect(slides[1]!.title).toBe('Slide 2')
  })

  it('does not leak speaker note from heading into slide.title', () => {
    const md = '# Intro <!-- note: secret note -->\n\nSlide content'
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(1)
    expect(slides[0]!.title).toBe('Intro')
    expect(slides[0]!.notes).toEqual(['secret note'])
  })

  it('ignores YAML frontmatter and does not treat it as HR split or slide', () => {
    const md = `---\ntitle: Doc\n---\n# Slide 1\nBody 1\n# Slide 2\nBody 2`
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(2)
    expect(slides[0]!.title).toBe('Slide 1')
    expect(slides[0]!.rawMarkdown).toBe('# Slide 1\nBody 1')
    expect(slides[1]!.title).toBe('Slide 2')
    expect(slides[1]!.rawMarkdown).toBe('# Slide 2\nBody 2')
  })

  it('preserves speaker note comments inside fenced code blocks', () => {
    const md = '# Code Slide\n\n```html\n<!-- note: inside code block -->\n```\n\n~~~markdown\n<!-- note: inside tildes -->\n~~~\n\n<!-- note: actual note -->'
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(1)
    expect(slides[0]!.notes).toEqual(['actual note'])
    expect(slides[0]!.html).toContain('inside code block')
    expect(slides[0]!.html).toContain('inside tildes')
    expect(slides[0]!.html).not.toContain('actual note')
    expect(slides[0]!.rawMarkdown).toContain('<!-- note: inside code block -->')
    expect(slides[0]!.rawMarkdown).toContain('<!-- note: inside tildes -->')
  })

  it('does not produce empty boundary slides when multiple hr delimiters exist at start or end', () => {
    const md = `---\n---\n# Slide 1\nBody 1\n---\n# Slide 2\nBody 2\n---\n---`
    const slides = splitIntoSlides(md, { strategy: 'hr' })
    expect(slides).toHaveLength(2)
    expect(slides[0]!.title).toBe('Slide 1')
    expect(slides[1]!.title).toBe('Slide 2')

    const mdLeading = `---\n---\n# Slide 1`
    const slidesLeading = splitIntoSlides(mdLeading)
    expect(slidesLeading).toHaveLength(1)
    expect(slidesLeading[0]!.title).toBe('Slide 1')
  })

  it('is exported from core index', async () => {
    const core = await import('../index.js')
    expect(core.splitIntoSlides).toBe(splitIntoSlides)
  })
})

describe('splitIntoSlides math option', () => {
  it('math:false keeps $a^2$ literal', () => {
    const s = splitIntoSlides('# T\n\n$a^2$', { math: false })
    expect(s[0]!.html).toContain('$a^2$')
    expect(s[0]!.html).not.toContain('katex')
  })
  it('renders katex by default', () => {
    const s = splitIntoSlides('# T\n\n$a^2$', { render: { plugins: defaultRenderPlugins() } })
    expect(s[0]!.html).toContain('katex')
  })
})

describe('splitIntoSlides render options', () => {
  it('renders github alerts when githubAlerts passed', () => {
    const [s] = splitIntoSlides('> [!NOTE]\n> x', { render: { githubAlerts: true } })
    expect(s!.html).toContain('markdown-alert')
  })
})
