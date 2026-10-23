import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ConflictModal, computeSideBySideDiff } from './ConflictModal'

describe('ConflictModal', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    isOpen: true,
    fileName: 'test.md',
    localContent: 'line 1\nlocal line 2\nline 3',
    diskContent: 'line 1\ndisk line 2\nline 3',
    onKeepLocal: vi.fn(),
    onRevertToDisk: vi.fn(),
    onClose: vi.fn(),
  }

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ConflictModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders dialog labelled by title with a pencil hint line', () => {
    render(<ConflictModal {...defaultProps} />)
    const dlg = screen.getByRole('dialog')
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    const id = dlg.getAttribute('aria-labelledby')!
    expect(document.getElementById(id)?.textContent).toBe('Tài liệu đã đổi ở hai nơi')
    expect(screen.getByText(/Bản trên đĩa khác với lần bạn mở/)).toBeDefined()
    expect(screen.getByText(/test\.md/)).toBeDefined()
  })

  it('two h3 headings without base, three with base', () => {
    const { unmount } = render(<ConflictModal {...defaultProps} />)
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Bản trên đĩa', 'Bản của bạn'])
    unmount()
    render(<ConflictModal {...defaultProps} baseContent={'a\nb\nc'} />)
    const hs = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(hs).toEqual(['Bản trên đĩa', 'Bản của bạn', 'Bản gốc chung'])
    expect(screen.getAllByRole('region').length).toBe(3)
  })

  it('shows markers + and − for changed lines', () => {
    const { container } = render(<ConflictModal {...defaultProps} localContent="" diskContent="disk only" />)
    expect(container.querySelector('.conflict-diff-line.removed .conflict-diff-marker')?.textContent).toBe('\u2212')
    const r = render(<ConflictModal {...defaultProps} />)
    expect(r.container.querySelector('.conflict-diff-line.added .conflict-diff-marker')?.textContent).toBe('+')
  })

  it('calls onKeepLocal from the primary button', () => {
    const onKeepLocal = vi.fn()
    render(<ConflictModal {...defaultProps} onKeepLocal={onKeepLocal} />)
    fireEvent.click(screen.getByRole('button', { name: 'Giữ bản của tôi và ghi đè' }))
    expect(onKeepLocal).toHaveBeenCalledTimes(1)
  })

  it('calls onRevertToDisk from the secondary button', () => {
    const onRevertToDisk = vi.fn()
    render(<ConflictModal {...defaultProps} onRevertToDisk={onRevertToDisk} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lấy bản trên đĩa' }))
    expect(onRevertToDisk).toHaveBeenCalledTimes(1)
  })

  it('"Để sau" and the close icon call onClose', () => {
    const onClose = vi.fn()
    render(<ConflictModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<ConflictModal {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not produce phantom empty lines when localContent or diskContent is empty', () => {
    const diff1 = computeSideBySideDiff('', 'line 1')
    expect(diff1.diskDiff).toEqual([{ num: null, text: '', type: 'empty' }])
    expect(diff1.localDiff).toEqual([{ num: 1, text: 'line 1', type: 'added' }])

    const diff2 = computeSideBySideDiff('line 1', '')
    expect(diff2.diskDiff).toEqual([{ num: 1, text: 'line 1', type: 'removed' }])
    expect(diff2.localDiff).toEqual([{ num: null, text: '', type: 'empty' }])

    const diff3 = computeSideBySideDiff('', '')
    expect(diff3.diskDiff).toEqual([])
    expect(diff3.localDiff).toEqual([])
  })

  it('renders correctly when localContent or diskContent is empty without phantom lines', () => {
    const { container } = render(<ConflictModal {...defaultProps} localContent="" diskContent="disk only" />)
    expect(container.querySelectorAll('.conflict-diff-line.empty').length).toBe(1)
    expect(container.querySelectorAll('.conflict-diff-line.removed').length).toBe(1)
    expect(container.querySelectorAll('.conflict-diff-line.added').length).toBe(0)
  })

  it('three-way: counts carry an aria-label', () => {
    const { container } = render(
      <ConflictModal {...defaultProps} baseContent={'a\nb\nc'} diskContent={'a\nB\nc'} localContent={'a\nb\nc\nd'} />
    )
    const counts = Array.from(container.querySelectorAll('.conflict-diff-counts'))
    expect(counts.map((c) => c.textContent)).toEqual(['+1 \u22121', '+1 \u22120'])
    expect(counts.map((c) => c.getAttribute('aria-label'))).toEqual(['1 dòng thêm, 1 dòng bỏ', '1 dòng thêm, 0 dòng bỏ'])
    const diskPane = container.querySelectorAll('.conflict-pane')[0]
    const added = Array.from(diskPane!.querySelectorAll('.conflict-diff-line.added')).map((l) => l.textContent)
    expect(added.some((t) => t?.includes('B'))).toBe(true)
  })

  it('conflict.css has no hex or rgb literals', () => {
    const css = readFileSync(resolve(__dirname, '../theme/conflict.css'), 'utf8')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/rgba?\(/)
  })
})
