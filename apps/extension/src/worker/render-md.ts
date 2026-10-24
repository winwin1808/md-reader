import { parseMarkdown, renderToHtml } from '@md-reader/core'

export const MAX_RENDER_CHARS = 2_000_000

export interface PageRender {
  html: string
  title: string | null
}

export function renderMarkdownForPage(markdown: string): PageRender {
  const parsed = parseMarkdown(markdown, { gfm: true, math: true })
  const { html, toc } = renderToHtml(parsed, {
    highlight: false,
    math: false,
    allowRawHtml: false,
    githubAlerts: true,
    localizeAlerts: 'vi',
    externalLinks: true,
    typographer: true,
  })
  const h1 = toc.find((e) => e.depth === 1)
  return { html, title: h1 ? h1.text : null }
}
