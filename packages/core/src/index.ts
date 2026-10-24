export const CORE_VERSION = '0.1.0'

export { parseMarkdown } from './parse/index.js'
export type { ParseOptions, ParseResult } from './parse/index.js'
export { sanitizeSchema } from './parse/index.js'

export { extractToc, renderToHtml, HEADING_ID_PREFIX } from './render/index.js'
export { HIGHLIGHT_LANGUAGES } from './render/languages.js'
export type { TocEntry, RenderOptions, RenderResult } from './render/index.js'
export { processFrontmatter } from './render/index.js'
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
  ensureDoc,
} from './doc/doc.js'
export * from './doc/apply.js'
export { appendHistory, listHistory, sourceClientIds } from './doc/history.js'

export { defaultFormatOptions, formatMarkdown } from './format/index.js'
export type { FormatOptions } from './format/index.js'

export { exportToHtml, mdastToDocx } from './export/index.js'
export type { ExportHtmlOptions, ExportDocxOptions } from './export/index.js'

export { splitIntoSlides } from './slides/index.js'
export type { Slide, SlideSplitOptions } from './slides/index.js'

export { extractMindmap } from './mindmap/mindmap.js'
export type { MindNode } from './mindmap/mindmap.js'

export { computeLineDiff, detectConflict } from './diff/diff.js'
export type { DiffLine } from './diff/diff.js'

export { createCheckpointTracker, registerActor, trackLocalActor } from './doc/checkpoint.js'
export type { CheckpointTracker } from './doc/checkpoint.js'

export * from './share/index.js'
export { computeBlame } from './doc/blame.js'
export type { BlameRange } from './doc/blame.js'
