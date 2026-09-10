export const CORE_VERSION = '0.1.0'

export { parseMarkdown } from './parse/index.js'
export type { ParseOptions, ParseResult } from './parse/index.js'
export { sanitizeSchema } from './parse/index.js'

export { extractToc, renderToHtml } from './render/index.js'
export { HIGHLIGHT_LANGUAGES } from './render/languages.js'
export type { TocEntry, RenderOptions, RenderResult } from './render/index.js'
export type { HighlightLanguage } from './render/languages.js'
