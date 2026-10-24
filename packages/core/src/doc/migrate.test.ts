import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { UnsupportedFormatVersionError } from './schema.js'
import { migrateDoc, ensureDoc, getMeta, getSource, readMeta } from './doc.js'

function v1Fixture(): Y.Doc {
  const doc = new Y.Doc()
  doc.transact(() => {
    getSource(doc).insert(0, '# Hi')
    const m = getMeta(doc)
    m.set('name', 'a.md')
    m.set('size', 5)
    m.set('originHash', 'abc')
  })
  return doc
}

describe('migrateDoc v1 -> v2', () => {
  it('migrates legacy meta', () => {
    const doc = v1Fixture()
    expect(migrateDoc(doc)).toEqual({ from: 1, to: 2 })
    const m = getMeta(doc)
    expect(m.get('title')).toBe('a.md')
    expect(m.has('name')).toBe(false)
    expect(m.has('size')).toBe(false)
    expect(typeof m.get('createdAt')).toBe('number')
    expect(m.get('actors')).toBeInstanceOf(Y.Map)
    expect(readMeta(doc).actors).toEqual({})
    expect(m.get('originPath')).toBeNull()
    expect(m.get('originHash')).toBe('abc')
    expect(m.get('formatVersion')).toBe(2)
    expect(getSource(doc).toString()).toBe('# Hi')
  })

  it('is idempotent and emits no update second time', () => {
    const doc = v1Fixture()
    migrateDoc(doc)
    let updates = 0
    doc.on('update', () => updates++)
    expect(migrateDoc(doc)).toEqual({ from: 2, to: 2 })
    expect(updates).toBe(0)
  })

  it('throws on future versions', () => {
    const doc = v1Fixture()
    getMeta(doc).set('formatVersion', 3)
    expect(() => migrateDoc(doc)).toThrow(UnsupportedFormatVersionError)
  })

  it('replicas migrate independently and converge', () => {
    const base = v1Fixture()
    const a = new Y.Doc()
    const b = new Y.Doc()
    Y.applyUpdate(a, Y.encodeStateAsUpdate(base))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(base))
    migrateDoc(a)
    migrateDoc(b)
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    expect(JSON.stringify(getMeta(a).toJSON())).toBe(JSON.stringify(getMeta(b).toJSON()))
  })

  it('keeps existing title over name', () => {
    const doc = v1Fixture()
    getMeta(doc).set('title', 'Keep')
    migrateDoc(doc)
    expect(getMeta(doc).get('title')).toBe('Keep')
  })
})

describe('ensureDoc', () => {
  it('initializes a bare doc', () => {
    const doc = new Y.Doc()
    const r = ensureDoc(doc, { title: 'T', source: 'x' })
    expect(r).toEqual({ migrated: false })
    const m = readMeta(doc)
    expect(m.title).toBe('T')
    expect(m.formatVersion).toBe(2)
    expect(getSource(doc).toString()).toBe('x')
  })

  it('migrates a v1 doc', () => {
    expect(ensureDoc(v1Fixture())).toEqual({ migrated: true })
  })
})
