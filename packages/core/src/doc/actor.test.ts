import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { createDoc } from './doc.js'
import { trackLocalActor } from './checkpoint.js'

const actors = (d: Y.Doc) => (d.getMap('meta').get('actors') as Y.Map<string> | undefined)

describe('trackLocalActor', () => {
  it('registers on local source edit', () => {
    const d = createDoc()
    trackLocalActor(d, () => 'An')
    d.getText('source').insert(0, 'x')
    expect(actors(d)?.get(String(d.clientID))).toBe('An')
  })
  it('does not re-register with same name', () => {
    const d = createDoc()
    trackLocalActor(d, () => 'An')
    d.getText('source').insert(0, 'x')
    actors(d)!.set(String(d.clientID), 'Tampered')
    d.getText('source').insert(0, 'y')
    expect(actors(d)?.get(String(d.clientID))).toBe('Tampered')
  })
  it('registers a changed name', () => {
    const d = createDoc()
    let n = 'An'
    trackLocalActor(d, () => n)
    d.getText('source').insert(0, 'x')
    n = 'Binh'
    d.getText('source').insert(0, 'y')
    expect(actors(d)?.get(String(d.clientID))).toBe('Binh')
  })
  it('ignores remote updates', () => {
    const a = createDoc()
    const b = createDoc()
    trackLocalActor(a, () => 'An')
    b.getText('source').insert(0, 'r')
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    expect(actors(a)?.get(String(a.clientID))).toBeUndefined()
  })
  it('ignores meta-only changes', () => {
    const d = createDoc()
    trackLocalActor(d, () => 'An')
    d.getMap('meta').set('foo', 1)
    expect(actors(d)?.get(String(d.clientID))).toBeUndefined()
  })
  it('ignores blank names', () => {
    const d = createDoc()
    trackLocalActor(d, () => '   ')
    d.getText('source').insert(0, 'x')
    expect(actors(d)?.get(String(d.clientID))).toBeUndefined()
  })
  it('stops after unsubscribe (idempotent)', () => {
    const d = createDoc()
    const off = trackLocalActor(d, () => 'An')
    off()
    off()
    d.getText('source').insert(0, 'x')
    expect(actors(d)?.get(String(d.clientID))).toBeUndefined()
  })
})
