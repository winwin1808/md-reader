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
    expect(applyTextChangeAsActor(d, 'hello there foo', 'AI')).toBe(true)
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

  it('reuses one clientID per actor name; actors map does not grow', () => {
    const d = seeded('a b c')
    applyTextChangeAsActor(d, 'A b c', 'Claude Code')
    const n = actors(d)!.size
    applyTextChangeAsActor(d, 'A B c', 'Claude Code')
    applyTextChangeAsActor(d, 'A B C', 'Claude Code')
    expect(actors(d)!.size).toBe(n)
    expect(getSource(d).toString()).toBe('A B C')
    applyTextChangeAsActor(d, 'A B CC', 'Other')
    expect(actors(d)!.size).toBe(n + 1)
  })

  it('never reuses a human clientID even if a name matches', () => {
    const d = seeded('abc')
    d.getMap('meta').set('actors', new Y.Map<string>())
    actors(d)!.set(String(d.clientID), 'Human')
    applyTextChangeAsActor(d, 'abd', 'Human')
    const e = d.getMap('meta').get('mcpActors') as Y.Map<string>
    expect(e.get('Human')).not.toBe(String(d.clientID))
    applyTextChangeAsActor(d, 'abe', 'Human')
    expect(getSource(d).toString()).toBe('abe')
    expect(actors(d)!.get(String(d.clientID))).toBe('Human')
  })
})
