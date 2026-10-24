import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { computeBlame } from './blame.js'
import { getSource, createDoc } from './doc.js'
import { registerActor } from './checkpoint.js'

function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
}

function tiles(doc: Y.Doc) {
  const len = getSource(doc).toString().length
  const r = computeBlame(doc)
  let pos = 0
  for (const x of r) {
    expect(x.from).toBe(pos)
    pos = x.to
  }
  expect(pos).toBe(len)
}

describe('computeBlame', () => {
  it('pins the private Yjs item shape', () => {
    const d = createDoc()
    getSource(d).insert(0, 'abc')
    const s = (getSource(d) as unknown as { _start: Record<string, unknown> & { id: { client: unknown } } })._start
    expect(typeof s.id.client).toBe('number')
    expect(typeof s.length).toBe('number')
    expect(typeof s.deleted).toBe('boolean')
    expect(s.content).toBeDefined()
  })

  it('attributes ranges to each client', () => {
    const a = createDoc()
    getSource(a).insert(0, 'Xin chào ')
    registerActor(a, 'An')
    // B bootstraps from A's state: two independently created meta.actors maps would race (LWW).
    const b = new Y.Doc({ gc: false })
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    getSource(b).insert(9, 'thế giới')
    registerActor(b, 'Bình')
    sync(a, b)
    const r = computeBlame(a)
    expect(r).toEqual([
      { from: 0, to: 9, clientId: a.clientID, actor: 'An' },
      { from: 9, to: 17, clientId: b.clientID, actor: 'Bình' },
    ])
    const t = getSource(a).toString()
    expect(t.slice(r[1]!.from, r[1]!.to)).toBe('thế giới')
  })

  it('skips deleted text and still tiles', () => {
    const a = createDoc()
    const b = createDoc()
    getSource(a).insert(0, 'aaa')
    sync(a, b)
    getSource(b).insert(3, 'bbbb')
    sync(a, b)
    getSource(a).delete(3, 2)
    tiles(a)
    const r = computeBlame(a)
    expect(r.map((x) => x.to - x.from)).toEqual([3, 2])
    expect(getSource(a).toString()).toBe('aaabb')
  })

  it('merges adjacent inserts from one client', () => {
    const a = createDoc()
    const t = getSource(a)
    t.insert(0, 'ab')
    t.insert(2, 'cd')
    t.insert(4, 'ef')
    expect(computeBlame(a)).toHaveLength(1)
    tiles(a)
  })

  it('actor null when unregistered', () => {
    const a = createDoc()
    getSource(a).insert(0, 'x')
    expect(computeBlame(a)[0]!.actor).toBeNull()
  })

  it('empty doc gives []', () => {
    expect(computeBlame(createDoc())).toEqual([])
  })
})
