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
  describe('reply box + keyboard', () => {
    const setupActive = (threads: CommentThread[], activeId = 'a') => {
      const props = { threads, me: { clientIds: [1], canModerate: false, canResolveAll: false }, activeId, onSelect: vi.fn(), onReply: vi.fn(), onResolve: vi.fn(), onDelete: vi.fn(), onClose: vi.fn(), now: () => NOW }
      const r = render(<CommentsPanel {...props} />)
      return { ...r, props }
    }
    const ta = (c: HTMLElement) => c.querySelector('textarea') as HTMLTextAreaElement
    const type = (el: HTMLTextAreaElement, v: string) => fireEvent.change(el, { target: { value: v } })

    it('reply box only on active thread', () => {
      const { container } = setupActive([th({ id: 'a' }), th({ id: 'b' })])
      expect(container.querySelectorAll('textarea')).toHaveLength(1)
      expect(container.querySelector('[data-id="a"] textarea')).toBeTruthy()
      expect(ta(container).getAttribute('aria-label')).toBe('Trả lời')
      expect(ta(container).maxLength).toBe(4000)
    })
    it('Enter sends and clears', () => {
      const { container, props } = setupActive([th({ id: 'a' })])
      type(ta(container), 'xin chào')
      fireEvent.keyDown(ta(container), { key: 'Enter' })
      expect(props.onReply).toHaveBeenCalledWith('a', 'xin chào')
      expect(ta(container).value).toBe('')
    })
    it('Send button sends', () => {
      const { container, props } = setupActive([th({ id: 'a' })])
      type(ta(container), 'hi')
      fireEvent.click(btn(container, 'Gửi')[0]!)
      expect(props.onReply).toHaveBeenCalledWith('a', 'hi')
    })
    it('Shift+Enter does not send', () => {
      const { container, props } = setupActive([th({ id: 'a' })])
      type(ta(container), 'x')
      fireEvent.keyDown(ta(container), { key: 'Enter', shiftKey: true })
      expect(props.onReply).not.toHaveBeenCalled()
      expect(ta(container).value).toBe('x')
    })
    it('whitespace-only does not send', () => {
      const { container, props } = setupActive([th({ id: 'a' })])
      type(ta(container), '   \n ')
      fireEvent.keyDown(ta(container), { key: 'Enter' })
      expect(props.onReply).not.toHaveBeenCalled()
    })
    it('composing does not send', () => {
      const { container, props } = setupActive([th({ id: 'a' })])
      type(ta(container), 'x')
      fireEvent.keyDown(ta(container), { key: 'Enter', isComposing: true })
      expect(props.onReply).not.toHaveBeenCalled()
    })
    it('deleted root still replyable', () => {
      const { container, props } = setupActive([th({ id: 'a', deleted: true })])
      type(ta(container), 'r')
      fireEvent.keyDown(ta(container), { key: 'Enter' })
      expect(props.onReply).toHaveBeenCalledWith('a', 'r')
    })
    it('arrow keys move selection incl. orphans', () => {
      const { container, props } = setupActive([th({ id: 'a' }), th({ id: 'b' }), th({ id: 'o', range: null })], 'b')
      const body = container.querySelector('.comments-panel__body') as HTMLElement
      expect(body.tabIndex).toBe(0)
      fireEvent.keyDown(body, { key: 'ArrowDown' })
      expect(props.onSelect).toHaveBeenLastCalledWith('o')
      fireEvent.keyDown(body, { key: 'ArrowUp' })
      expect(props.onSelect).toHaveBeenLastCalledWith('a')
    })
    it('arrows inside textarea do not move selection', () => {
      const { container, props } = setupActive([th({ id: 'a' }), th({ id: 'b' })])
      fireEvent.keyDown(ta(container), { key: 'ArrowDown' })
      expect(props.onSelect).not.toHaveBeenCalled()
    })
    it('Esc closes; with text only clears', () => {
      const { container, props } = setupActive([th({ id: 'a' })])
      type(ta(container), 'abc')
      fireEvent.keyDown(ta(container), { key: 'Escape' })
      expect(props.onClose).not.toHaveBeenCalled()
      expect(ta(container).value).toBe('')
      fireEvent.keyDown(ta(container), { key: 'Escape' })
      expect(props.onClose).toHaveBeenCalledTimes(1)
      fireEvent.keyDown(container.querySelector('.comments-panel__body')!, { key: 'Escape' })
      expect(props.onClose).toHaveBeenCalledTimes(2)
    })
  })
})
