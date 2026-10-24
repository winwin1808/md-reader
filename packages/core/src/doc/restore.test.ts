import { describe, it, expect } from 'vitest'
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
    expect(textAtCheckpoint(doc, e)).toBeNull()
    expect(restoreCheckpoint(doc, e, 'An')).toBe(false)
  })
})
