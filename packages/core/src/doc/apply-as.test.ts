import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { createDoc, getSource } from './doc.js'
import { applyTextChangeAsActor } from './apply-as.js'

const actors = (d: Y.Doc) => d.getMap('meta').get('actors') as Y.Map<string> | undefined

function seeded(text: string) {
  const d = createDoc()
  getSource(d).insert(0, text)
  return d
}

describe('applyTextChangeAsActor', () => {
  it('sets text to next and returns true', () => {
    const d = seeded('hello world foo')
    expect(applyTextChangeAsActor(d, 'hello there foo', 'AI')).toEqual(expect.any(Number))
    expect(getSource(d).toString()).toBe('hello there foo')
  })

  it('one transaction with given origin, new items under another clientID', () => {
    const d = seeded('hello world foo')
    const origins: unknown[] = []
    const ids = new Set<number>()
    d.on('afterTransaction', (tr: Y.Transaction) => {
      if (tr.changed.size === 0 && tr.afterState.size === 0) return
      origins.push(tr.origin)
    })
    getSource(d).observe((_e, tr) => {
      for (const [client] of tr.afterState) if ((tr.beforeState.get(client) ?? 0) < tr.afterState.get(client)!) ids.add(client)
    })
    const tag = { who: 'ai' }
    applyTextChangeAsActor(d, 'hello there foo', 'AI', tag)
    expect(origins).toEqual([tag])
    expect(ids.size).toBeGreaterThan(0)
    expect(ids.has(d.clientID)).toBe(false)
  })

  it('maps the new clientID to the actor in meta.actors', () => {
    const d = seeded('abc')
    applyTextChangeAsActor(d, 'abd', 'AI-bot')
    const values = [...(actors(d)?.entries() ?? [])]
    const ai = values.filter(([, v]) => v === 'AI-bot')
    expect(ai).toHaveLength(1)
    expect(ai[0]![0]).not.toBe(String(d.clientID))
  })

  it('returns false and does nothing when text is identical', () => {
    const d = seeded('same')
    const before = JSON.stringify(actors(d)?.toJSON() ?? null)
    let txs = 0
    d.on('afterTransaction', () => txs++)
    expect(applyTextChangeAsActor(d, 'same', 'AI')).toBe(false)
    expect(txs).toBe(0)
    expect(JSON.stringify(actors(d)?.toJSON() ?? null)).toBe(before)
  })

  it('leaves formatVersion and history unchanged', () => {
    const d = seeded('abc')
    const meta = d.getMap('meta')
    const fv = meta.get('formatVersion')
    const hist = d.getArray('history').length
    applyTextChangeAsActor(d, 'abcd', 'AI')
    expect(meta.get('formatVersion')).toBe(fv)
    expect(d.getArray('history').length).toBe(hist)
  })

  it('converges with a concurrent edit on another replica', () => {
    const a = seeded('line one\n\nline two\n')
    const b = new Y.Doc({ gc: false })
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    getSource(b).insert(getSource(b).length, 'tail\n')
    applyTextChangeAsActor(a, 'line ONE\n\nline two\n', 'AI')
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    expect(getSource(a).toString()).toBe(getSource(b).toString())
    expect(getSource(a).toString()).toBe('line ONE\n\nline two\ntail\n')
  })

  it('reuses clientID only via opts.reuseClientId; actors map does not grow', () => {
    const d = seeded('a b c')
    const id = applyTextChangeAsActor(d, 'A b c', 'Claude Code') as number
    const n = actors(d)!.size
    expect(applyTextChangeAsActor(d, 'A B c', 'Claude Code', undefined, { reuseClientId: id })).toBe(id)
    applyTextChangeAsActor(d, 'A B C', 'Claude Code', undefined, { reuseClientId: id })
    expect(actors(d)!.size).toBe(n)
    expect(getSource(d).toString()).toBe('A B C')
    applyTextChangeAsActor(d, 'A B CC', 'Other', undefined, { reuseClientId: id })
    expect(actors(d)!.size).toBe(n + 1)
    expect(d.getMap('meta').has('mcpActors')).toBe(false)
  })

  it('two machines with the same client name get different ids and merge cleanly', () => {
    const base = seeded('one\n\ntwo\n')
    const a = new Y.Doc({ gc: false }), b = new Y.Doc({ gc: false }), c = new Y.Doc({ gc: false })
    Y.applyUpdate(a, Y.encodeStateAsUpdate(base))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(base))
    const ia = applyTextChangeAsActor(a, 'ONE\n\ntwo\n', 'Claude') as number
    const ib = applyTextChangeAsActor(b, 'one\n\nTWO\n', 'Claude') as number
    expect(ia).not.toBe(ib)
    Y.applyUpdate(c, Y.encodeStateAsUpdate(base))
    Y.applyUpdate(c, Y.encodeStateAsUpdate(a))
    Y.applyUpdate(c, Y.encodeStateAsUpdate(b))
    expect(getSource(c).toString()).toBe('ONE\n\nTWO\n')
    expect(c.getMap('meta').has('mcpActors')).toBe(false)
  })

  it('never reuses a human clientID even if a name matches', () => {
    const d = seeded('abc')
    d.getMap('meta').set('actors', new Y.Map<string>())
    actors(d)!.set(String(d.clientID), 'Human')
    const id = applyTextChangeAsActor(d, 'abd', 'Human', undefined, { reuseClientId: d.clientID })
    expect(id).not.toBe(d.clientID)
    expect(getSource(d).toString()).toBe('abd')
    expect(actors(d)!.get(String(d.clientID))).toBe('Human')
  })
})
