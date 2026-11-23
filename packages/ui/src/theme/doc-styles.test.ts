import { describe, it, expect } from 'vitest'
import { docStyleCss } from './doc-styles'
import { getDefaultExportCss } from '../export/css'

function selectors(css: string): string[] {
  const out: string[] = []
  for (const chunk of css.split('}')) {
    const i = chunk.indexOf('{')
    if (i < 0) continue
    out.push(...chunk.slice(0, i).split(',').map((s) => s.trim()).filter(Boolean))
  }
  return out
}

describe('docStyleCss', () => {
  it('lesach returns empty string', () => {
    expect(docStyleCss('lesach', '.md-viewer')).toBe('')
  })
  for (const s of ['business', 'academic', 'technical'] as const) {
    it(`${s}: every selector starts with :is(root)`, () => {
      const sel = selectors(docStyleCss(s, '.md-viewer'))
      expect(sel.length).toBeGreaterThan(0)
      for (const x of sel) expect(x.startsWith(':is(.md-viewer)')).toBe(true)
    })
  }
  it('business has its own rules absent from default css', () => {
    const css = docStyleCss('business', '.md-viewer')
    expect(css).toContain('--body-lh: 1.55')
    expect(getDefaultExportCss()).not.toContain('--body-lh: 1.55')
  })
  for (const s of ['business', 'technical'] as const) {
    it(`${s}: h3 is not italic`, () => {
      expect(docStyleCss(s, '.md-viewer')).toMatch(/:is\(\.md-viewer\) h3[^{]*\{[^}]*font-style: normal/)
    })
  }
  it('academic keeps h3 italic implicitly (no normal override)', () => {
    expect(docStyleCss('academic', '.md-viewer')).not.toMatch(/h3[^{]*\{[^}]*font-style: normal/)
  })
  it('academic justifies and numbers headings', () => {
    const css = docStyleCss('academic', '.md-viewer')
    expect(css).toContain('text-align: justify')
    expect(css).toContain('counter-increment')
  })
  it('technical has a left bar', () => {
    expect(docStyleCss('technical', '.md-viewer')).toContain('border-left')
  })
  it('multi-root selectors are wrapped in :is()', () => {
    expect(docStyleCss('business', '.md-viewer, .editor-live-sheet')).toContain(
      ':is(.md-viewer, .editor-live-sheet)',
    )
  })
  it('export css follows style', () => {
    expect(getDefaultExportCss('academic')).toContain('text-align: justify')
    expect(getDefaultExportCss()).not.toContain('text-align: justify')
  })
})
