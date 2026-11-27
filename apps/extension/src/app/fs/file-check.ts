/** Shared checks for files opened from disk (picker or drag & drop). */
import type { TFunction } from '@md-reader/ui'

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'] as const

/** Files larger than this are refused before reading — a Markdown note this big is almost certainly a wrong pick. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024

export type FileProblem = 'extension' | 'tooLarge' | 'binary' | 'encoding'

export class FileFormatError extends Error {
  constructor(readonly problem: FileProblem) {
    super(`unsupported file: ${problem}`)
    this.name = 'FileFormatError'
  }
}

export function hasMarkdownExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Problems detectable before reading the bytes. */
export function checkFileMeta(file: { name: string; size: number }): FileProblem | null {
  if (!hasMarkdownExtension(file.name)) return 'extension'
  if (file.size > MAX_FILE_BYTES) return 'tooLarge'
  return null
}

/**
 * Problems detectable from the decoded text (`File.text()` / `readAsText` decode as UTF-8 and
 * turn invalid bytes into U+FFFD). NUL never appears in a text file; a handful of U+FFFD means
 * the file is binary or in a legacy encoding — a lone one may be a legit character, so allow it.
 */
export function checkFileText(text: string): FileProblem | null {
  if (text.includes('\u0000')) return 'binary'
  let bad = 0
  for (let i = text.indexOf('\uFFFD'); i !== -1; i = text.indexOf('\uFFFD', i + 1)) bad++
  if (bad >= 4 && bad >= text.length * 0.001) return 'encoding'
  return null
}

/** User-facing message for a refused file. */
export function fileProblemMessage(problem: FileProblem, t: TFunction): string {
  if (problem === 'extension') return t('ext.drop.unsupported')
  const reason =
    problem === 'tooLarge'
      ? t('ext.file.tooLarge', { max: MAX_FILE_BYTES / (1024 * 1024) })
      : problem === 'binary'
        ? t('ext.file.binary')
        : t('ext.file.encoding')
  return t('ext.drop.openFailed', { reason })
}
