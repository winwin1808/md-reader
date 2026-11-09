import { describe, it, expect, beforeAll } from 'vitest'
import { splitIntoSlides, SLIDE_BREAK_MARKER, slideBreakInsertion } from './index.js'
import { renderToHtml } from '../render/index.js'
import { parseMarkdown } from '../parse/index.js'
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

describe('slide-break marker', () => {
  const M = '<!-- slide-break -->'
  it('breaks within hr strategy', () => {
    const s = splitIntoSlides(`# A\n\none\n${M}\ntwo\n\n---\n\n# B`)
    expect(s).toHaveLength(3)
    expect(s[1]!.rawMarkdown).toBe('two')
  })
  it('breaks within heading strategy and keeps heading strategy', () => {
    const s = splitIntoSlides(`# A\n\none\n${M}\ntwo\n\n## B\n\nthree`)
    expect(s).toHaveLength(3)
    expect(s.map((x) => x.rawMarkdown)).toEqual(['# A\n\none', 'two', '## B\n\nthree'])
  })
  it('breaks in fallback', () => {
    const s = splitIntoSlides(`para one\n${M}\npara two`)
    expect(s.map((x) => x.rawMarkdown)).toEqual(['para one', 'para two'])
  })
  it('ignores marker in code fence', () => {
    const s = splitIntoSlides('```\n' + M + '\n```\n\ntext')
    expect(s).toHaveLength(1)
    const t = splitIntoSlides('~~~\n' + M + '\n~~~')
    expect(t).toHaveLength(1)
  })
  it('accepts case and spacing variants', () => {
    const s = splitIntoSlides('a\n  <!--SLIDE-BREAK-->  \nb\n<!--   slide-break   -->\nc')
    expect(s).toHaveLength(3)
  })
  it('indent 0-3 spaces breaks; 4 spaces or tab does not', () => {
    for (const ind of ['', ' ', '  ', '   ']) {
      expect(splitIntoSlides(`a\n${ind}${M}\nb`)).toHaveLength(2)
    }
    expect(splitIntoSlides(`a\n    ${M}\nb`)).toHaveLength(1)
    expect(splitIntoSlides(`a\n\t${M}\nb`)).toHaveLength(1)
  })
  it('no empty slides for leading/trailing markers', () => {
    const s = splitIntoSlides(`${M}\na\n${M}\nb\n${M}`)
    expect(s.map((x) => x.rawMarkdown)).toEqual(['a', 'b'])
  })
  it('marker-only doc returns at least one slide', () => {
    const s = splitIntoSlides(M)
    expect(s[0]!.html).toBe('')
    expect(s.length).toBeGreaterThanOrEqual(1)
  })
  it('html never contains slide-break', () => {
    const s = splitIntoSlides(`# A\n${M}\nb\n---\nc`)
    expect(s).toHaveLength(3)
    for (const x of s) expect(x.html).not.toContain('slide-break')
  })
  it('notes follow their part', () => {
    const s = splitIntoSlides(`a <!-- note: n1 -->\n${M}\nb <!-- note: n2 -->`)
    expect(s[0]!.notes).toEqual(['n1'])
    expect(s[1]!.notes).toEqual(['n2'])
  })
})

describe('slide-break marker is not visible when reading', () => {
  const md = `# A\n\n${SLIDE_BREAK_MARKER}\n\n# B`
  for (const allowRawHtml of [false, true]) {
    it(`renderToHtml omits marker (allowRawHtml=${allowRawHtml})`, () => {
      const { html } = renderToHtml(parseMarkdown(md), { plugins: defaultRenderPlugins(), allowRawHtml })
      expect(html).not.toContain('slide-break')
    })
  }
})

describe('slideBreakInsertion', () => {
  const M = SLIDE_BREAK_MARKER
  function run(text: string, cursor: number) {
    const r = slideBreakInsertion(text, cursor)
    const out = text.slice(0, r.at) + r.insert + text.slice(r.at)
    return { r, out }
  }
  function expectOneMore(text: string, out: string) {
    for (const o of [undefined, { strategy: 'fallback' as never }]) {
      expect(splitIntoSlides(out, o).length).toBe(splitIntoSlides(text, o).length + 1)
    }
    const words = (t: string) => t.replace(M, '').split(/\s+/).filter(Boolean)
    expect(words(out)).toEqual(words(text))
  }

  it('cursor mid second paragraph inserts before its first line', () => {
    const text = 'first\n\nsecond a\nsecond b\n'
    const { r, out } = run(text, text.indexOf('second b') + 3)
    expect(r.at).toBe(text.indexOf('second a'))
    expect(out).toBe(`first\n\n${M}\n\nsecond a\nsecond b\n`)
    expectOneMore(text, out)
  })

  it('cursor in ``` block inserts before the opening fence', () => {
    const text = 'intro\n\n```js\nconst a = 1\n\nb\n```\n\nend'
    const { r, out } = run(text, text.indexOf('const'))
    expect(r.at).toBe(text.indexOf('```js'))
    expect(out).toContain(`intro\n\n${M}\n\n\`\`\`js`)
    expectOneMore(text, out)
  })

  it('cursor in ~~~ block inserts before the opening fence', () => {
    const text = 'intro\n\n~~~\ncode\n~~~\n'
    const { r, out } = run(text, text.indexOf('code'))
    expect(r.at).toBe(text.indexOf('~~~'))
    expectOneMore(text, out)
  })

  it('longer fence is not closed by a shorter one', () => {
    const text = 'intro\n\n````md\n```\ninner\n```\n````\n\nend'
    const { r, out } = run(text, text.indexOf('inner'))
    expect(r.at).toBe(text.indexOf('````md'))
    expectOneMore(text, out)
  })

  it('cursor on blank line picks next block', () => {
    const text = 'one\n\ntwo\n'
    const { r, out } = run(text, 4)
    expect(r.at).toBe(text.indexOf('two'))
    expectOneMore(text, out)
  })

  it('cursor in first block returns empty insert', () => {
    const text = 'one\ntwo\n\nthree'
    expect(slideBreakInsertion(text, 5)).toEqual({ at: 0, insert: '' })
  })

  it('right after an existing break returns empty insert', () => {
    const text = `one\n\n${M}\n\ntwo`
    expect(slideBreakInsertion(text, text.indexOf('two')).insert).toBe('')
    const t2 = 'one\n\n   <!--slide-break-->\n\ntwo'
    expect(slideBreakInsertion(t2, t2.indexOf('two')).insert).toBe('')
  })

  it('cursor on trailing blank line inserts nothing', () => {
    const text = 'one\n\ntwo\n\n'
    expect(slideBreakInsertion(text, text.length).insert).toBe('')
  })

  it('cursor in block right after a break returns empty insert', () => {
    const text = `one\n\n${M}\ntwo\n`
    expect(slideBreakInsertion(text, text.indexOf('two')).insert).toBe('')
  })

  it('cursor on the break line returns empty insert', () => {
    const text = `one\n\n${M}\n\ntwo\n`
    expect(slideBreakInsertion(text, text.indexOf(M) + 3).insert).toBe('')
  })

  it('inserts between a heading and its list; default strategy gives 3 slides', () => {
    const text = '## A\n\npara\n\n## B\n- x\n- y\n'
    const { r, out } = run(text, text.indexOf('- y'))
    expect(r.at).toBe(text.indexOf('- x'))
    expect(splitIntoSlides(text).length).toBe(2)
    expect(splitIntoSlides(out).length).toBe(3)
    expectOneMore(text, out)
  })

  it('inserts after a heading directly followed by text', () => {
    const text = '# T\ntext'
    const { r, out } = run(text, text.indexOf('text'))
    expect(r.at).toBe(text.indexOf('text'))
    expectOneMore(text, out)
  })

  it('stops at a horizontal rule above', () => {
    const text = 'a\n\n***\nb\nc\n'
    const { r, out } = run(text, text.indexOf('c'))
    expect(r.at).toBe(text.indexOf('b'))
    expectOneMore(text, out)
  })

  it('inner ```js line closes the fence exactly like the splitter', () => {
    const text = 'intro\n\n```\nfoo\n```js\nbar\n\nend'
    const { r, out } = run(text, text.indexOf('bar'))
    expect(r.at).toBe(text.indexOf('bar'))
    expectOneMore(text, out)
    const t2 = 'intro\n\n```\nfoo\n```js\nbar'
    const r2 = run(t2, t2.indexOf('foo'))
    expect(r2.r.at).toBe(t2.indexOf('```\nfoo'))
    expectOneMore(t2, r2.out)
  })

  it('block after a closing fence still gets a blank line before the marker', () => {
    const text = 'a\n\n```\nx\n```\nafter\n'
    const { r, out } = run(text, text.indexOf('after'))
    expect(r.at).toBe(text.indexOf('after'))
    expect(out).toContain(`\`\`\`\n\n${M}\n\nafter`)
    expectOneMore(text, out)
  })
})
