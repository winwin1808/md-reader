export const CORE_VERSION = '0.1.0'

export { parseMarkdown } from './parse/index.js'
export type { ParseOptions, ParseResult } from './parse/index.js'
export { sanitizeSchema } from './parse/index.js'

export { extractToc, renderToHtml } from './render/index.js'
export { HIGHLIGHT_LANGUAGES } from './render/languages.js'
export type { TocEntry, RenderOptions, RenderResult } from './render/index.js'
export type { HighlightLanguage } from './render/languages.js'

export { FORMAT_VERSION, DOC_KEYS, UnsupportedFormatVersionError } from './doc/schema.js'
export type { DocMeta, HistoryEntry } from './doc/schema.js'
export { hashText } from './doc/hash.js'
export {
  createDoc,
  getSource,
  getMeta,
  getHistory,
  readMeta,
  importText,
  exportText,
  migrateDoc,
} from './doc/doc.js'
export { appendHistory, listHistory, sourceClientIds } from './doc/history.js'

export { defaultFormatOptions, formatMarkdown } from './format/index.js'
export type { FormatOptions } from './format/index.js'
