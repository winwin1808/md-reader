import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { createDoc, getSource, getMeta, getHistory } from './doc.js'
import { compactDoc } from './compact.js'

describe('compactDoc', () => {
  it('drops history of edits, keeps state', () => {
    const doc = createDoc({ title: 'T', source: 'start' })
    getMeta(doc).set('remoteHash', 'abc')
    getMeta(doc).set('originHash', 'h1')
    const src = getSource(doc)
    for (let i = 0; i < 2000; i++) {
      src.insert(src.length, 'temp line ' + i + '\n')
      src.delete(5, src.length - 5)
      src.insert(5, ' text')
    }
    const before = Y.encodeStateAsUpdate(doc)
    const out = compactDoc(doc)
    console.log('compact sizes', before.length, out.length)
    expect(out.length * 10).toBeLessThanOrEqual(before.length)
    const n = new Y.Doc({ gc: false })
    Y.applyUpdate(n, out)
    expect(getSource(n).toString()).toBe(src.toString())
    expect(getMeta(n).get('formatVersion')).toBe(2)
    expect(getMeta(n).get('title')).toBe('T')
    expect(getMeta(n).get('originHash')).toBe('h1')
    expect(getMeta(n).has('actors')).toBe(false)
    expect(getMeta(n).has('remoteHash')).toBe(false)
    expect(getHistory(n).length).toBe(1)
    expect(getHistory(n).get(0).snapshot).toBeUndefined()
  }, 60000)
})
