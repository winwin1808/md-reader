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
      if (match && match[1]!.length <= headingDepth) {
        return true
      }
    }
  }
  return false
}

function extractNotes(markdown: string): { notes: string[]; cleanMarkdown: string } {
  const notes: string[] = []
  const NOTE_REGEX = /<!--\s*(?:note|speaker):?\s*([\s\S]*?)-->/gi
  let match: RegExpExecArray | null
  while ((match = NOTE_REGEX.exec(markdown)) !== null) {
    notes.push(match[1]!.trim())
  }
  const cleanMarkdown = markdown.replace(NOTE_REGEX, '')
  return { notes, cleanMarkdown }
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
      if (match) {
        return match[1]!.replace(/\s+#+\s*$/, '').trim()
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

  const strategy = options?.strategy ?? 'auto'
  const headingDepth = options?.headingDepth ?? 2
  const lines = source.split(/\r?\n/)

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

    if (sections.length > 1 && sections[0]!.trim() === '') {
      sections.shift()
    }
    if (sections.length > 1 && sections[sections.length - 1]!.trim() === '') {
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
      const isSplitHeading = headingMatch && headingMatch[1]!.length <= headingDepth

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
    sections = [source]
  }

  return sections.map((rawSection, index) => {
    const rawMarkdown = rawSection.trim()
    const { notes, cleanMarkdown } = extractNotes(rawMarkdown)
    const parsed = parseMarkdown(cleanMarkdown)
    const html = cleanMarkdown.trim() ? renderToHtml(parsed).html : ''
    const title = extractTitle(rawMarkdown)

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
