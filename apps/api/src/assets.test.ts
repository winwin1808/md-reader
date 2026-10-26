import { describe, expect, it } from 'vitest'
import { MAX_ASSET_BYTES, ROOM_ASSET_QUOTA } from '@md-reader/core'
import { handleApi } from './api.js'
import { D1AssetStore, MemoryAssetStore } from './assets.js'
import { MemoryTokenStore } from './tokens.js'

const PNG = [0x89, 0x50, 0x4e, 0x47, 1, 2, 3]

function up(room: string, token: string | undefined, type: string, body: Uint8Array) {
  const headers: Record<string, string> = { 'content-type': type }
  if (token) headers.authorization = `Bearer ${token}`
  return new Request(`http://x/api/rooms/${room}/assets`, { method: 'POST', headers, body })
}

async function setup() {
  const store = new MemoryTokenStore()
  const assets = new MemoryAssetStore()
  const room = (await (await handleApi(new Request('http://x/api/rooms', { method: 'POST' }), store))!.json()) as {
    roomId: string
    ownerToken: string
  }
  const mk = async (role: 'view' | 'edit') =>
    ((await store.createLink(room.roomId, { role, expiresIn: null })) as { token: string }).token
  return { store, assets, ...room, mk }
}

describe('asset upload', () => {
  it('edit link uploads and GET serves same bytes with headers', async () => {
    const { store, assets, roomId, mk } = await setup()
    const bytes = new Uint8Array(PNG)
    const r = (await handleApi(up(roomId, await mk('edit'), 'image/png', bytes), store, { assets }))!
    expect(r.status).toBe(201)
    const b = (await r.json()) as { id: string; url: string; size: number; mime: string }
    expect(b.url).toBe(`http://x/api/a/${b.id}`)
    expect(b.size).toBe(bytes.length)
    const g = (await handleApi(new Request(b.url), store, { assets }))!
    expect(g.status).toBe(200)
    expect(new Uint8Array(await g.arrayBuffer())).toEqual(bytes)
    expect(g.headers.get('content-type')).toBe('image/png')
    expect(g.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(g.headers.get('x-content-type-options')).toBe('nosniff')
    expect(g.headers.get('content-security-policy')).toBe("default-src 'none'")
    expect((await handleApi(new Request('http://x/api/a/nope'), store, { assets }))!.status).toBe(404)
  })

  it('view link 403, owner 201', async () => {
    const { store, assets, roomId, ownerToken, mk } = await setup()
    const bytes = new Uint8Array(PNG)
    expect((await handleApi(up(roomId, await mk('view'), 'image/png', bytes), store, { assets }))!.status).toBe(403)
    expect((await handleApi(up(roomId, undefined, 'image/png', bytes), store, { assets }))!.status).toBe(403)
    expect((await handleApi(up(roomId, ownerToken, 'image/png', bytes), store, { assets }))!.status).toBe(201)
  })

  it('rejects bad mime and sniff mismatch with 415', async () => {
    const { store, assets, roomId, ownerToken } = await setup()
    const bytes = new Uint8Array(PNG)
    expect((await handleApi(up(roomId, ownerToken, 'image/svg+xml', bytes), store, { assets }))!.status).toBe(415)
    expect((await handleApi(up(roomId, ownerToken, 'image/jpeg', bytes), store, { assets }))!.status).toBe(415)
  })

  it('too large and quota 413', async () => {
    const { store, assets, roomId, ownerToken } = await setup()
    const big = new Uint8Array(MAX_ASSET_BYTES + 1)
    big.set(PNG)
    const r = (await handleApi(up(roomId, ownerToken, 'image/png', big), store, { assets }))!
    expect(r.status).toBe(413)
    expect(await r.json()).toEqual({ error: 'too_large' })
    const ok = new Uint8Array(MAX_ASSET_BYTES)
    ok.set(PNG)
    for (let i = 0; i < ROOM_ASSET_QUOTA / MAX_ASSET_BYTES; i++) await assets.put(roomId, 'image/png', ok)
    const q = (await handleApi(up(roomId, ownerToken, 'image/png', new Uint8Array(PNG)), store, { assets }))!
    expect(q.status).toBe(413)
    expect(await q.json()).toEqual({ error: 'quota' })
  })
})

function fakeD1() {
  const assets = new Map<string, { mime: string; size: number; room: string }>()
  const chunks: { id: string; idx: number; bytes: Uint8Array }[] = []
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    run: async () => {
      if (sql.startsWith('INSERT INTO assets')) assets.set(args[0] as string, { room: args[1] as string, mime: args[2] as string, size: args[3] as number })
      else chunks.push({ id: args[0] as string, idx: args[1] as number, bytes: args[2] as Uint8Array })
    },
    first: async () => {
      if (sql.includes('FROM assets WHERE id')) return assets.get(args[0] as string) ?? null
      return null
    },
    all: async () => ({
      results: chunks.filter((c) => c.id === args[0]).sort((a, b) => a.idx - b.idx).map((c) => ({ bytes: c.bytes })),
    }),
  })
  return {
    chunks,
    db: {
      prepare: (sql: string) => stmt(sql),
      batch: async (ss: { run: () => Promise<void> }[]) => {
        for (const s of ss) await s.run()
        return []
      },
    } as unknown as D1Database,
  }
}

describe('D1AssetStore', () => {
  it('splits 2.5 MiB into 3 chunks and reassembles', async () => {
    const { db, chunks } = fakeD1()
    const store = new D1AssetStore(db)
    const data = new Uint8Array(2.5 * 1024 * 1024).map((_, i) => i % 251)
    const { id } = await store.put('r', 'image/png', data)
    expect(chunks.length).toBe(3)
    const got = await store.get(id)
    expect(got!.mime).toBe('image/png')
    expect(got!.bytes).toEqual(data)
  })
})

describe('AssetStore.deleteRoom', () => {
  it('memory: removes only that room, returns count', async () => {
    const st = new MemoryAssetStore()
    const a1 = await st.put('A', 'image/png', new Uint8Array(PNG))
    const a2 = await st.put('A', 'image/png', new Uint8Array(PNG))
    const b = await st.put('B', 'image/png', new Uint8Array(PNG))
    expect(await st.deleteRoom('A')).toBe(2)
    expect(await st.get(a1.id)).toBeNull()
    expect(await st.get(a2.id)).toBeNull()
    expect(await st.roomUsage('A')).toBe(0)
    expect(await st.get(b.id)).not.toBeNull()
    expect(await st.deleteRoom('none')).toBe(0)
  })

  it('d1: selects ids then batches two deletes', async () => {
    const calls: { sql: string; args: unknown[] }[] = []
    let batched: string[] = []
    const stmt = (sql: string, args: unknown[] = []) => ({
      bind: (...a: unknown[]) => stmt(sql, a),
      all: async () => ({ results: sql.startsWith('SELECT id') ? [{ id: 'x' }, { id: 'y' }] : [] }),
      run: async () => {
        calls.push({ sql, args })
      },
    })
    const db = {
      prepare: (sql: string) => stmt(sql),
      batch: async (ss: { run: () => Promise<void> }[]) => {
        batched = []
        for (const s of ss) await s.run()
        batched = calls.map((c) => c.sql)
        return []
      },
    } as unknown as D1Database
    expect(await new D1AssetStore(db).deleteRoom('A')).toBe(2)
    expect(batched.length).toBe(2)
    expect(batched[0]).toContain('DELETE FROM asset_chunks')
    expect(batched[1]).toContain('DELETE FROM assets')
    expect(calls[0]?.args).toEqual(['A'])
  })
})
