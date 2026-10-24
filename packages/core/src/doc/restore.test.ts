import { describe, it, expect, vi } from 'vitest'
import { createDoc, getSource } from './doc.js'
import { createCheckpointTracker } from './checkpoint.js'
import { listHistory } from './history.js'
import { ORIGIN_REVERT } from './apply.js'
import { textAtCheckpoint, restoreCheckpoint } from './restore.js'

function setup() {
  const doc = createDoc({ source: '' })
  const t = createCheckpointTracker(doc, { quietMs: 1e9 })
  getSource(doc).insert(0, 'A')
  const e1 = t.flush('save', 'An')!
  getSource(doc).insert(1, 'B')
  const e2 = t.flush('save', 'An')!
  getSource(doc).insert(2, 'C')
  return { doc, e1, e2, t }
}

describe('restore', () => {
  it('reads text at checkpoints', () => {
    const { doc, e1, e2 } = setup()
    expect(textAtCheckpoint(doc, e1)).toBe('A')
    expect(textAtCheckpoint(doc, e2)).toBe('AB')
  })
  it('restores with minimal delta, origin and history', () => {
    const { doc, e1 } = setup()
    const origins: unknown[] = []
    let deleted = 0
    doc.on('afterTransaction', (tr) => {
      if (!tr.changed.has(getSource(doc) as never)) return
      origins.push(tr.origin)
      deleted += [...tr.deleteSet.clients.values()].flat().reduce((n, d) => n + d.len, 0)
    })
    const before = listHistory(doc).length
    expect(restoreCheckpoint(doc, e1, 'An')).toBe(true)
    expect(getSource(doc).toString()).toBe('A')
    expect(deleted).toBe(2)
    const h = listHistory(doc)
    expect(h.length).toBe(before + 1)
    expect(h[h.length - 1]!.label).toBe(`Khôi phục: ${e1.label}`)
    expect(h[h.length - 1]!.actor).toBe('An')
    expect(h[h.length - 1]!.snapshot).toBeTruthy()
    expect(origins).toEqual([ORIGIN_REVERT])
  })
  it('no-op when text equal', () => {
    const { doc, e1 } = setup()
    getSource(doc).delete(1, 2)
    const n = listHistory(doc).length
    expect(restoreCheckpoint(doc, e1, 'An')).toBe(true)
    expect(listHistory(doc).length).toBe(n)
  })
  it('no snapshot -> null/false', () => {
    const { doc, e1 } = setup()
    const e = { ...e1, snapshot: undefined }
    expect(textAtCheckpoint(doc, e)).toBeNull()
    expect(restoreCheckpoint(doc, e, 'An')).toBe(false)
  })
  it('corrupt snapshot -> null/false', () => {
    const { doc, e1 } = setup()
    const e = { ...e1, snapshot: new Uint8Array([255, 255, 255, 9, 9]) }
    const text = getSource(doc).toString()
    const n = listHistory(doc).length
    expect(textAtCheckpoint(doc, e)).toBeNull()
    expect(restoreCheckpoint(doc, e, 'An')).toBe(false)
    expect(getSource(doc).toString()).toBe(text)
    expect(listHistory(doc).length).toBe(n)
  })
})

function measure(doc: ReturnType<typeof createDoc>) {
  const m = { ins: 0, del: 0 }
  getSource(doc).observe((ev) => {
    for (const d of ev.changes.delta) {
      if (typeof d.insert === 'string') m.ins += d.insert.length
      if (d.delete) m.del += d.delete
    }
  })
  return m
}

describe('restore with live tracker', () => {
  it('no duplicate auto entry after restore', () => {
    vi.useFakeTimers()
    try {
      const doc = createDoc({ source: '' })
      const t = createCheckpointTracker(doc, { quietMs: 1000 })
      getSource(doc).insert(0, 'A')
      const e1 = t.flush('save', 'An')!
      getSource(doc).insert(1, 'B')
      t.flush('save', 'An')
      const before = listHistory(doc).length
      expect(restoreCheckpoint(doc, e1, 'An', t)).toBe(true)
      vi.advanceTimersByTime(5000)
      t.flush('auto', 'x')
      const h = listHistory(doc)
      expect(h.length).toBe(before + 1)
      expect(h[h.length - 1]!.label).toBe(`Khôi phục: ${e1.label}`)
      t.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
  it('pending earlier edits get their own auto entry first', () => {
    const doc = createDoc({ source: '' })
    const t = createCheckpointTracker(doc, { quietMs: 1e9 })
    getSource(doc).insert(0, 'A')
    const e1 = t.flush('save', 'An')!
    getSource(doc).insert(1, 'B')
    const before = listHistory(doc).length
    expect(restoreCheckpoint(doc, e1, 'An', t)).toBe(true)
    const h = listHistory(doc)
    expect(h.length).toBe(before + 2)
    expect(h[h.length - 2]!.label).toBe('auto')
    expect(textAtCheckpoint(doc, h[h.length - 2]!)).toBe('AB')
    expect(h[h.length - 1]!.label).toBe(`Khôi phục: ${e1.label}`)
    t.dispose()
  })
  it('mixed restore keeps deltas minimal', () => {
    const doc = createDoc({ source: '' })
    const t = createCheckpointTracker(doc, { quietMs: 1e9 })
    getSource(doc).insert(0, 'Xin bạn')
    const e1 = t.flush('save', 'An')!
    getSource(doc).insert(4, 'chào ')
    const e2 = t.flush('save', 'An')!
    const m = measure(doc)
    expect(restoreCheckpoint(doc, e1, 'An', t)).toBe(true)
    expect(getSource(doc).toString()).toBe('Xin bạn')
    expect(m).toEqual({ ins: 0, del: 5 })
    m.ins = 0
    m.del = 0
    expect(restoreCheckpoint(doc, e2, 'An', t)).toBe(true)
    expect(getSource(doc).toString()).toBe('Xin chào bạn')
    expect(m).toEqual({ ins: 5, del: 0 })
    t.dispose()
  })
  it('forward restore A -> AB', () => {
    const { doc, e2, t } = setup()
    getSource(doc).delete(0, 3)
    getSource(doc).insert(0, 'A')
    const m = measure(doc)
    expect(restoreCheckpoint(doc, e2, 'An', t)).toBe(true)
    expect(getSource(doc).toString()).toBe('AB')
    expect(m).toEqual({ ins: 1, del: 0 })
  })
})
