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

  return sections.map((rawSection, index) => {
    const rawMarkdown = rawSection.trim()
    const { notes, cleanMarkdown } = extractNotes(rawMarkdown)
    const parsed = parseMarkdown(cleanMarkdown)
    const html = cleanMarkdown.trim() ? renderToHtml(parsed).html : ''
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
