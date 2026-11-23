import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { CommentThread } from '@md-reader/core'
import { CommentsPanel } from './CommentsPanel'

const NOW = 10_000_000
const th = (o: Partial<CommentThread>): CommentThread => ({
  id: 'a', author: 'An', clientId: 1, ts: NOW, body: 'hi', quote: 'q',
  range: { from: 0, to: 1 }, resolved: false, resolvedBy: null, deleted: false, replies: [], ...o,
})
const rep = (o = {}) => ({ id: 'r1', author: 'Bình', clientId: 2, ts: NOW - 5 * 60000, body: 'rep', ...o })
function setup(threads: CommentThread[], me = { clientIds: [1], canModerate: false, canResolveAll: false }) {
  const props = { threads, me, activeId: null, onSelect: vi.fn(), onReply: vi.fn(), onResolve: vi.fn(), onDelete: vi.fn(), onClose: vi.fn(), now: () => NOW }
  const r = render(<CommentsPanel {...props} />)
  return { ...r, props }
}
const btn = (el: HTMLElement, t: string) => Array.from(el.querySelectorAll('button')).filter((b) => b.textContent === t)
const tab = (c: HTMLElement, s: string) => Array.from(c.querySelectorAll('[role="tab"]')).find((b) => b.textContent!.includes(s)) as HTMLElement

describe('CommentsPanel', () => {
  it('filters open/resolved with counts', () => {
    const { container } = setup([th({ id: 'a' }), th({ id: 'b', resolved: true }), th({ id: 'c', resolved: true })])
    expect(tab(container, 'Đang mở (1)')).toBeTruthy()
    expect(container.querySelectorAll('.comment-thread')).toHaveLength(1)
    fireEvent.click(tab(container, 'Đã xong (2)'))
    expect(Array.from(container.querySelectorAll('.comment-thread')).map((e) => e.getAttribute('data-id'))).toEqual(['b', 'c'])
  })
  it('shows resolve/delete by permissions', () => {
    const t = [th({ id: 'a', clientId: 5, replies: [rep()] })]
    const a = setup(t)
    expect(btn(a.container, 'Xong')).toHaveLength(0)
    expect(btn(a.container, 'Xoá')).toHaveLength(0)
    a.unmount()
    const b = setup(t, { clientIds: [2], canModerate: false, canResolveAll: false })
    expect(btn(b.container, 'Xong')).toHaveLength(0)
    expect(btn(b.container, 'Xoá')).toHaveLength(1)
    b.unmount()
    const c = setup(t, { clientIds: [], canModerate: true, canResolveAll: true })
    expect(btn(c.container, 'Xong')).toHaveLength(1)
    expect(btn(c.container, 'Xoá')).toHaveLength(2)
  })
  it('resolve/reopen/select/delete callbacks', () => {
    const a = setup([th({ id: 'a' })])
    fireEvent.click(btn(a.container, 'Xong')[0]!)
    expect(a.props.onResolve).toHaveBeenCalledWith('a', true)
    expect(a.props.onSelect).not.toHaveBeenCalled()
    fireEvent.click(btn(a.container, 'Xoá')[0]!)
    expect(a.props.onDelete).toHaveBeenCalledWith('a')
    fireEvent.click(a.container.querySelector('.comment-thread')!)
    expect(a.props.onSelect).toHaveBeenCalledWith('a')
    a.unmount()
    const b = setup([th({ id: 'b', resolved: true })])
    fireEvent.click(tab(b.container, 'Đã xong'))
    fireEvent.click(btn(b.container, 'Mở lại')[0]!)
    expect(b.props.onResolve).toHaveBeenCalledWith('b', false)
  })
  it('renders body as plain text', () => {
    const { container } = setup([th({ body: '<img src=x onerror=alert(1)>' })])
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(container.querySelector('img')).toBeNull()
  })
  it('puts orphans in their group', () => {
    const { container } = setup([th({ id: 'a' }), th({ id: 'o', range: null })])
    const g = container.querySelector('.comments-orphans')!
    expect(g.textContent).toContain('Đoạn chữ đã bị xoá')
    expect(g.querySelector('[data-id="o"]')).toBeTruthy()
    expect(g.querySelector('[data-id="a"]')).toBeNull()
  })
  it('deleted root shows notice, keeps replies, no root delete', () => {
    const { container } = setup([th({ deleted: true, replies: [rep()] })], { clientIds: [1], canModerate: true, canResolveAll: true })
    expect(container.textContent).toContain('đã xoá')
    expect(container.textContent).toContain('rep')
    expect(container.querySelector('.comment-thread__quote')).toBeNull()
    expect(btn(container, 'Xoá')).toHaveLength(1)
  })
  it('shows empty prompt', () => {
    const { container } = setup([])
    expect(container.textContent).toContain('Chọn một đoạn chữ rồi bấm Bình luận')
  })
  it('relative times', () => {
    const { container } = setup([th({ ts: NOW - 30000, replies: [rep(), rep({ id: 'r2', ts: NOW - 3 * 3600000 })] })])
    const x = container.textContent!
    expect(x).toContain('vừa xong')
    expect(x).toContain('5 phút trước')
    expect(x).toContain('3 giờ trước')
  })
})
