import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  CHUNK_BYTES,
  appendUpdate,
  compact,
  loadState,
  readStats,
  shouldCompact,
  type KVLike,
} from './persistence.js'

class MemoryKV implements KVLike {
  map = new Map<string, Uint8Array | string>()
  putsLeft = Infinity
  failAfterPuts(n: number) {
    this.putsLeft = n
  }
  async get(key: string) {
    return this.map.get(key)
  }
  async put(key: string, value: Uint8Array | string) {
    if (this.putsLeft <= 0) throw new Error('simulated crash')
    this.putsLeft--
    this.map.set(key, value)
  }
  async delete(key: string) {
    return this.map.delete(key)
  }
  async list(opts: { prefix: string }) {
    const out = new Map<string, Uint8Array | string>()
    for (const k of [...this.map.keys()].sort()) {
      if (k.startsWith(opts.prefix)) out.set(k, this.map.get(k)!)
    }
    return out
  }
}

function textOf(update: Uint8Array | null): string {
  const d = new Y.Doc()
  if (update) Y.applyUpdate(d, update)
  return d.getText('source').toString()
}

describe('persistence', () => {
  it('loadState rỗng → null', async () => {
    expect(await loadState(new MemoryKV())).toBeNull()
  })

  it('appendUpdate 3 lần rồi loadState', async () => {
    const kv = new MemoryKV()
    const doc = new Y.Doc()
    const ups: Uint8Array[] = []
    doc.on('update', (u: Uint8Array) => ups.push(u))
    doc.getText('source').insert(0, 'a')
    doc.getText('source').insert(1, 'b')
    doc.getText('source').insert(2, 'c')
    let stats = { updates: 0, bytes: 0 }
    for (const u of ups) stats = await appendUpdate(kv, u, stats)
    expect(stats.updates).toBe(3)
    expect(textOf(await loadState(kv))).toBe('abc')
    expect(await readStats(kv)).toEqual(stats)
  })

  it('shouldCompact', () => {
    expect(shouldCompact({ updates: 199, bytes: 0 }, false)).toBe(false)
    expect(shouldCompact({ updates: 200, bytes: 0 }, false)).toBe(true)
    expect(shouldCompact({ updates: 1, bytes: 262_143 }, false)).toBe(false)
    expect(shouldCompact({ updates: 1, bytes: 262_144 }, false)).toBe(true)
    expect(shouldCompact({ updates: 1, bytes: 10 }, true)).toBe(true)
    expect(shouldCompact({ updates: 0, bytes: 0 }, true)).toBe(false)
  })

  it('compact 2.5 MiB → 3 khúc, rồi 1 khúc', async () => {
    const kv = new MemoryKV()
    const doc = new Y.Doc()
    const big = 'xyz'.repeat(Math.ceil((2.5 * 1024 * 1024) / 3)).slice(0, 2.5 * 1024 * 1024)
    doc.getText('source').insert(0, big)
    let stats = await appendUpdate(kv, Y.encodeStateAsUpdate(doc), { updates: 0, bytes: 0 })
    expect(stats.bytes).toBeGreaterThan(CHUNK_BYTES)
    stats = await compact(kv, doc)
    expect(stats).toEqual({ updates: 0, bytes: 0 })
    expect(kv.map.has('snap:0:0') && kv.map.has('snap:0:1') && kv.map.has('snap:0:2')).toBe(true)
    expect(kv.map.has('snap:0:3')).toBe(false)
    expect(JSON.parse(kv.map.get('snap:meta') as string).chunks).toBe(3)
    expect((await kv.list({ prefix: 'u:' })).size).toBe(0)
    expect(textOf(await loadState(kv))).toBe(big)

    const doc2 = new Y.Doc()
    doc2.getText('source').insert(0, 'short')
    await compact(kv, doc2)
    expect(kv.map.has('snap:0:1')).toBe(false)
    expect(kv.map.has('snap:0:2')).toBe(false)
    expect(textOf(await loadState(kv))).toBe('short')
  })

  it('meta có nhưng thiếu khúc → bỏ snapshot, vẫn áp u:*', async () => {
    const kv = new MemoryKV()
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'hello')
    await compact(kv, doc)
    kv.map.delete('snap:0:0')
    const d2 = new Y.Doc()
    d2.getText('source').insert(0, 'zzz')
    await appendUpdate(kv, Y.encodeStateAsUpdate(d2), { updates: 0, bytes: 0 })
    expect(textOf(await loadState(kv))).toBe('zzz')
  })

  it('giá trị string ở u:* → throw', async () => {
    const kv = new MemoryKV()
    kv.map.set('u:000000000000', 'oops')
    await expect(loadState(kv)).rejects.toThrow(/Uint8Array/)
  })

  it('torn multi-chunk: compact bị cắt giữa chừng giữ nguyên gen cũ', async () => {
    const kv = new MemoryKV()
    const doc = new Y.Doc()
    const big = 'xyz'.repeat(Math.ceil((2.5 * 1024 * 1024) / 3)).slice(0, 2.5 * 1024 * 1024)
    doc.getText('source').insert(0, big)
    await compact(kv, doc)
    const doc2 = new Y.Doc()
    doc2.getText('source').insert(0, 'short')
    kv.failAfterPuts(1) // khúc gen mới ghi xong, meta thì không
    await expect(compact(kv, doc2)).rejects.toThrow(/simulated/)
    expect(textOf(await loadState(kv))).toBe(big)
    kv.failAfterPuts(Infinity)
    await compact(kv, doc2)
    expect(textOf(await loadState(kv))).toBe('short')
    const keys = [...(await kv.list({ prefix: 'snap:' })).keys()]
    expect(keys.sort()).toEqual(['snap:1:0', 'snap:meta'].sort())
  })

  it('meta không có gen → coi như không có snapshot', async () => {
    const kv = new MemoryKV()
    kv.map.set('snap:meta', JSON.stringify({ chunks: 1, bytes: 3 }))
    kv.map.set('snap:0', new Uint8Array([1, 2, 3]))
    expect(await loadState(kv)).toBeNull()
  })

  it('seq qua ranh giới chữ số; readStats dùng max seq', async () => {
    const kv = new MemoryKV()
    const doc = new Y.Doc()
    const ups: Uint8Array[] = []
    doc.on('update', (u: Uint8Array) => ups.push(u))
    const letters = 'abcdefghijkl'
    for (let i = 0; i < 12; i++) doc.getText('source').insert(i, letters[i]!)
    let stats = { updates: 0, bytes: 0 }
    for (const u of ups) stats = await appendUpdate(kv, u, stats)
    expect(textOf(await loadState(kv))).toBe(letters)
    kv.map.delete('u:000000000000')
    expect((await readStats(kv)).updates).toBe(12)
  })
})
