import type { FormatAction } from './FormattingToolbar'
import { createT, type TFunction } from '../i18n'

export function applyFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  action: FormatAction,
  t: TFunction = createT('vi')
): { newText: string; newSelectionStart: number; newSelectionEnd: number } {
  const TABLE_TEMPLATE = t('format.tableTemplate')
  const before = text.slice(0, selectionStart)
  const selected = text.slice(selectionStart, selectionEnd)
  const after = text.slice(selectionEnd)

  switch (action) {
    case 'bold': {
      const wrapped = `**${selected}**`
      return {
        newText: `${before}${wrapped}${after}`,
        newSelectionStart: selectionStart + 2,
        newSelectionEnd: selectionEnd + 2,
      }
    }
    case 'italic': {
      const wrapped = `*${selected}*`
      return {
        newText: `${before}${wrapped}${after}`,
        newSelectionStart: selectionStart + 1,
        newSelectionEnd: selectionEnd + 1,
      }
    }
    case 'strike': {
      const wrapped = `~~${selected}~~`
      return {
        newText: `${before}${wrapped}${after}`,
        newSelectionStart: selectionStart + 2,
        newSelectionEnd: selectionEnd + 2,
      }
    }
    case 'code': {
      const wrapped = `\`${selected}\``
      return {
        newText: `${before}${wrapped}${after}`,
        newSelectionStart: selectionStart + 1,
        newSelectionEnd: selectionEnd + 1,
      }
    }
    case 'codeblock': {
      const wrapped = `\`\`\`\n${selected}\n\`\`\``
      return {
        newText: `${before}${wrapped}${after}`,
        newSelectionStart: selectionStart + 4,
        newSelectionEnd: selectionEnd + 4,
      }
    }
    case 'math': {
      const wrapped = `$${selected}$`
      return {
        newText: `${before}${wrapped}${after}`,
        newSelectionStart: selectionStart + 1,
        newSelectionEnd: selectionEnd + 1,
      }
    }
    case 'link': {
      const linkText = selected.length > 0 ? selected : 'text'
      const wrapped = `[${linkText}](url)`
      if (selected.length > 0) {
        const urlStart = selectionStart + selected.length + 3
        return {
          newText: `${before}${wrapped}${after}`,
          newSelectionStart: urlStart,
          newSelectionEnd: urlStart + 3,
        }
      }
      return {
        newText: `${before}${wrapped}${after}`,
        newSelectionStart: selectionStart + 1,
        newSelectionEnd: selectionStart + 5,
      }
    }
    case 'table': {
      return {
        newText: `${before}${TABLE_TEMPLATE}${after}`,
        newSelectionStart: selectionStart + TABLE_TEMPLATE.length,
        newSelectionEnd: selectionStart + TABLE_TEMPLATE.length,
      }
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'bullet':
    case 'number':
    case 'task':
    case 'quote': {
      const lineStart = selectionStart === 0 ? 0 : text.lastIndexOf('\n', selectionStart - 1) + 1
      const lineEndIndex = text.indexOf('\n', selectionStart)
      const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex
      const currentLine = text.slice(lineStart, lineEnd)

      let prefix = ''
      if (action === 'h1') prefix = '# '
      else if (action === 'h2') prefix = '## '
      else if (action === 'h3') prefix = '### '
      else if (action === 'bullet') prefix = '- '
      else if (action === 'number') prefix = '1. '
      else if (action === 'task') prefix = '- [ ] '
      else if (action === 'quote') prefix = '> '

      // If applying a heading, replace any existing heading prefix on the line
      if (action === 'h1' || action === 'h2' || action === 'h3') {
        const headingMatch = currentLine.match(/^(#{1,6}\s+)/)
        if (headingMatch) {
          const oldPrefixLen = headingMatch[1]!.length
          const lineRest = currentLine.slice(oldPrefixLen)
          const newText = text.slice(0, lineStart) + prefix + lineRest + text.slice(lineEnd)
          const diff = prefix.length - oldPrefixLen
          return {
            newText,
            newSelectionStart: Math.max(lineStart + prefix.length, selectionStart + diff),
            newSelectionEnd: Math.max(lineStart + prefix.length, selectionEnd + diff),
          }
        }
      }

      const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart)
      return {
        newText,
        newSelectionStart: selectionStart + prefix.length,
        newSelectionEnd: selectionEnd + prefix.length,
      }
    }
    default:
      return { newText: text, newSelectionStart: selectionStart, newSelectionEnd: selectionEnd }
  }
}

export function handleListContinuation(
  text: string,
  cursorPos: number
): { handled: boolean; newText: string; newCursorPos: number } {
  const lineStart = cursorPos === 0 ? 0 : text.lastIndexOf('\n', cursorPos - 1) + 1
  const lineEndIndex = text.indexOf('\n', cursorPos)
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex
  const currentLine = text.slice(lineStart, lineEnd)

  // 1. Task list item: e.g. "- [ ] item" or "- [x] item"
  const taskMatch = currentLine.match(/^(\s*[-*+]\s+\[[ xX]\]\s*)(.*)$/)
  if (taskMatch) {
    const prefix = taskMatch[1]!
    const content = taskMatch[2]!
    if (content.trim() === '') {
      // Empty list item: exit list by removing the prefix on this line
      const newText = text.slice(0, lineStart) + text.slice(lineEnd)
      return { handled: true, newText, newCursorPos: lineStart }
    }
    // Continue list with unchecked task
    const indentMatch = prefix.match(/^(\s*)/)
    const indent = indentMatch?.[1] ?? ''
    const continuation = `\n${indent}- [ ] `
    const newText = text.slice(0, cursorPos) + continuation + text.slice(cursorPos)
    return {
      handled: true,
      newText,
      newCursorPos: cursorPos + continuation.length,
    }
  }

  // 2. Numbered list item: e.g. "1. item"
  const emptyNumberMatch = currentLine.match(/^(\s*)(\d+)\.[ \t]*$/)
  if (emptyNumberMatch) {
    // Empty list item: exit list
    const newText = text.slice(0, lineStart) + text.slice(lineEnd)
    return { handled: true, newText, newCursorPos: lineStart }
  }

  const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/)
  if (numberMatch) {
    const indent = numberMatch[1]!
    const num = parseInt(numberMatch[2]!, 10)
    const content = numberMatch[3]!
    if (content.trim() === '') {
      // Empty list item: exit list
      const newText = text.slice(0, lineStart) + text.slice(lineEnd)
      return { handled: true, newText, newCursorPos: lineStart }
    }
    const continuation = `\n${indent}${num + 1}. `
    const newText = text.slice(0, cursorPos) + continuation + text.slice(cursorPos)
    return {
      handled: true,
      newText,
      newCursorPos: cursorPos + continuation.length,
    }
  }

  // 3. Bullet list item: e.g. "- item", "* item", "+ item"
  const bulletMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/)
  if (bulletMatch) {
    const prefix = bulletMatch[1]!
    const content = bulletMatch[2]!
    if (content.trim() === '') {
      // Empty list item: exit list
      const newText = text.slice(0, lineStart) + text.slice(lineEnd)
      return { handled: true, newText, newCursorPos: lineStart }
    }
    const continuation = `\n${prefix}`
    const newText = text.slice(0, cursorPos) + continuation + text.slice(cursorPos)
    return {
      handled: true,
      newText,
      newCursorPos: cursorPos + continuation.length,
    }
  }

  return { handled: false, newText: text, newCursorPos: cursorPos }
}
