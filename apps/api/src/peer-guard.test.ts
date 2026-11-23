import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { peerTxViolation } from './peer-guard'

function setup() {
  const doc = new Y.Doc()
  doc.getText('source').insert(0, 'hello')
  const meta = doc.getMap('meta')
  meta.set('formatVersion', 2)
  meta.set('aiUnsaved', true)
  meta.set('actors', new Y.Map())
  doc.getArray('history')
  return doc
}
function check(doc: Y.Doc, fn: () => void, clientID?: number): string | null {
  let r: string | null = 'unset'
  const h = (tr: Y.Transaction) => {
    r = peerTxViolation(tr, doc)
  }
  doc.on('afterTransaction', h)
  if (clientID !== undefined) doc.clientID = clientID
  doc.transact(fn, 'peer')
  doc.off('afterTransaction', h)
  return r
}

describe('peerTxViolation', () => {
  it('allows source-only edits', () => {
    const doc = setup()
    expect(check(doc, () => doc.getText('source').insert(0, 'x'))).toBeNull()
  })
  it('allows own actors entry', () => {
    const doc = setup()
    doc.clientID = 777
    expect(check(doc, () => (doc.getMap('meta').get('actors') as Y.Map<string>).set('777', 'Bob'))).toBeNull()
  })
  it('rejects another clientID in actors', () => {
    const doc = setup()
    doc.clientID = 777
    expect(check(doc, () => (doc.getMap('meta').get('actors') as Y.Map<string>).set('123', 'Eve'))).not.toBeNull()
  })
  it('rejects meta.formatVersion change', () => {
    const doc = setup()
    expect(check(doc, () => doc.getMap('meta').set('formatVersion', 99))).not.toBeNull()
  })
  it('rejects meta.aiUnsaved delete', () => {
    const doc = setup()
    expect(check(doc, () => doc.getMap('meta').delete('aiUnsaved'))).not.toBeNull()
  })
  it('rejects replacing actors map', () => {
    const doc = setup()
    expect(check(doc, () => doc.getMap('meta').set('actors', new Y.Map()))).not.toBeNull()
  })
  it('rejects history push', () => {
    const doc = setup()
    expect(check(doc, () => doc.getArray('history').push([1]))).not.toBeNull()
  })
  it('rejects other root types', () => {
    const doc = setup()
    expect(check(doc, () => doc.getMap('other').set('a', 1))).not.toBeNull()
  })
})

import { peerUpdateViolation } from './peer-guard'

describe('peerUpdateViolation (14a)', () => {
  const own = () => ({ owners: new Map<number, string>(), claimed: new Set<number>(), prefix: 'p' })
  function upd(doc: Y.Doc, fn: (p: Y.Doc) => void): Uint8Array {
    const p = new Y.Doc()
    Y.applyUpdate(p, Y.encodeStateAsUpdate(doc))
    let u: Uint8Array = new Uint8Array()
    p.on('update', (x: Uint8Array) => (u = x))
    p.transact(() => fn(p))
    return u
  }
  it('rejects deleting meta entries and writing history', () => {
    const doc = setup()
    expect(peerUpdateViolation(upd(doc, (p) => p.getMap('meta').delete('aiUnsaved')), doc, own())).not.toBeNull()
    expect(peerUpdateViolation(upd(doc, (p) => p.getArray('history').push([1])), doc, own())).not.toBeNull()
  })
  it('rejects more than 4 new clientIDs in one update set and a struct with missing parent', () => {
    const doc = setup()
    const o = own()
    for (let i = 0; i < 5; i++) o.claimed.add(1000 + i)
    expect(peerUpdateViolation(upd(doc, (p) => p.getText('source').insert(0, 'x')), doc, o)).toBe('too many clientIDs')
    const p = new Y.Doc()
    p.getText('source').insert(0, 'ab')
    const u1 = Y.encodeStateAsUpdate(p)
    const sv = Y.encodeStateVector(p)
    p.getText('source').insert(1, 'c')
    const gap = Y.encodeStateAsUpdate(p, sv)
    expect(peerUpdateViolation(gap, doc, own())).not.toBeNull()
    expect(peerUpdateViolation(u1, doc, own())).toBeNull()
  })
  it('accepts a step2 whose delete set re-deletes meta items already deleted by the owner', () => {
    const doc = setup()
    doc.getMap('meta').set('remoteHash', 'a')
    doc.getMap('meta').set('remoteHash', 'b')
    doc.getMap('meta').set('remoteHash', 'c')
    const c = new Y.Doc()
    Y.applyUpdate(c, Y.encodeStateAsUpdate(doc))
    c.getText('source').insert(0, 'hi')
    const u = Y.encodeStateAsUpdate(c, Y.encodeStateVector(doc))
    expect(peerUpdateViolation(u, doc, own())).toBeNull()
  })
  it('still rejects deleting a LIVE meta item', () => {
    const doc = setup()
    doc.getMap('meta').set('remoteHash', 'a')
    doc.getMap('meta').set('remoteHash', 'b')
    const u = upd(doc, (p) => p.getMap('meta').delete('remoteHash'))
    expect(peerUpdateViolation(u, doc, own())).not.toBeNull()
  })
  it('terminates on origin cycles (self and mutual)', { timeout: 2000 }, () => {
    const doc = setup()
    const C = 5
    // client C, 2 string items (len 1 each); info 0x84 = ContentString + origin; parent omitted
    const mutual = Uint8Array.from([1, 2, C, 0, 0x84, C, 1, 1, 97, 0x84, C, 0, 1, 97, 0])
    const self = Uint8Array.from([1, 1, C, 0, 0x84, C, 0, 1, 97, 0])
    expect(peerUpdateViolation(mutual, doc, own())).not.toBeNull()
    expect(peerUpdateViolation(self, doc, own())).not.toBeNull()
  })
  it('rejects a parent-ID cycle between type items as unresolved parent', { timeout: 2000 }, () => {
    const doc = setup()
    const C = 5
    // client C: item0 (type, parent=ID(C,1)), item1 (type, parent=ID(C,0)), item2 (string 'a', parent=ID(C,0))
    // info 0x07 = ContentType, no origins, parent-info 0 => parent is an ID; type ref 0 (YArray)
    const u = Uint8Array.from([1, 3, C, 0, 0x07, 0, C, 1, 0, 0x07, 0, C, 0, 0, 0x04, 0, C, 0, 1, 97, 0])
    expect(peerUpdateViolation(u, doc, own())).toBe('unresolved parent')
  })
  it('rejects non-string content in source', () => {
    const doc = setup()
    expect(peerUpdateViolation(upd(doc, (p) => p.getText('source').insertEmbed(0, { a: 1 })), doc, own())).toBe('forbidden content in source')
    expect(peerUpdateViolation(upd(doc, (p) => p.getText('source').format(0, 3, { bold: true })), doc, own())).toBe('forbidden content in source')
    const x = new Y.Doc()
    const xt = x.get('source', Y.XmlText) as Y.XmlText
    xt.setAttribute('k', 'v')
    expect(peerUpdateViolation(Y.encodeStateAsUpdate(x), doc, own())).toBe('forbidden content in source')
  })
  describe('clock gaps (22b)', () => {
    function chain() {
      const c = new Y.Doc()
      c.clientID = 4242
      const us: Uint8Array[] = []
      c.on('update', (x: Uint8Array) => us.push(x))
      const t = c.getText('source')
      t.insert(0, 'a')
      t.insert(1, 'b')
      t.insert(2, 'c')
      return us as [Uint8Array, Uint8Array, Uint8Array]
    }
    const owned = () => ({ owners: new Map<number, string>([[4242, 'p']]), claimed: new Set<number>([4242]), prefix: 'p' })
    it('rejects an owned clientID whose first struct starts after a gap', () => {
      const [, u2] = chain()
      expect(peerUpdateViolation(u2, new Y.Doc(), owned())).toBe('clock gap')
    })
    it('accepts u2 once u1 is applied, and merged u1+u2 retransmission', () => {
      const [u1, u2] = chain()
      const doc = new Y.Doc()
      Y.applyUpdate(doc, u1)
      expect(peerUpdateViolation(u2, doc, owned())).toBeNull()
      expect(peerUpdateViolation(Y.mergeUpdates([u1, u2]), doc, owned())).toBeNull()
    })
    it('rejects an update containing a Skip struct', () => {
      const [u1, , u3] = chain()
      expect(peerUpdateViolation(Y.mergeUpdates([u1, u3]), new Y.Doc(), owned())).toBe('clock gap')
    })
  })
  it('still accepts plain insert and delete in source', () => {
    const doc = setup()
    expect(peerUpdateViolation(upd(doc, (p) => p.getText('source').insert(2, 'zz')), doc, own())).toBeNull()
    expect(peerUpdateViolation(upd(doc, (p) => p.getText('source').delete(0, 2)), doc, own())).toBeNull()
  })
})

import { addComment, setResolved } from '@md-reader/core'

describe('peerUpdateViolation comments (23d1)', () => {
  const own = (ids: number[] = []) => ({ owners: new Map<number, string>(ids.map((i) => [i, 'p'])), claimed: new Set<number>(ids), prefix: 'p' })
  /** Build an update by running fn on a temp doc (given clientID) synced from the room doc. */
  function upd(doc: Y.Doc, clientID: number, fn: (p: Y.Doc) => void): Uint8Array {
    const p = new Y.Doc()
    Y.applyUpdate(p, Y.encodeStateAsUpdate(doc))
    p.clientID = clientID
    fn(p)
    return Y.encodeStateAsUpdate(p, Y.encodeStateVector(doc))
  }
  const value = (key: string, clientId: number, body = 'hi') => ({ v: 1, thread: 'c:1:abcdefgh', author: 'A', body, ts: 1, clientId })
  const key = (c: number, r = 'abcdefgh') => `c:${c}:${r}`

  it('edit and view add an own comment via core addComment', () => {
    const doc = setup()
    for (const role of ['edit', 'view'] as const) {
      const u = upd(doc, 11, (p) => addComment(p as never, { author: 'A', body: 'x', from: 0, to: 3 }))
      expect(peerUpdateViolation(u, doc, own(), role)).toBeNull()
    }
  })
  it('no role argument behaves as edit', () => {
    const doc = setup()
    expect(peerUpdateViolation(upd(doc, 12, (p) => p.getText('source').insert(0, 'z')), doc, own())).toBeNull()
    expect(peerUpdateViolation(upd(doc, 12, (p) => p.getText('source').insert(0, 'z')), doc, own(), 'view')).toBe('view_write')
  })
  it('view cannot write source or meta.actors', () => {
    const doc = setup()
    expect(peerUpdateViolation(upd(doc, 13, (p) => p.getText('source').insert(0, 'z')), doc, own(), 'view')).toBe('view_write')
    expect(peerUpdateViolation(upd(doc, 13, (p) => (p.getMap('meta').get('actors') as Y.Map<string>).set('13', 'B')), doc, own(), 'view')).toBe('view_write')
    expect(peerUpdateViolation(upd(doc, 13, (p) => p.getArray('history').push([1])), doc, own(), 'view')).toBe('view_write')
  })
  it('rejects a c: key whose client differs from the struct client', () => {
    const doc = setup()
    const u = upd(doc, 14, (p) => p.getMap('comments').set(key(50), value(key(50), 50)))
    expect(peerUpdateViolation(u, doc, own())).toBe('comment_owner')
  })
  it('rejects a c: key for a clientID outside own', () => {
    const doc = setup()
    const u = upd(doc, 15, (p) => p.getMap('comments').set(key(15), value(key(15), 15)))
    const o = own()
    o.owners.set(15, 'other')
    expect(peerUpdateViolation(u, doc, o)).toBe('foreign clientID 15')
  })
  it('rejects a value clientId that differs from the key', () => {
    const doc = setup()
    const u = upd(doc, 16, (p) => p.getMap('comments').set(key(16), value(key(16), 17)))
    expect(peerUpdateViolation(u, doc, own())).toBe('comment_client')
  })
  it('rejects a 4001 char body', () => {
    const doc = setup()
    const u = upd(doc, 18, (p) => p.getMap('comments').set(key(18), value(key(18), 18, 'a'.repeat(4001))))
    expect(peerUpdateViolation(u, doc, own())).toBe('comment_body')
  })
  describe('thread state s:', () => {
    function withThread() {
      const doc = setup()
      const id = (() => {
        const p = new Y.Doc()
        Y.applyUpdate(p, Y.encodeStateAsUpdate(doc))
        p.clientID = 21
        const i = addComment(p as never, { author: 'A', body: 'x', from: 0, to: 3 })
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(p))
        return i
      })()
      return { doc, id }
    }
    it('view sets s: only for own thread; edit for any', () => {
      const { doc, id } = withThread()
      const mine = upd(doc, 21, (p) => setResolved(p as never, id, true, 'A'))
      expect(peerUpdateViolation(mine, doc, own([21]), 'view')).toBeNull()
      const theirs = upd(doc, 22, (p) => setResolved(p as never, id, true, 'B'))
      expect(peerUpdateViolation(theirs, doc, own(), 'view')).toBe('comment_owner')
      expect(peerUpdateViolation(theirs, doc, own(), 'edit')).toBeNull()
    })
  })
  it('rejects a nested Y.Map value', () => {
    const doc = setup()
    const u = upd(doc, 19, (p) => p.getMap('comments').set(key(19), new Y.Map()))
    expect(['comment_content', 'comment_nested']).toContain(peerUpdateViolation(u, doc, own()))
    const u2 = upd(doc, 19, (p) => {
      const m = new Y.Map<unknown>()
      p.getMap('comments').set(key(19), m)
      m.set('a', 1)
    })
    expect(['comment_content', 'comment_nested']).toContain(peerUpdateViolation(u2, doc, own()))
  })
})
