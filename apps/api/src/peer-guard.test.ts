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
