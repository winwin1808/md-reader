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
})
