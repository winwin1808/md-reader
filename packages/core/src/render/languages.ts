export const HIGHLIGHT_LANGUAGES = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'bash',
  'css',
  'html',
  'md',
  'yaml',
  'python',
  'go',
  'sql',
  'diff'
] as const

export type HighlightLanguage = (typeof HIGHLIGHT_LANGUAGES)[number]
