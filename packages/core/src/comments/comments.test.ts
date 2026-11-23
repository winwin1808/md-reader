import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  addComment,
  commentKeyClient,
  deleteComment,
  getComments,
  listThreads,
  replyComment,
  setResolved,
  validateCommentValue,
} from './comments.js'

function mk(text = 'hello brave new world'): Y.Doc {
  const d = new Y.Doc()
  d.getText('source').insert(0, text)
  return d
}

describe('comments', () => {
  it('thêm, trả lời, resolve, mở lại, xoá', () => {
    const d = mk()
    const id = addComment(d, { author: 'An', body: 'ý này?', from: 6, to: 11, now: 100 })
    expect(id).toMatch(/^c:\d+:[a-z0-9]{8}$/)
    const rid = replyComment(d, id, { author: 'Bo', body: 'ok', now: 200 })
    let t = listThreads(d)
    expect(t).toHaveLength(1)
    expect(t[0]!.quote).toBe('brave')
    expect(t[0]!.range).toEqual({ from: 6, to: 11 })
    expect(t[0]!.replies.map((r) => r.id)).toEqual([rid])
    expect(t[0]!.resolved).toBe(false)
    setResolved(d, id, true, 'An', 300)
    t = listThreads(d)
    expect(t[0]!.resolved).toBe(true)
    expect(t[0]!.resolvedBy).toBe('An')
    setResolved(d, id, false, 'An', 400)
    expect(listThreads(d)[0]!.resolved).toBe(false)
    deleteComment(d, rid)
    expect(listThreads(d)[0]!.replies).toHaveLength(0)
    deleteComment(d, id)
    expect(listThreads(d)).toHaveLength(0)
    expect(getComments(d).size).toBe(0)
    deleteComment(d, 'c:0:nope')
  })

  it('neo bám khi chèn/xoá chữ', () => {
    const d = mk()
    addComment(d, { author: 'A', body: 'x', from: 6, to: 11 })
    const src = d.getText('source')
    src.insert(0, 'XX') // trước
    expect(listThreads(d)[0]!.range).toEqual({ from: 8, to: 13 })
    src.insert(10, '--') // trong vùng
    expect(listThreads(d)[0]!.range).toEqual({ from: 8, to: 15 })
    src.insert(src.length, '!!') // sau
    expect(listThreads(d)[0]!.range).toEqual({ from: 8, to: 15 })
    src.delete(0, 3) // xoá trước
    expect(listThreads(d)[0]!.range).toEqual({ from: 5, to: 12 })
  })

  it('xoá hết vùng → range null', () => {
    const d = mk()
    addComment(d, { author: 'A', body: 'x', from: 6, to: 11 })
    d.getText('source').delete(5, 7)
    expect(listThreads(d)[0]!.range).toBeNull()
  })

  it('lỗi đầu vào', () => {
    const d = mk()
    expect(() => addComment(d, { author: 'A', body: 'x', from: 5, to: 5 })).toThrow(RangeError)
    expect(() => addComment(d, { author: 'A', body: 'x', from: -1, to: 3 })).toThrow('comment_range')
    expect(() => addComment(d, { author: 'A', body: 'x', from: 0, to: 999 })).toThrow('comment_range')
    expect(() => addComment(d, { author: 'A', body: '  ', from: 0, to: 3 })).toThrow('comment_empty')
    expect(() => replyComment(d, 'c:1:abcdefgh', { author: 'A', body: 'x' })).toThrow('comment_thread')
    const id = addComment(d, { author: 'A', body: 'x', from: 0, to: 3 })
    expect(() => replyComment(d, id, { author: 'A', body: '' })).toThrow('comment_empty')
    const rid = replyComment(d, id, { author: 'A', body: 'r' })
    expect(() => replyComment(d, rid, { author: 'A', body: 'r' })).toThrow('comment_thread')
    expect(() => setResolved(d, 'c:1:abcdefgh', true, 'A')).toThrow('comment_thread')
  })

  it('xoá gốc còn trả lời → deleted', () => {
    const d = mk()
    const id = addComment(d, { author: 'A', body: 'x', from: 0, to: 3, now: 10 })
    replyComment(d, id, { author: 'B', body: 'late', now: 50 })
    replyComment(d, id, { author: 'B', body: 'early', now: 20 })
    setResolved(d, id, true, 'A', 60)
    deleteComment(d, id)
    const t = listThreads(d)
    expect(t).toHaveLength(1)
    expect(t[0]!).toMatchObject({ id, deleted: true, body: '', author: '', quote: '', range: null, ts: 20, resolved: true })
    expect(t[0]!.replies.map((r) => r.body)).toEqual(['early', 'late'])
    for (const r of t[0]!.replies) deleteComment(d, r.id)
    expect(listThreads(d)).toHaveLength(0)
    expect(getComments(d).size).toBe(0)
  })

  it('hội tụ hai replica', () => {
    const a = mk('abcdefghij')
    const b = new Y.Doc()
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    const ia = addComment(a, { author: 'A', body: 'a', from: 0, to: 4, now: 1 })
    addComment(b, { author: 'B', body: 'b', from: 4, to: 8, now: 2 })
    const sync = () => {
      Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
      Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    }
    sync()
    setResolved(a, ia, true, 'A', 5)
    setResolved(b, ia, false, 'B', 6)
    sync()
    sync()
    expect(listThreads(a)).toHaveLength(2)
    expect(listThreads(a)).toEqual(listThreads(b))
  })

  it('bỏ qua mục rác', () => {
    const d = mk()
    getComments(d).set('c:1:zzzzzzzz', 42)
    getComments(d).set('c:1:yyyyyyyy', { v: 1 })
    addComment(d, { author: 'A', body: 'x', from: 0, to: 3 })
    expect(listThreads(d)).toHaveLength(1)
  })
})

describe('validateCommentValue', () => {
  const K = 'c:5:abcdefgh'
  const anchor = { start: 'AAEC', end: 'AAED', quote: 'q' }
  const root = (o: Record<string, unknown> = {}) => ({
    v: 1, thread: null, author: 'A', clientId: 5, ts: 1, body: 'x', anchor, ...o,
  })
  const reply = (o: Record<string, unknown> = {}) => ({
    v: 1, thread: K, author: 'A', clientId: 6, ts: 1, body: 'x', ...o,
  })
  const state = (o: Record<string, unknown> = {}) => ({ resolved: true, by: 'A', clientId: 1, ts: 1, ...o })

  it('mục từ API hợp lệ', () => {
    const d = mk()
    const id = addComment(d, { author: 'An', body: 'ý', from: 0, to: 3 })
    const rid = replyComment(d, id, { author: 'Bo', body: 'ok' })
    setResolved(d, id, true, 'An')
    const m = getComments(d)
    expect(m.size).toBe(3)
    for (const [k, v] of m.entries()) expect(validateCommentValue(k, v)).toBeNull()
    expect(rid).toMatch(/^c:\d+:[a-z0-9]{8}$/)
  })

  it('hợp lệ thủ công', () => {
    expect(validateCommentValue(K, root())).toBeNull()
    expect(validateCommentValue('c:6:abcdefgh', reply())).toBeNull()
    expect(validateCommentValue(`s:${K}`, state())).toBeNull()
  })

  it('mã lỗi', () => {
    expect(validateCommentValue(K, root({ clientId: 6 }))).toBe('comment_client')
    expect(validateCommentValue(K, root({ body: 'a'.repeat(4001) }))).toBe('comment_body')
    expect(validateCommentValue(K, root({ body: '   ' }))).toBe('comment_body')
    expect(validateCommentValue('c:6:abcdefgh', reply({ anchor }))).toBe('comment_anchor')
    expect(validateCommentValue(K, root({ anchor: undefined }))).toBe('comment_anchor')
    expect(validateCommentValue(K, (() => { const r: Record<string, unknown> = root(); delete r.anchor; return r })())).toBe('comment_anchor')
    expect(validateCommentValue(K, root({ anchor: { ...anchor, start: '!!!' } }))).toBe('comment_anchor')
    expect(validateCommentValue(K, root({ anchor: { ...anchor, quote: 'q'.repeat(301) } }))).toBe('comment_anchor')
    expect(validateCommentValue(K, root({ extra: 1 }))).toBe('comment_shape')
    expect(validateCommentValue(K, root({ v: 2 }))).toBe('comment_shape')
    expect(validateCommentValue(K, null)).toBe('comment_shape')
    expect(validateCommentValue(K, [])).toBe('comment_shape')
    expect(validateCommentValue(K, root({ author: 'a'.repeat(41) }))).toBe('comment_shape')
    expect(validateCommentValue('x:1', root())).toBe('comment_key')
    expect(validateCommentValue('c:01:abcdefgh', root())).toBe('comment_key')
    expect(validateCommentValue('s:x:1', state())).toBe('comment_key')
    const { resolved: _r, ...noResolved } = state()
    expect(validateCommentValue(`s:${K}`, noResolved)).toBe('comment_shape')
    expect(validateCommentValue(`s:${K}`, state({ extra: 1 }))).toBe('comment_shape')
  })

  it('commentKeyClient', () => {
    expect(commentKeyClient('c:12:abcdefgh')).toBe(12)
    expect(commentKeyClient('c:0:abcdefgh')).toBe(0)
    expect(commentKeyClient('s:c:7:abcdefgh')).toBe(7)
    expect(commentKeyClient('c:012:abcdefgh')).toBeNull()
    expect(commentKeyClient('c:1:short')).toBeNull()
    expect(commentKeyClient('x:1:abcdefgh')).toBeNull()
  })

  it('listThreads bỏ mục clientId lệch khoá', () => {
    const d = mk()
    getComments(d).set(K, root({ clientId: 99 }))
    expect(listThreads(d)).toHaveLength(0)
  })
})
