import { describe, it, expect, vi, afterEach } from 'vitest'
import * as Y from 'yjs'
import { createDoc, getSource, readMeta } from './doc.js'
import { createCheckpointTracker, registerActor } from './checkpoint.js'

afterEach(() => vi.useRealTimers())

describe('checkpoint tracker', () => {
  it('lists both replica clientIDs on flush; second flush is null', () => {
    const a = createDoc({ source: 'hello' })
    const b = new Y.Doc({ gc: false })
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    const t = createCheckpointTracker(a, { quietMs: 1e9 })
    getSource(a).insert(0, 'A')
    getSource(b).insert(0, 'B')
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    const e = t.flush('save', 'me')!
    expect(e.clientIds).toEqual([a.clientID, b.clientID].sort((x, y) => x - y))
    expect(t.flush('save', 'me')).toBeNull()
    t.dispose()
  })

  it('auto-flushes after quiet period once', () => {
    vi.useFakeTimers()
    const a = createDoc({ source: 'x' })
    const onAuto = vi.fn()
    const t = createCheckpointTracker(a, { onAuto })
    getSource(a).insert(0, 'y')
    vi.advanceTimersByTime(30000)
    expect(onAuto).toHaveBeenCalledTimes(1)
    expect(onAuto.mock.calls[0]![0].label).toBe('auto')
    expect(a.getArray('history').length).toBe(1)
    vi.advanceTimersByTime(60000)
    expect(onAuto).toHaveBeenCalledTimes(1)
    t.dispose()
  })

  it('snapshot restores text at flush time', () => {
    const a = createDoc({ source: 'one' })
    const t = createCheckpointTracker(a, { quietMs: 1e9 })
    getSource(a).insert(3, ' two')
    const e = t.flush('save', 'me')!
    getSource(a).insert(0, 'later ')
    getSource(a).delete(0, 2)
    const old = Y.createDocFromSnapshot(a, Y.decodeSnapshot(e.snapshot!))
    expect(old.getText('source').toString()).toBe('one two')
    t.dispose()
  })

  it('registerActor writes under clientID', () => {
    const a = createDoc()
    registerActor(a, 'Alice')
    expect(readMeta(a).actors[String(a.clientID)]).toBe('Alice')
  })

  it('local delete-only edit attributes doc.clientID', () => {
    const a = createDoc({ source: 'hello' })
    const t = createCheckpointTracker(a, { quietMs: 1e9 })
    getSource(a).delete(0, 2)
    expect(t.flush('save', 'me')!.clientIds).toContain(a.clientID)
    t.dispose()
  })

  it('replica deleting and syncing to A: B flush lists B', () => {
    const a = createDoc({ source: 'hello' })
    const b = new Y.Doc({ gc: false })
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    const tb = createCheckpointTracker(b, { quietMs: 1e9 })
    getSource(b).delete(0, 2)
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    expect(tb.flush('save', 'b')!.clientIds).toEqual([b.clientID])
    tb.dispose()
  })

  it('concurrent registerActor on replicas keeps both names', () => {
    const a = createDoc()
    const b = new Y.Doc({ gc: false })
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    registerActor(a, 'Alice')
    registerActor(b, 'Bob')
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    for (const d of [a, b]) {
      const actors = readMeta(d).actors
      expect(actors[String(a.clientID)]).toBe('Alice')
      expect(actors[String(b.clientID)]).toBe('Bob')
    }
  })

  it('dispose clears timer and stops collecting', () => {
    vi.useFakeTimers()
    const a = createDoc({ source: 'x' })
    const onAuto = vi.fn()
    const t = createCheckpointTracker(a, { onAuto })
    getSource(a).insert(0, 'y')
    t.flush('save', 'me')
    getSource(a).insert(0, 'w')
    expect(vi.getTimerCount()).toBe(1)
    t.dispose()
    expect(vi.getTimerCount()).toBe(0)
    t.flush('save', 'me')
    getSource(a).insert(0, 'z')
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60000)
    expect(onAuto).not.toHaveBeenCalled()
    expect(t.flush('save', 'me')).toBeNull()
  })

  it('force flush with no changes records an entry with a snapshot; non-forced is null', () => {
    const a = createDoc({ source: 'x' })
    const t = createCheckpointTracker(a)
    expect(t.flush('save', 'me')).toBeNull()
    const e = t.flush('save', 'me', { force: true })
    expect(e).not.toBeNull()
    expect(e!.clientIds).toEqual([])
    expect(e!.snapshot!.length).toBeGreaterThan(0)
    t.dispose()
  })

  it('flush cancels a pending auto timer', () => {
    vi.useFakeTimers()
    const a = createDoc({ source: 'x' })
    const onAuto = vi.fn()
    const t = createCheckpointTracker(a, { onAuto })
    getSource(a).insert(0, 'y')
    t.flush('save', 'me')
    vi.advanceTimersByTime(60000)
    expect(onAuto).not.toHaveBeenCalled()
    t.dispose()
  })

  it('repeated edits restart the quiet timer', () => {
    vi.useFakeTimers()
    const a = createDoc({ source: 'x' })
    const onAuto = vi.fn()
    const t = createCheckpointTracker(a, { onAuto })
    getSource(a).insert(0, '1')
    vi.advanceTimersByTime(20000)
    getSource(a).insert(0, '2')
    vi.advanceTimersByTime(20000)
    expect(onAuto).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10000)
    expect(onAuto).toHaveBeenCalledTimes(1)
    t.dispose()
  })
})
