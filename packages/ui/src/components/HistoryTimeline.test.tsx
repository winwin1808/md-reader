import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { HistoryEntry } from '@md-reader/core'
import { HistoryTimeline, historyLabel } from './HistoryTimeline'

const snap = new Uint8Array([1])
const entries: HistoryEntry[] = [
  { id: 'a', actor: 'An', ts: 1000, label: 'import', clientIds: [1], snapshot: snap },
  { id: 'b', actor: 'An', ts: 3000, label: 'save', clientIds: [1, 2], snapshot: snap },
  { id: 'c', actor: 'An', ts: 2000, label: 'auto', clientIds: [1], snapshot: snap },
]
function setup(over: Record<string, unknown> = {}) {
  const props = {
    entries, actors: { '1': 'An', '2': 'Bình' }, previewId: null, previewText: null,
    onPreview: vi.fn(), onRestore: vi.fn(), onClose: vi.fn(), ...over,
  }
  const r = render(<HistoryTimeline {...(props as any)} />)
  return { ...r, props }
}
const opts = (c: HTMLElement) => Array.from(c.querySelectorAll('[role="option"]')) as HTMLElement[]
const btn = (el: HTMLElement, t: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent === t) as HTMLButtonElement

describe('HistoryTimeline', () => {
  it('renders newest first with translated labels', () => {
    const { container } = setup()
    const o = opts(container)
    expect(o).toHaveLength(3)
    expect(o[0]!.textContent).toContain('Đã lưu')
    expect(o[1]!.textContent).toContain('Tự động lưu mốc')
    expect(o[2]!.textContent).toContain('Nhập')
    expect(entries[0]!.id).toBe('a')
  })
  it('shows cùng Bình', () => {
    const { container } = setup()
    expect(opts(container)[0]!.textContent).toContain('cùng Bình')
    expect(opts(container)[1]!.textContent).not.toContain('cùng')
  })
  it('preview toggles', () => {
    const { container, props } = setup()
    fireEvent.click(btn(opts(container)[0]!, 'Xem'))
    expect(props.onPreview).toHaveBeenCalledWith('b')
    const r2 = setup({ previewId: 'b' })
    const row = opts(r2.container)[0]!
    fireEvent.click(btn(row, 'Thoát xem'))
    expect(r2.props.onPreview).toHaveBeenCalledWith(null)
  })
  it('restore needs confirm; Huỷ cancels', () => {
    const { container, props } = setup()
    fireEvent.click(btn(opts(container)[0]!, 'Khôi phục'))
    expect(container.textContent).toContain('Khôi phục về mốc này?')
    fireEvent.click(btn(opts(container)[0]!, 'Huỷ'))
    expect(props.onRestore).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('Khôi phục về mốc này?')
    fireEvent.click(btn(opts(container)[0]!, 'Khôi phục'))
    fireEvent.click(btn(opts(container)[0]!, 'Khôi phục'))
    expect(props.onRestore).toHaveBeenCalledWith('b')
  })
  it('disables without snapshot', () => {
    const { container } = setup({ entries: [{ ...entries[0], snapshot: undefined }] })
    const row = opts(container)[0]!
    expect(btn(row, 'Xem').disabled).toBe(true)
    expect(btn(row, 'Khôi phục').disabled).toBe(true)
    expect(btn(row, 'Xem').title).toBe('Mốc này không có ảnh chụp')
  })
  it('keyboard', () => {
    const { container, props } = setup()
    const list = container.querySelector('[role="listbox"]') as HTMLElement
    opts(container)[0]!.focus()
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(opts(container)[1])
    fireEvent.keyDown(list, { key: 'Enter' })
    expect(props.onPreview).toHaveBeenCalledWith('c')
    fireEvent.keyDown(list, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
    const r2 = setup({ previewId: 'c' })
    fireEvent.keyDown(r2.container.querySelector('[role="listbox"]')!, { key: 'Escape' })
    expect(r2.props.onPreview).toHaveBeenCalledWith(null)
    expect(r2.props.onClose).not.toHaveBeenCalled()
  })
  it('empty state and close', () => {
    const { container, props } = setup({ entries: [] })
    expect(container.textContent).toContain('Chưa có mốc nào.')
    fireEvent.click(container.querySelector('[aria-label="Đóng lịch sử"]')!)
    expect(props.onClose).toHaveBeenCalled()
  })
  it('historyLabel', () => {
    expect(historyLabel('save')).toBe('Đã lưu')
    expect(historyLabel('auto')).toBe('Tự động lưu mốc')
    expect(historyLabel('import')).toBe('Nhập')
    expect(historyLabel('x')).toBe('x')
  })
  it('(d) Escape trên nút đóng gọi onClose', () => {
    const { container, props } = setup()
    fireEvent.keyDown(container.querySelector('[aria-label="Đóng lịch sử"]')!, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
  it('(e) ArrowDown từ nút Xem của hàng đầu focus hàng thứ hai', () => {
    const { container } = setup()
    const b = btn(opts(container)[0]!, 'Xem')
    b.focus()
    fireEvent.keyDown(b, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(opts(container)[1])
  })
  it('(f) historyLabel Khôi phục', () => {
    expect(historyLabel('Khôi phục: save')).toBe('Khôi phục: Đã lưu')
  })
  it('trả focus về nút đã mở khi đóng', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = setup()
    expect(document.activeElement).not.toBe(opener)
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
  it('phân trang 50 mục, Xem thêm nạp thêm 50', () => {
    const many: HistoryEntry[] = Array.from({ length: 120 }, (_, i) => ({
      id: 'e' + i, actor: 'An', ts: i, label: 'save', clientIds: [1], snapshot: snap,
    }))
    const { container, getByText } = setup({ entries: many })
    expect(opts(container)).toHaveLength(50)
    fireEvent.click(getByText('Xem thêm'))
    expect(opts(container)).toHaveLength(100)
    fireEvent.click(getByText('Xem thêm'))
    expect(opts(container)).toHaveLength(120)
  })
})
