import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as syncProtocol from 'y-protocols/sync'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { classifyMessage, MAX_AWARENESS_BYTES, sanitizeAwarenessMessage, sanitizeUser } from './protocol'

function sync(fn: (e: encoding.Encoder, d: Y.Doc) => void): Uint8Array {
  const d = new Y.Doc()
  d.getText('t').insert(0, 'hi')
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 0)
  fn(e, d)
  return encoding.toUint8Array(e)
}
function awMsg(aw: Awareness): Uint8Array {
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 1)
  encoding.writeVarUint8Array(e, encodeAwarenessUpdate(aw, [aw.clientID]))
  return encoding.toUint8Array(e)
}
function mk(state: unknown): Awareness {
  const aw = new Awareness(new Y.Doc())
  aw.setLocalState(state as object | null)
  return aw
}

describe('classifyMessage', () => {
  it('classifies real messages', () => {
    expect(classifyMessage(sync((e, d) => syncProtocol.writeSyncStep1(e, d)))).toBe('step1')
    expect(classifyMessage(sync((e, d) => syncProtocol.writeSyncStep2(e, d)))).toBe('step2')
    expect(classifyMessage(sync((e, d) => syncProtocol.writeUpdate(e, Y.encodeStateAsUpdate(d))))).toBe('update')
    expect(classifyMessage(awMsg(mk({ user: { name: 'a' } })))).toBe('awareness')
  })
  it('other and no throw', () => {
    expect(classifyMessage(new Uint8Array([]))).toBe('other')
    expect(classifyMessage(new Uint8Array([7]))).toBe('other')
    expect(() => classifyMessage(new Uint8Array([0]))).not.toThrow()
    expect(classifyMessage(new Uint8Array([0, 0x80]))).toBe('other')
  })
})

describe('sanitizeUser', () => {
  it('keeps valid', () => {
    expect(sanitizeUser({ name: ' Ann ', color: 'var(--peer-3)', colorLight: 'x' })).toEqual({
      name: 'Ann',
      color: 'var(--peer-3)',
      colorLight: 'color-mix(in srgb, var(--peer-3) 20%, transparent)',
    })
  })
  it('bad color, name, non-object', () => {
    expect(sanitizeUser({ name: 'a', color: 'red;background:url(x)' })!.color).toBe('var(--peer-1)')
    expect(sanitizeUser({ name: {} })!.name).toBe('Ẩn danh')
    expect(sanitizeUser({ name: 'x'.repeat(100) })!.name).toHaveLength(40)
    expect(sanitizeUser('s')).toBeNull()
    expect(sanitizeUser(null)).toBeNull()
  })
})

describe('sanitizeAwarenessMessage', () => {
  it('sanitizes state', () => {
    const src = mk({ user: { name: 'a', color: 'red;x' }, token: 'x', cursor: { anchor: 1, head: 2 } })
    const out = sanitizeAwarenessMessage(awMsg(src))!
    expect(out).not.toBeNull()
    expect(classifyMessage(out)).toBe('awareness')
    const dec = (await_decode(out))
    const st = dec.getStates().get(src.clientID) as any
    expect(st.user.color).toBe('var(--peer-1)')
    expect('token' in st).toBe(false)
    expect(st.cursor).toEqual({ anchor: 1, head: 2 })
  })
  it('removal survives', () => {
    const aw = mk({ user: { name: 'a' } })
    const e0 = awMsg(aw)
    const first = sanitizeAwarenessMessage(e0)!
    const rec = await_decode(first)
    aw.setLocalState(null)
    const out = sanitizeAwarenessMessage(awMsg(aw))!
    expect(out).not.toBeNull()
    applyAwarenessUpdate(rec, inner(out), 'x')
    expect(rec.getStates().has(aw.clientID)).toBe(false)
  })
  describe('cursor shape', () => {
    const st = (cursor: unknown) => {
      const src = mk({ user: { name: 'bob' }, cursor })
      const aw = await_decode(sanitizeAwarenessMessage(awMsg(src))!)
      return aw.getStates().get(src.clientID) as any
    }
    it('drops string cursor, keeps name', () => {
      const r = st('boom')
      expect('cursor' in r).toBe(false)
      expect(r.user.name).toBe('bob')
    })
    it('drops array', () => expect('cursor' in st([1, 2])).toBe(false))
    it('drops 2KB object', () => expect('cursor' in st({ a: 'x'.repeat(2048) })).toBe(false))
    it('keeps small object', () => expect(st({ anchor: 1 }).cursor).toEqual({ anchor: 1 }))
    it('keeps null', () => expect(st(null).cursor).toBeNull())
    it('drops oversized buffer', () => {
      expect(sanitizeAwarenessMessage(new Uint8Array(MAX_AWARENESS_BYTES + 1))).toBeNull()
    })
  })
  it('garbage null', () => {
    expect(sanitizeAwarenessMessage(new Uint8Array([9, 9]))).toBeNull()
    expect(sanitizeAwarenessMessage(new Uint8Array([1, 5, 1]))).toBeNull()
    expect(sanitizeAwarenessMessage(new Uint8Array([]))).toBeNull()
  })
})

import * as decoding from 'lib0/decoding'
function inner(buf: Uint8Array): Uint8Array {
  const d = decoding.createDecoder(buf)
  decoding.readVarUint(d)
  return decoding.readVarUint8Array(d)
}
function await_decode(buf: Uint8Array): Awareness {
  const aw = new Awareness(new Y.Doc())
  applyAwarenessUpdate(aw, inner(buf), 'x')
  return aw
}

describe('sanitizeAwarenessMessage accept', () => {
  function multi(ids: number[]): Uint8Array {
    const inner = encoding.createEncoder()
    encoding.writeVarUint(inner, ids.length)
    for (const id of ids) {
      encoding.writeVarUint(inner, id)
      encoding.writeVarUint(inner, 1)
      encoding.writeVarString(inner, JSON.stringify({ user: { name: 'A', color: 'var(--peer-1)' } }))
    }
    const e = encoding.createEncoder()
    encoding.writeVarUint(e, 1)
    encoding.writeVarUint8Array(e, encoding.toUint8Array(inner))
    return encoding.toUint8Array(e)
  }
  function idsOf(buf: Uint8Array): number[] {
    const d = decoding.createDecoder(inner(buf))
    const n = decoding.readVarUint(d)
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      out.push(decoding.readVarUint(d))
      decoding.readVarUint(d)
      decoding.readVarString(d)
    }
    return out
  }
  it('drops rejected ids', () => {
    const out = sanitizeAwarenessMessage(multi([7, 8]), (id) => id !== 7)
    expect(idsOf(out!)).toEqual([8])
  })
  it('calls accept only after state validation, with removal flag', () => {
    const calls: Array<[number, boolean]> = []
    const e0 = encoding.createEncoder()
    encoding.writeVarUint(e0, 2)
    for (const [id, raw] of [[1, '{bad'], [2, 'null']] as const) {
      encoding.writeVarUint(e0, id)
      encoding.writeVarUint(e0, 1)
      encoding.writeVarString(e0, raw)
    }
    const e = encoding.createEncoder()
    encoding.writeVarUint(e, 1)
    encoding.writeVarUint8Array(e, encoding.toUint8Array(e0))
    sanitizeAwarenessMessage(encoding.toUint8Array(e), (id, removal) => (calls.push([id, removal]), true))
    expect(calls).toEqual([[2, true]])
  })
  it('null when all rejected', () => {
    expect(sanitizeAwarenessMessage(multi([7]), () => false)).toBeNull()
  })
})
