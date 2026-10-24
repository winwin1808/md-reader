import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { FormattingToolbar } from './FormattingToolbar'
import { applyFormat, handleListContinuation } from './markdown-commands'

afterEach(cleanup)

describe('FormattingToolbar component', () => {
  it('renders formatting buttons and triggers onAction when clicked', () => {
    const onAction = vi.fn()
    render(<FormattingToolbar onAction={onAction} />)

    const boldBtn = screen.getByRole('button', { name: /^Đậm/ })
    fireEvent.click(boldBtn)
    expect(onAction).toHaveBeenCalledWith('bold')

    const italicBtn = screen.getByRole('button', { name: /^Nghiêng/ })
    fireEvent.click(italicBtn)
    expect(onAction).toHaveBeenCalledWith('italic')

    const h1Btn = screen.getByRole('button', { name: /^Tiêu đề 1/ })
    fireEvent.click(h1Btn)
    expect(onAction).toHaveBeenCalledWith('h1')

    const bulletBtn = screen.getByRole('button', { name: 'Danh sách' })
    fireEvent.click(bulletBtn)
    expect(onAction).toHaveBeenCalledWith('bullet')

    const linkBtn = screen.getByRole('button', { name: /^Liên kết/ })
    fireEvent.click(linkBtn)
    expect(onAction).toHaveBeenCalledWith('link')

    const tableBtn = screen.getByRole('button', { name: 'Bảng' })
    fireEvent.click(tableBtn)
    expect(onAction).toHaveBeenCalledWith('table')
  })

  it('handles undo and redo callbacks and disabled states', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()

    const { rerender } = render(
      <FormattingToolbar
        onAction={vi.fn()}
        canUndo={false}
        canRedo={true}
        onUndo={onUndo}
        onRedo={onRedo}
      />
    )

    const undoBtn = screen.getByRole('button', { name: /^Hoàn tác/ })
    const redoBtn = screen.getByRole('button', { name: /^Làm lại/ })

    expect((undoBtn as HTMLButtonElement).disabled).toBe(true)
    expect((redoBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(undoBtn)
    expect(onUndo).not.toHaveBeenCalled()

    fireEvent.click(redoBtn)
    expect(onRedo).toHaveBeenCalledTimes(1)

    rerender(
      <FormattingToolbar
        onAction={vi.fn()}
        canUndo={true}
        canRedo={false}
        onUndo={onUndo}
        onRedo={onRedo}
      />
    )

    expect((undoBtn as HTMLButtonElement).disabled).toBe(false)
    expect((redoBtn as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(undoBtn)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })
})

const LABELS = [
  'Đậm (⌘B)', 'Nghiêng (⌘I)', 'Gạch ngang', 'Tiêu đề 1', 'Tiêu đề 2', 'Tiêu đề 3', 'Danh sách', 'Danh sách số',
  'Danh sách việc', 'Trích dẫn', 'Mã trong dòng', 'Khối mã', 'Công thức', 'Liên kết (⌘K)', 'Bảng',
  'Hoàn tác (⌘Z)', 'Làm lại (⇧⌘Z)',
]

describe('FormattingToolbar a11y (Vietnamese, roving)', () => {
  it('every button has a Vietnamese aria-label and title', () => {
    render(<FormattingToolbar onAction={vi.fn()} onUndo={vi.fn()} onRedo={vi.fn()} canUndo canRedo />)
    const btns = screen.getAllByRole('button')
    expect(btns.map((b) => b.getAttribute('aria-label')).sort()).toEqual([...LABELS].sort())
    btns.forEach((b) => expect(b.getAttribute('title')).toBe(b.getAttribute('aria-label')))
  })

  it('is a toolbar named Định dạng with roving tabindex and arrow keys', () => {
    render(<FormattingToolbar onAction={vi.fn()} />)
    const tb = screen.getByRole('toolbar', { name: 'Định dạng' })
    const btns = screen.getAllByRole('button') as HTMLElement[]
    const [b0, b1] = btns as [HTMLElement, HTMLElement]
    expect(btns.filter((b) => b.tabIndex === 0)).toHaveLength(1)
    expect(b0.tabIndex).toBe(0)
    b0.focus()
    fireEvent.keyDown(b0, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(b1)
    expect(b1.tabIndex).toBe(0)
    expect(b0.tabIndex).toBe(-1)
    fireEvent.keyDown(b1, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(b0)
    fireEvent.keyDown(b0, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(btns[btns.length - 1]!)
    expect(tb).toBeDefined()
  })
})

describe('editor surface CSS', () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '../theme', f), 'utf8')
  const literal = /#[0-9a-fA-F]{3,8}\b|rgba?\(/
  it('editor.css has focus inset box-shadow and no literals', () => {
    const css = read('editor.css')
    expect(css).toMatch(/\.cm-focused[^{]*\{[^}]*box-shadow:\s*inset 2px 0 0 var\(--accent\)/)
    expect(css).not.toMatch(literal)
  })
  it('toolbar and split-view css have no literals', () => {
    expect(read('formatting-toolbar.css')).not.toMatch(literal)
    expect(read('split-view.css')).not.toMatch(literal)
  })
})

describe('applyFormat', () => {
  it('applies bold formatting', () => {
    const res = applyFormat('hello world', 0, 5, 'bold')
    expect(res.newText).toBe('**hello** world')
    expect(res.newSelectionStart).toBe(2)
    expect(res.newSelectionEnd).toBe(7)
  })

  it('applies italic formatting', () => {
    const res = applyFormat('hello world', 6, 11, 'italic')
    expect(res.newText).toBe('hello *world*')
    expect(res.newSelectionStart).toBe(7)
    expect(res.newSelectionEnd).toBe(12)
  })

  it('applies strike formatting', () => {
    const res = applyFormat('text', 0, 4, 'strike')
    expect(res.newText).toBe('~~text~~')
  })

  it('applies code and codeblock formatting', () => {
    const inline = applyFormat('code', 0, 4, 'code')
    expect(inline.newText).toBe('`code`')

    const block = applyFormat('function foo() {}', 0, 17, 'codeblock')
    expect(block.newText).toBe('```\nfunction foo() {}\n```')
  })

  it('applies heading formatting at line start', () => {
    const resH1 = applyFormat('Title', 0, 0, 'h1')
    expect(resH1.newText).toBe('# Title')

    const resH2 = applyFormat('Line 1\nLine 2', 8, 8, 'h2')
    expect(resH2.newText).toBe('Line 1\n## Line 2')

    const resH3 = applyFormat('Heading', 0, 0, 'h3')
    expect(resH3.newText).toBe('### Heading')
  })

  it('applies list formatting at line start', () => {
    const bullet = applyFormat('item', 0, 0, 'bullet')
    expect(bullet.newText).toBe('- item')

    const number = applyFormat('item', 0, 0, 'number')
    expect(number.newText).toBe('1. item')

    const task = applyFormat('item', 0, 0, 'task')
    expect(task.newText).toBe('- [ ] item')

    const quote = applyFormat('quoted', 0, 0, 'quote')
    expect(quote.newText).toBe('> quoted')
  })

  it('applies math formatting', () => {
    const res = applyFormat('E=mc^2', 0, 6, 'math')
    expect(res.newText).toBe('$E=mc^2$')
  })

  it('applies link formatting', () => {
    const withSelection = applyFormat('click here', 0, 10, 'link')
    expect(withSelection.newText).toBe('[click here](url)')

    const withoutSelection = applyFormat('', 0, 0, 'link')
    expect(withoutSelection.newText).toBe('[text](url)')
  })

  it('inserts table template', () => {
    const res = applyFormat('', 0, 0, 'table')
    expect(res.newText).toContain('| Cột 1 | Cột 2 | Cột 3 |')
    expect(res.newText).toContain('| --- | --- | --- |')
    expect(res.newText).toContain('| Ô 1 | Ô 2 | Ô 3 |')
  })

  it('applies formatting at index 0 when text starts with newline', () => {
    const res = applyFormat('\nSecond line', 0, 0, 'bullet')
    expect(res.newText).toBe('- \nSecond line')
  })
})

describe('handleListContinuation', () => {
  it('continues bullet list on Enter with non-empty item', () => {
    const res = handleListContinuation('- First item', 12)
    expect(res.handled).toBe(true)
    expect(res.newText).toBe('- First item\n- ')
    expect(res.newCursorPos).toBe(res.newText.length)
  })

  it('continues numbered list on Enter with incremented number', () => {
    const res = handleListContinuation('1. First item', 13)
    expect(res.handled).toBe(true)
    expect(res.newText).toBe('1. First item\n2. ')
    expect(res.newCursorPos).toBe(res.newText.length)
  })

  it('continues task list on Enter with non-empty item', () => {
    const res = handleListContinuation('- [ ] First task', 16)
    expect(res.handled).toBe(true)
    expect(res.newText).toBe('- [ ] First task\n- [ ] ')
    expect(res.newCursorPos).toBe(res.newText.length)
  })

  it('exits bullet list on Enter when item is empty', () => {
    const res = handleListContinuation('- ', 2)
    expect(res.handled).toBe(true)
    expect(res.newText).toBe('')
    expect(res.newCursorPos).toBe(0)
  })

  it('exits numbered list on Enter when item is empty', () => {
    const res = handleListContinuation('1. ', 3)
    expect(res.handled).toBe(true)
    expect(res.newText).toBe('')
    expect(res.newCursorPos).toBe(0)
  })

  it('exits task list on Enter when item is empty', () => {
    const res = handleListContinuation('- [ ] ', 6)
    expect(res.handled).toBe(true)
    expect(res.newText).toBe('')
    expect(res.newCursorPos).toBe(0)
  })

  it('returns handled: false when not on a list item', () => {
    const res = handleListContinuation('Just plain text', 15)
    expect(res.handled).toBe(false)
    expect(res.newText).toBe('Just plain text')
    expect(res.newCursorPos).toBe(15)
  })

  it('does not treat decimal numbers like 1.1 as numbered list items', () => {
    const res = handleListContinuation('1.1 Note', 8)
    expect(res.handled).toBe(false)
    expect(res.newText).toBe('1.1 Note')
    expect(res.newCursorPos).toBe(8)
  })
})
