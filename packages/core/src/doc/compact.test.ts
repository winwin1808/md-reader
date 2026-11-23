import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { createDoc, getSource, getMeta, getHistory } from './doc.js'
import { compactDoc } from './compact.js'
import { addComment, replyComment, setResolved, listThreads, getComments } from '../comments/comments.js'

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
    expect(getMeta(n).get('formatVersion')).toBe(3)
    expect(getMeta(n).get('title')).toBe('T')
    expect(getMeta(n).get('originHash')).toBe('h1')
    const actors = getMeta(n).get('actors')
    expect(actors).toBeInstanceOf(Y.Map)
    expect((actors as Y.Map<unknown>).size).toBe(0)
    expect(getMeta(n).has('remoteHash')).toBe(false)
    expect(getHistory(n).length).toBe(1)
    expect(getHistory(n).get(0).snapshot).toBeUndefined()
  }, 60000)

  it('keeps comments and re-anchors them', () => {
    const doc = createDoc({ title: 'T', source: 'alpha beta gamma delta' })
    const src = getSource(doc)
    const id1 = addComment(doc, { author: 'A', body: 'one', from: 6, to: 10 })
    const id2 = addComment(doc, { author: 'A', body: 'two', from: 17, to: 22 })
    replyComment(doc, id1, { author: 'B', body: 'reply' })
    setResolved(doc, id1, true, 'A')
    for (let i = 0; i < 50; i++) {
      src.insert(0, 'xx')
      src.delete(0, 2)
      src.insert(src.length, 'z')
      src.delete(src.length - 1, 1)
    }
    src.insert(0, 'PRE ')
    src.delete(src.toString().indexOf('delta'), 5)
    getComments(doc).set('garbage', { nope: 1 })
    getComments(doc).set('c:1:abcdefgh', { v: 1 })
    const before = listThreads(doc)
    expect(before.find((t) => t.id === id2)!.range).toBeNull()

    const n = new Y.Doc({ gc: false })
    Y.applyUpdate(n, compactDoc(doc))
    const after = listThreads(n)
    expect(after.map((t) => t.id).sort()).toEqual([id1, id2].sort())
    const t1 = after.find((t) => t.id === id1)!
    expect(t1.body).toBe('one')
    expect(t1.resolved).toBe(true)
    expect(t1.replies.map((r) => r.body)).toEqual(['reply'])
    expect(t1.range).not.toBeNull()
    expect(getSource(n).toString().slice(t1.range!.from, t1.range!.to)).toBe(t1.quote)
    expect(t1.quote).toBe('beta')
    expect(after.find((t) => t.id === id2)!.range).toBeNull()
    expect(getComments(n).has('garbage')).toBe(false)
    expect(getComments(n).has('c:1:abcdefgh')).toBe(false)
  })
})
