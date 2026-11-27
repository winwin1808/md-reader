import { describe, it, expect } from 'vitest'
import { en } from './en'
import it_ from './locales/it'
import fr_ from './locales/fr'
import de_ from './locales/de'

const signature = (s: string): string => {
  const out: string[] = []
  for (const m of s.matchAll(/\{(\w+)(\|[^}]*)?\}/g)) out.push(m[2] !== undefined ? `${m[1]}|` : (m[1] ?? ''))
  return out.sort().join(',')
}

const enRec = en as Record<string, string>
const enKeys = Object.keys(enRec)

describe.each([
  ['it', it_],
  ['fr', fr_],
  ['de', de_],
] as const)('catalog parity: %s', (_name, catalog) => {
  const rec = catalog as Record<string, string>
  const val = (k: string): string => rec[k] ?? ''
  const keys = Object.keys(rec)

  it('has exactly the same keys as en', () => {
    const missing = enKeys.filter((k) => !(k in rec))
    const extra = keys.filter((k) => !(k in enRec))
    expect({ missing, extra }).toEqual({ missing: [], extra: [] })
  })

  it('has no empty values', () => {
    const empty = keys.filter((k) => val(k).trim() === '')
    expect(empty).toEqual([])
  })

  it('keeps the placeholder signature of en', () => {
    const bad = enKeys.filter((k) => k in rec && signature(val(k)) !== signature(enRec[k] ?? ''))
    expect(bad).toEqual([])
  })

  it('plural groups have exactly two forms', () => {
    const bad: string[] = []
    for (const k of keys) {
      for (const m of val(k).matchAll(/\{\w+((?:\|[^|}]*)+)\}/g)) {
        if ((m[1] ?? '').split('|').length - 1 !== 2) bad.push(k)
      }
    }
    expect(bad).toEqual([])
  })

  it('has at most 15% of values identical to en', () => {
    const same = enKeys.filter((k) => val(k) === enRec[k]).length
    expect(same / enKeys.length).toBeLessThanOrEqual(0.15)
  })
})
