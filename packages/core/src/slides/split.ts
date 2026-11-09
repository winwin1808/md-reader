import { parseMarkdown } from '../parse/index.js'
import { renderToHtml } from '../render/index.js'
import type { Slide, SlideSplitOptions } from './types.js'

function parseCodeFence(line: string): { isFence: boolean; char?: string; length?: number } {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/)
  if (!match || !match[1]) return { isFence: false }
  return {
    isFence: true,
    char: match[1][0]!,
    length: match[1].length,
  }
}

function closesFence(line: string, char: string, length: number): boolean {
  const f = parseCodeFence(line)
  return f.isFence && f.char === char && f.length! >= length
}

export const SLIDE_BREAK_MARKER = '<!-- slide-break -->'

export function isSlideBreakLine(line: string): boolean {
  return /^ {0,3}<!--\s*slide-break\s*-->\s*$/i.test(line)
}

function slideBreakCandidate(text: string, cursor: number): { at: number; insert: string } {
  const pos = Math.min(Math.max(cursor, 0), text.length)
  const lines = text.split('\n')
  const starts: number[] = []
  let off = 0
  for (const l of lines) {
    starts.push(off)
    off += l.length + 1
  }
  const blank = (i: number) => lines[i]!.trim() === ''

  // fence regions: [openIdx, closeIdx]; closeIdx = last line when unclosed
  const regions: Array<{ open: number; end: number; closed: boolean }> = []
  const closing = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const open = parseCodeFence(lines[i]!)
    if (!open.isFence) continue
    const ch = open.char!
    const len = open.length!
    let end = -1
    for (let j = i + 1; j < lines.length; j++) {
      if (closesFence(lines[j]!, ch, len)) {
        end = j
        break
      }
    }
    if (end === -1) {
      regions.push({ open: i, end: lines.length - 1, closed: false })
      break
    }
    regions.push({ open: i, end, closed: true })
    closing.add(end)
    i = end
  }

  let anchor = 0
  for (let i = 0; i < lines.length; i++) if (starts[i]! <= pos) anchor = i
  const region = regions.find((r) => anchor >= r.open && anchor <= r.end)
  let at: number
  if (region) {
    anchor = region.open
    at = -1
  } else if (blank(anchor)) {
    let n = anchor + 1
    while (n < lines.length && blank(n)) n++
    if (n >= lines.length) return { at: text.length, insert: '' }
    anchor = n
    at = -1
  } else {
    at = -1
  }

  if (!region && isSlideBreakLine(lines[anchor]!)) return { at: starts[anchor]!, insert: '' }

  const HR = /^ {0,3}([-*_])( *\1){2,} *$/
  const ATX = /^ {0,3}#{1,6}(\s|$)/
  let i = anchor
  while (i > 0) {
    const above = lines[i - 1]!
    if (blank(i - 1) || closing.has(i - 1) || isSlideBreakLine(above) || HR.test(above) || ATX.test(above)) break
    i--
  }
  at = starts[i]!
  if (at === 0) return { at: 0, insert: '' }

  // nearest non-blank line above `at`
  let prev = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (starts[i]! < at && !blank(i)) {
      prev = i
      break
    }
  }
  if (prev === -1) return { at, insert: '' }
  if (isSlideBreakLine(lines[prev]!)) return { at, insert: '' }

  let prefix = ''
  if (at > 0) {
    if (text[at - 1] !== '\n') prefix = '\n\n'
    else {
      const before = text.slice(0, at - 1).split('\n')
      const last = before[before.length - 1]!
      prefix = last.trim() === '' ? '' : '\n'
    }
  }
  return { at, insert: prefix + SLIDE_BREAK_MARKER + '\n\n' }
}

function frontmatterEnd(text: string): number {
  const lines = text.split('\n')
  if (lines.length < 2 || !/^\s*---\s*$/.test(lines[0]!)) return -1
  for (let i = 1; i < lines.length; i++) {
    if (/^\s*---\s*$/.test(lines[i]!)) {
      const inner = lines.slice(1, i)
      if (inner.some((l) => /^ {0,3}#{1,6}\s/.test(l))) return -1
      let end = 0
      for (let k = 0; k <= i; k++) end += lines[k]!.length + 1
      return end - 1
    }
  }
  return -1
}

export function slideBreakInsertion(text: string, cursor: number): { at: number; insert: string } {
  const r = slideBreakCandidate(text, cursor)
  if (r.insert === '') return r
  const pos = Math.min(Math.max(cursor, 0), text.length)
  const fmEnd = frontmatterEnd(text)
  if (fmEnd >= 0 && pos <= fmEnd) return { at: r.at, insert: '' }
  const before = splitSections(text).length
  const after = splitSections(text.slice(0, r.at) + r.insert + text.slice(r.at)).length
  if (after !== before + 1) return { at: r.at, insert: '' }
  return r
}

function splitAtBreakMarkers(section: string): string[] {
  const lines = section.split(/\r?\n/)
  const parts: string[] = []
  let current: string[] = []
  let inCodeBlock = false
  let fenceChar = ''
  let fenceLength = 0
  let found = false

  for (const line of lines) {
    const fence = parseCodeFence(line)
    const wasInCode = inCodeBlock
    if (!inCodeBlock && fence.isFence) {
      inCodeBlock = true
      fenceChar = fence.char!
      fenceLength = fence.length!
    } else if (inCodeBlock && fence.isFence && fence.char === fenceChar && fence.length! >= fenceLength) {
      inCodeBlock = false
      fenceChar = ''
      fenceLength = 0
    }
    if (!wasInCode && !fence.isFence && isSlideBreakLine(line)) {
      found = true
      parts.push(current.join('\n'))
      current = []
    } else {
      current.push(line)
    }
  }
  if (!found) return [section]
  parts.push(current.join('\n'))
  return parts.filter((p) => p.trim() !== '')
}

function stripFrontmatter(source: string): string {
  const lines = source.split(/\r?\n/)
  if (lines.length >= 2 && /^\s*---\s*$/.test(lines[0]!)) {
    let closingIndex = -1
    for (let i = 1; i < lines.length; i++) {
      if (/^\s*---\s*$/.test(lines[i]!)) {
        closingIndex = i
        break
      }
    }
    if (closingIndex !== -1) {
      const innerLines = lines.slice(1, closingIndex)
      const hasHeading = innerLines.some((l) => /^ {0,3}#{1,6}\s/.test(l))
      if (!hasHeading) {
        return lines.slice(closingIndex + 1).join('\n')
      }
    }
  }
  return source
}

function hasHr(lines: string[]): boolean {
  let inCodeBlock = false
  let fenceChar = ''
  let fenceLength = 0

  for (const line of lines) {
    const fence = parseCodeFence(line)
    if (!inCodeBlock && fence.isFence) {
      inCodeBlock = true
      fenceChar = fence.char!
      fenceLength = fence.length!
      continue
    } else if (inCodeBlock && fence.isFence && fence.char === fenceChar && fence.length! >= fenceLength) {
      inCodeBlock = false
      fenceChar = ''
      fenceLength = 0
      continue
    }

    if (!inCodeBlock && /^\s*---\s*$/.test(line)) {
      return true
    }
  }
  return false
}

function hasMatchingHeading(lines: string[], headingDepth: number): boolean {
  let inCodeBlock = false
  let fenceChar = ''
  let fenceLength = 0

  for (const line of lines) {
    const fence = parseCodeFence(line)
    if (!inCodeBlock && fence.isFence) {
      inCodeBlock = true
      fenceChar = fence.char!
      fenceLength = fence.length!
      continue
    } else if (inCodeBlock && fence.isFence && fence.char === fenceChar && fence.length! >= fenceLength) {
      inCodeBlock = false
      fenceChar = ''
      fenceLength = 0
      continue
    }

    if (!inCodeBlock) {
      const match = line.match(/^ {0,3}(#{1,6})\s+/)
      if (match && match[1] && match[1].length <= headingDepth) {
        return true
      }
    }
  }
  return false
}

function extractNotes(markdown: string): { notes: string[]; cleanMarkdown: string } {
  const lines = markdown.split(/\r?\n/)
  const chunks: Array<{ type: 'code' | 'text'; lines: string[] }> = []
  let currentChunk: { type: 'code' | 'text'; lines: string[] } = { type: 'text', lines: [] }

  let inCodeBlock = false
  let fenceChar = ''
  let fenceLength = 0

  for (const line of lines) {
    const fence = parseCodeFence(line)

    if (!inCodeBlock && fence.isFence) {
      if (currentChunk.lines.length > 0) {
        chunks.push(currentChunk)
      }
      currentChunk = { type: 'code', lines: [line] }
      inCodeBlock = true
      fenceChar = fence.char!
      fenceLength = fence.length!
    } else if (inCodeBlock && fence.isFence && fence.char === fenceChar && fence.length! >= fenceLength) {
      currentChunk.lines.push(line)
      chunks.push(currentChunk)
      currentChunk = { type: 'text', lines: [] }
      inCodeBlock = false
      fenceChar = ''
      fenceLength = 0
    } else {
      currentChunk.lines.push(line)
    }
  }

  if (currentChunk.lines.length > 0) {
    chunks.push(currentChunk)
  }

  const notes: string[] = []
  const NOTE_REGEX = /<!--\s*(?:note|speaker):?\s*([\s\S]*?)-->/gi

  const cleanChunks = chunks.map((chunk) => {
    if (chunk.type === 'code') {
      return chunk.lines.join('\n')
    }
    const text = chunk.lines.join('\n')
    let match: RegExpExecArray | null
    NOTE_REGEX.lastIndex = 0
    while ((match = NOTE_REGEX.exec(text)) !== null) {
      if (match[1] !== undefined) {
        notes.push(match[1].trim())
      }
    }
    return text.replace(NOTE_REGEX, '')
  })

  return {
    notes,
    cleanMarkdown: cleanChunks.join('\n'),
  }
}

function extractTitle(markdown: string): string | undefined {
  const lines = markdown.split(/\r?\n/)
  let inCodeBlock = false
  let fenceChar = ''
  let fenceLength = 0

  for (const line of lines) {
    const fence = parseCodeFence(line)
    if (!inCodeBlock && fence.isFence) {
      inCodeBlock = true
      fenceChar = fence.char!
      fenceLength = fence.length!
      continue
    } else if (inCodeBlock && fence.isFence && fence.char === fenceChar && fence.length! >= fenceLength) {
      inCodeBlock = false
      fenceChar = ''
      fenceLength = 0
      continue
    }

    if (!inCodeBlock) {
      const match = line.match(/^ {0,3}#{1,6}\s+(.+)$/)
      if (match && match[1]) {
        return match[1]
          .replace(/<!--\s*(?:note|speaker):?\s*[\s\S]*?-->/gi, '')
          .replace(/\s+#+\s*$/, '')
          .trim()
      }
    }
  }

  return undefined
}

function splitSections(source: string, options?: SlideSplitOptions): string[] {
  if (!source || source.trim() === '') return ['']

  const content = stripFrontmatter(source)
  if (!content || content.trim() === '') return ['']

  const strategy = options?.strategy ?? 'auto'
  const headingDepth = options?.headingDepth ?? 2
  const lines = content.split(/\r?\n/)

  let effectiveStrategy: 'hr' | 'heading' | 'fallback'
  if (strategy === 'hr') {
    effectiveStrategy = hasHr(lines) ? 'hr' : 'fallback'
  } else if (strategy === 'heading') {
    effectiveStrategy = hasMatchingHeading(lines, headingDepth) ? 'heading' : 'fallback'
  } else {
    // auto
    if (hasHr(lines)) {
      effectiveStrategy = 'hr'
    } else if (hasMatchingHeading(lines, headingDepth)) {
      effectiveStrategy = 'heading'
    } else {
      effectiveStrategy = 'fallback'
    }
  }

  let sections: string[] = []

  if (effectiveStrategy === 'hr') {
    let currentSectionLines: string[] = []
    let inCodeBlock = false
    let fenceChar = ''
    let fenceLength = 0

    for (const line of lines) {
      const fence = parseCodeFence(line)
      const wasInCode = inCodeBlock

      if (!inCodeBlock && fence.isFence) {
        inCodeBlock = true
        fenceChar = fence.char!
        fenceLength = fence.length!
      } else if (inCodeBlock && fence.isFence && fence.char === fenceChar && fence.length! >= fenceLength) {
        inCodeBlock = false
        fenceChar = ''
        fenceLength = 0
      }

      if (!wasInCode && !fence.isFence && /^\s*---\s*$/.test(line)) {
        sections.push(currentSectionLines.join('\n'))
        currentSectionLines = []
      } else {
        currentSectionLines.push(line)
      }
    }
    sections.push(currentSectionLines.join('\n'))

    while (sections.length > 1 && sections[0] !== undefined && sections[0].trim() === '') {
      sections.shift()
    }
    while (sections.length > 1 && sections[sections.length - 1] !== undefined && sections[sections.length - 1]!.trim() === '') {
      sections.pop()
    }
  } else if (effectiveStrategy === 'heading') {
    let currentSectionLines: string[] = []
    let inCodeBlock = false
    let fenceChar = ''
    let fenceLength = 0

    for (const line of lines) {
      const fence = parseCodeFence(line)
      const wasInCode = inCodeBlock

      if (!inCodeBlock && fence.isFence) {
        inCodeBlock = true
        fenceChar = fence.char!
        fenceLength = fence.length!
      } else if (inCodeBlock && fence.isFence && fence.char === fenceChar && fence.length! >= fenceLength) {
        inCodeBlock = false
        fenceChar = ''
        fenceLength = 0
      }

      const headingMatch = !wasInCode && !fence.isFence ? line.match(/^ {0,3}(#{1,6})\s+/) : null
      const isSplitHeading = headingMatch && headingMatch[1] && headingMatch[1].length <= headingDepth

      if (isSplitHeading) {
        if (currentSectionLines.join('\n').trim() !== '') {
          sections.push(currentSectionLines.join('\n'))
          currentSectionLines = []
        } else {
          currentSectionLines = []
        }
      }
      currentSectionLines.push(line)
    }
    if (currentSectionLines.join('\n').trim() !== '' || sections.length === 0) {
      sections.push(currentSectionLines.join('\n'))
    }
  } else {
    // fallback
    sections = [content]
  }

  while (sections.length > 1 && sections[0] !== undefined && sections[0].trim() === '') {
    sections.shift()
  }
  while (sections.length > 1 && sections[sections.length - 1] !== undefined && sections[sections.length - 1]!.trim() === '') {
    sections.pop()
  }

  sections = sections.flatMap(splitAtBreakMarkers)
  if (sections.length === 0) sections = ['']
  return sections
}

export function splitIntoSlides(source: string, options?: SlideSplitOptions): Slide[] {
  const sections = splitSections(source, options)
  return sections.map((rawSection, index) => {
    const rawMarkdown = rawSection.trim()
    const { notes, cleanMarkdown } = extractNotes(rawMarkdown)
    const math = options?.math !== false
    const parsed = parseMarkdown(cleanMarkdown, { math })
    const html = cleanMarkdown.trim() ? renderToHtml(parsed, { ...options?.render, math }).html : ''
    const title = extractTitle(cleanMarkdown)

    const slide: Slide = {
      id: `slide-${index}`,
      index,
      rawMarkdown,
      html,
      notes,
    }

    if (title !== undefined) {
      slide.title = title
    }

    return slide
  })
}
