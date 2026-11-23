import type { DocStyle } from '@md-reader/core'

const SANS = `'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`
const SERIF = `'Literata', Georgia, serif`
const ACCENT = 'var(--accent, #23568C)'
const RULE = 'var(--rule, #CCD3D0)'
const MUTED = 'var(--muted, #5B6663)'
const HI = 'var(--hi, #EEF2F0)'
const INK = 'var(--ink, #1B2422)'

/** CSS cho một kiểu tài liệu; mọi selector bắt đầu bằng `:is(root)`. 'lesach' → ''. */
export function docStyleCss(style: DocStyle, root: string): string {
  if (style === 'lesach') return ''
  const r = `:is(${root})`
  const font = style === 'academic' ? SERIF : SANS
  const lh = style === 'business' ? '1.55' : style === 'academic' ? '1.7' : '1.5'
  const base = `
${r} {
  --font-body: ${font};
  --body-lh: ${lh};
  font-family: ${font};
  line-height: ${lh};
}
`
  if (style === 'business') {
    return `${base}
${r} h1, ${r} h2, ${r} h3 { font-family: ${SANS}; font-weight: 600; color: ${ACCENT}; }
${r} h1 { padding-bottom: 0.25em; border-bottom: 1px solid ${RULE}; }
${r} th { background: ${HI}; font-weight: 700; border-bottom: 2px solid ${RULE}; }
${r} blockquote { background: ${HI}; font-style: normal; border-left: 3px solid ${RULE}; padding: 0.6em 1em; }
`
  }
  if (style === 'academic') {
    return `${base}
${r} { counter-reset: ds-h2 ds-h3; hyphens: auto; }
${r} p { text-align: justify; hyphens: auto; }
${r} h1 { text-align: center; font-family: ${SERIF}; color: ${INK}; }
${r} h2 { counter-increment: ds-h2; counter-reset: ds-h3; font-family: ${SERIF}; }
${r} h2::before { content: counter(ds-h2) '. '; }
${r} h3 { counter-increment: ds-h3; font-family: ${SERIF}; }
${r} h3::before { content: counter(ds-h2) '.' counter(ds-h3) ' '; }
${r} blockquote { font-style: italic; margin-left: 2em; margin-right: 2em; }
${r} figcaption, ${r} caption { font-size: 0.85em; color: ${MUTED}; }
`
  }
  return `${base}
${r} { counter-reset: ds-h2; }
${r} h1, ${r} h2, ${r} h3 { font-family: ${SANS}; font-weight: 600; }
${r} h2 { counter-increment: ds-h2; border-left: 3px solid ${ACCENT}; padding-left: 0.5em; }
${r} h2::before { content: counter(ds-h2) '. '; }
${r} pre { border: 1px solid ${RULE}; }
${r} :not(pre) > code { background: ${HI}; }
${r} table { font-size: 0.92em; }
${r} th, ${r} td { padding: 0.25em 0.55em; }
`
}
