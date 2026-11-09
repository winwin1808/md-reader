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

export const SLIDE_BREAK_MARKER = '<!-- slide-break -->'

export function isSlideBreakLine(line: string): boolean {
  return /^ {0,3}<!--\s*slide-break\s*-->\s*$/i.test(line)
}

export function slideBreakInsertion(text: string, cursor: number): { at: number; insert: string } {
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
    const m = lines[i]!.match(/^ {0,3}(`{3,}|~{3,})/)
    if (!m || !m[1]) continue
    const ch = m[1][0]!
    const len = m[1].length
    let end = -1
    for (let j = i + 1; j < lines.length; j++) {
      const c = lines[j]!.match(/^ {0,3}(`{3,}|~{3,})\s*$/)
      if (c && c[1] && c[1][0] === ch && c[1].length >= len) {
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
    if (n >= lines.length) {
      at = text.length
    } else {
      anchor = n
      at = -1
    }
  } else {
    at = -1
  }

  if (at === -1) {
    let i = anchor
    while (i > 0 && !blank(i - 1) && !closing.has(i - 1)) i--
    at = starts[i]!
    if (at === 0) return { at: 0, insert: '' }
  } else if (at === 0) {
    return { at: 0, insert: '' }
  }

  // nearest non-blank line above `at`
  let prev = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (starts[i]! < at && !blank(i)) {
      prev = i
      break
    }
  }
  if (prev !== -1 && isSlideBreakLine(lines[prev]!)) return { at, insert: '' }

  let prefix = ''
  if (at > 0) {
    if (text[at - 1] !== '\n') prefix = '\n\n'
    else {
      const before = text.slice(0, at - 1).split('\n')
      const last = before[before.length - 1]!
      prefix = last.trim() === '' ? '' : '\n'
    }
  }
  const suffix = at < text.length ? '\n\n' : '\n'
  return { at, insert: prefix + SLIDE_BREAK_MARKER + suffix }
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

export function splitIntoSlides(source: string, options?: SlideSplitOptions): Slide[] {
  if (!source || source.trim() === '') {
    return [
      {
        id: 'slide-0',
        index: 0,
        rawMarkdown: '',
        html: '',
        notes: [],
      },
    ]
  }

  const content = stripFrontmatter(source)
  if (!content || content.trim() === '') {
    return [
      {
        id: 'slide-0',
        index: 0,
        rawMarkdown: '',
        html: '',
        notes: [],
      },
    ]
  }

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
