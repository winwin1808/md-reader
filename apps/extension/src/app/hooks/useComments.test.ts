// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as Y from 'yjs'
import { addComment } from '@md-reader/core'
import { useComments } from './useComments'

function mkDoc(text = 'hello world'): Y.Doc {
  const d = new Y.Doc()
  d.getText('source').insert(0, text)
  return d
}

afterEach(() => vi.useRealTimers())

describe('useComments', () => {
  it('create/reply/resolve/remove update threads immediately', () => {
    const doc = mkDoc()
    const { result } = renderHook(() => useComments(doc, 'An'))
    expect(result.current.threads).toEqual([])
    let id: string | null = null
    act(() => { id = result.current.create({ from: 0, to: 5 }, 'hi') })
    expect(id).toBeTruthy()
    expect(result.current.threads).toHaveLength(1)
    expect(result.current.activeId).toBe(id)
    expect(result.current.openCount).toBe(1)
    act(() => result.current.reply(id!, 'yo'))
    expect(result.current.threads[0]!.replies).toHaveLength(1)
    act(() => result.current.resolve(id!, true))
    expect(result.current.openCount).toBe(0)
    act(() => result.current.remove(id!))
    expect(result.current.threads[0]!.deleted).toBe(true)
  })

  it('invalid range returns null without throwing', () => {
    const doc = mkDoc()
    const { result } = renderHook(() => useComments(doc, 'An'))
    let id: string | null = 'x'
    act(() => { id = result.current.create({ from: 50, to: 90 }, 'bad') })
    expect(id).toBeNull()
  })

  it('remote update appears after 120ms', () => {
    vi.useFakeTimers()
    const doc = mkDoc()
    const { result } = renderHook(() => useComments(doc, 'An'))
    const remote = new Y.Doc()
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
    addComment(remote, { author: 'Bo', body: 'r', from: 0, to: 3 })
    act(() => { Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote)) })
    expect(result.current.threads).toHaveLength(0)
    act(() => { vi.advanceTimersByTime(130) })
    expect(result.current.threads).toHaveLength(1)
  })

  it('keeps threads reference on rerender', () => {
    const doc = mkDoc()
    const { result, rerender } = renderHook(() => useComments(doc, 'An'))
    const first = result.current.threads
    rerender()
    expect(result.current.threads).toBe(first)
  })

  it('me.clientIds includes actor-mapped ids', () => {
    const doc = mkDoc()
    const actors = new Y.Map<string>()
    doc.getMap('meta').set('actors', actors)
    actors.set('777', 'An')
    actors.set('888', 'Other')
    const { result } = renderHook(() => useComments(doc, 'An'))
    expect(result.current.me.clientIds).toEqual(expect.arrayContaining([doc.clientID, 777]))
    expect(result.current.me.clientIds).not.toContain(888)
    expect(result.current.me.canModerate).toBe(true)
  })

  it('changing doc resets activeId', () => {
    const a = mkDoc()
    const b = mkDoc()
    const { result, rerender } = renderHook(({ d }) => useComments(d, 'An'), { initialProps: { d: a } })
    act(() => { result.current.create({ from: 0, to: 2 }, 'x') })
    expect(result.current.activeId).not.toBeNull()
    rerender({ d: b })
    expect(result.current.activeId).toBeNull()
  })

  it('sửa source không đụng bình luận: threads giữ nguyên tham chiếu', () => {
    vi.useFakeTimers()
    const doc = mkDoc('hello world, long text here')
    addComment(doc, { author: 'An', body: 'c', from: 0, to: 5 })
    const { result } = renderHook(() => useComments(doc, 'An'))
    const first = result.current.threads
    act(() => { doc.getText('source').insert(doc.getText('source').length, ' more') })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.threads).toBe(first)
  })

  it('meta.actors đổi cập nhật me.clientIds', () => {
    const doc = mkDoc()
    const { result } = renderHook(() => useComments(doc, 'An'))
    expect(result.current.me.clientIds).not.toContain(555)
    act(() => {
      const actors = new Y.Map<string>()
      doc.getMap('meta').set('actors', actors)
      actors.set('555', 'An')
    })
    expect(result.current.me.clientIds).toContain(555)
  })
})
