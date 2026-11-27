import { describe, it, expect } from 'vitest'
import { createT } from '@md-reader/ui'
import { checkFileMeta, checkFileText, fileProblemMessage, hasMarkdownExtension, MAX_FILE_BYTES } from './file-check'

describe('file-check', () => {
  it('accepts Markdown and .txt extensions regardless of case', () => {
    for (const n of ['a.md', 'B.MD', 'c.Markdown', 'd.mdown', 'e.MKD', 'f.mdx', 'g.txt']) expect(hasMarkdownExtension(n)).toBe(true)
    for (const n of ['a.pdf', 'a.md.png', 'md', 'a.docx', 'README']) expect(hasMarkdownExtension(n)).toBe(false)
  })

  it('checkFileMeta flags extension first, then size', () => {
    expect(checkFileMeta({ name: 'a.png', size: 1 })).toBe('extension')
    expect(checkFileMeta({ name: 'a.md', size: MAX_FILE_BYTES + 1 })).toBe('tooLarge')
    expect(checkFileMeta({ name: 'a.md', size: MAX_FILE_BYTES })).toBeNull()
  })

  it('checkFileText: NUL means binary', () => {
    expect(checkFileText('# hi\u0000')).toBe('binary')
  })

  it('checkFileText: many replacement chars mean wrong encoding, a lone one is allowed', () => {
    expect(checkFileText('Ti�ng Vi�t c� d�u')).toBe('encoding')
    expect(checkFileText('Một ký tự lạ � trong văn bản dài.')).toBeNull()
    expect(checkFileText('a'.repeat(100_000) + '�'.repeat(5))).toBeNull()
  })

  it('checkFileText accepts normal Markdown', () => {
    expect(checkFileText('# Tiêu đề\n\n- mục một\n- 中文 😀\n')).toBeNull()
    expect(checkFileText('')).toBeNull()
  })

  it('fileProblemMessage gives a readable message for every problem', () => {
    const t = createT('vi')
    expect(fileProblemMessage('extension', t)).toBe(t('ext.drop.unsupported'))
    expect(fileProblemMessage('tooLarge', t)).toBe('Không mở được tệp: tệp lớn hơn 20 MB')
    expect(fileProblemMessage('binary', t)).toContain('không phải tệp văn bản')
    expect(fileProblemMessage('encoding', t)).toContain('UTF-8')
  })
})
