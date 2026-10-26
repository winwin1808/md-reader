import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizeWs, handleApi, _resetAuthCache, _authCacheSize } from './api.js'
import { handleRequest } from './index.js'
import { MemoryTokenStore } from './tokens.js'

let t = 1_000_000
const now = () => t

function req(method: string, path: string, opts: { bearer?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {}
  if (opts.bearer !== undefined) headers.authorization = `Bearer ${opts.bearer}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  return new Request(`http://x${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
}

async function setup() {
  const store = new MemoryTokenStore(now)
  const res = await handleApi(req('POST', '/api/rooms'), store)
  const room = (await res!.json()) as { roomId: string; ownerToken: string }
  return { store, ...room }
}

beforeEach(() => {
  t = 1_000_000
  _resetAuthCache()
})

describe('handleApi', () => {
  it('returns null for non-api paths', async () => {
    expect(await handleApi(req('GET', '/parties/x'), new MemoryTokenStore(now))).toBeNull()
  })

  it('health and unknown api routes', async () => {
    const s = new MemoryTokenStore(now)
    const h = await handleApi(req('GET', '/api/health'), s)
    expect(h!.status).toBe(200)
    expect(await h!.json()).toEqual({ ok: true })
    expect((await handleApi(req('GET', '/api/nope'), s))!.status).toBe(404)
  })

  it('creates a room (201)', async () => {
    const store = new MemoryTokenStore(now)
    const res = (await handleApi(req('POST', '/api/rooms'), store))!
    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toContain('application/json')
    const b = (await res.json()) as { roomId: string; ownerToken: string }
    expect(b.roomId).toBeTruthy()
    expect(b.ownerToken).toBeTruthy()
  })

  it('creates a view link with 43-char token', async () => {
    const { store, roomId, ownerToken } = await setup()
    const res = (await handleApi(
      req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body: { role: 'view', expiresIn: null } }),
      store,
    ))!
    expect(res.status).toBe(201)
    const l = (await res.json()) as { token: string; role: string }
    expect(l.token).toHaveLength(43)
    expect(l.role).toBe('view')
  })

  it('GET links: 401 without/with wrong bearer, 200 with owner and token empty', async () => {
    const { store, roomId, ownerToken } = await setup()
    await handleApi(
      req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body: { role: 'view', expiresIn: null } }),
      store,
    )
    expect((await handleApi(req('GET', `/api/rooms/${roomId}/links`), store))!.status).toBe(401)
    expect((await handleApi(req('GET', `/api/rooms/${roomId}/links`, { bearer: 'bad' }), store))!.status).toBe(401)
    const ok = (await handleApi(req('GET', `/api/rooms/${roomId}/links`, { bearer: ownerToken }), store))!
    expect(ok.status).toBe(200)
    const list = (await ok.json()) as { token: string }[]
    expect(list).toHaveLength(1)
    expect(list[0]!.token).toBe('')
  })

  it('unknown room with wrong bearer is 401 (no existence leak)', async () => {
    const { store } = await setup()
    expect((await handleApi(req('GET', '/api/rooms/nope/links', { bearer: 'x' }), store))!.status).toBe(401)
  })

  it('room vanished but owner valid is 404', async () => {
    const { store, roomId, ownerToken } = await setup()
    vi.spyOn(store, 'createLink').mockRejectedValue(new (await import('./tokens.js')).RoomNotFoundError('x'))
    const res = await handleApi(
      req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body: { role: 'view', expiresIn: null } }),
      store,
    )
    expect(res!.status).toBe(404)
  })

  it('DELETE prefix -> 204 then resolve -> 410; no match -> 404', async () => {
    const { store, roomId, ownerToken } = await setup()
    const link = (await (
      await handleApi(
        req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body: { role: 'edit', expiresIn: null } }),
        store,
      )
    )!.json()) as { token: string; tokenPrefix: string }
    expect((await handleApi(req('GET', `/api/s/${link.token}`), store))!.status).toBe(200)
    const del = (await handleApi(req('DELETE', `/api/rooms/${roomId}/links/${link.tokenPrefix}`, { bearer: ownerToken }), store))!
    expect(del.status).toBe(204)
    const gone = (await handleApi(req('GET', `/api/s/${link.token}`), store))!
    expect(gone.status).toBe(410)
    expect(await gone.json()).toEqual({ error: 'link expired or revoked' })
    const none = (await handleApi(req('DELETE', `/api/rooms/${roomId}/links/zzzzzz`, { bearer: ownerToken }), store))!
    expect(none.status).toBe(404)
  })

  it('resolve returns roomId, role, title null; expired link -> 410', async () => {
    const { store, roomId, ownerToken } = await setup()
    const link = (await (
      await handleApi(
        req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body: { role: 'view', expiresIn: 1000 } }),
        store,
      )
    )!.json()) as { token: string }
    const r = (await handleApi(req('GET', `/api/s/${link.token}`), store))!
    expect(await r.json()).toEqual({ roomId, role: 'view', title: null })
    t += 1001
    expect((await handleApi(req('GET', `/api/s/${link.token}`), store))!.status).toBe(410)
  })

  it('invalid body -> 400', async () => {
    const { store, roomId, ownerToken } = await setup()
    for (const body of [{ role: 'admin', expiresIn: null }, { role: 'view', expiresIn: 'x' }, { role: 'view' }]) {
      const res = await handleApi(req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body }), store)
      expect(res!.status).toBe(400)
    }
  })
})

describe('authorizeWs', () => {
  const wsReq = (token?: string) => new Request(`http://x/parties/doc-room/r1${token ? `?token=${token}` : ''}`)

  it('401 when token missing', async () => {
    const r = await authorizeWs(wsReq(), new MemoryTokenStore(now), now)
    expect(r).toBeInstanceOf(Response)
    expect((r as Response).status).toBe(401)
  })

  it('returns {roomId, role} and caches; revoke is stale for 60s (intentional), then 410', async () => {
    const { store, roomId, ownerToken } = await setup()
    const link = (await (
      await handleApi(
        req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body: { role: 'view', expiresIn: null } }),
        store,
      )
    )!.json()) as { token: string; tokenPrefix: string }
    const spy = vi.spyOn(store, 'resolve')
    expect(await authorizeWs(wsReq(link.token), store, now)).toEqual({ roomId, role: 'view' })
    expect(await authorizeWs(wsReq(link.token), store, now)).toEqual({ roomId, role: 'view' })
    expect(spy).toHaveBeenCalledTimes(1)
    await store.revoke(roomId, link.tokenPrefix)
    // Intentional: revocation takes up to 60 s to bite because of the auth cache.
    t += 59_000
    expect(await authorizeWs(wsReq(link.token), store, now)).toEqual({ roomId, role: 'view' })
    t += 2_000
    const r = (await authorizeWs(wsReq(link.token), store, now)) as Response
    expect(r.status).toBe(410)
  })

  it('negative results are cached too', async () => {
    const store = new MemoryTokenStore(now)
    const spy = vi.spyOn(store, 'resolve')
    expect(((await authorizeWs(wsReq('bad'), store, now)) as Response).status).toBe(410)
    expect(((await authorizeWs(wsReq('bad'), store, now)) as Response).status).toBe(410)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('hardening (8a2.5)', () => {
  async function link(store: MemoryTokenStore, roomId: string, ownerToken: string, body: unknown) {
    return (await handleApi(req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body }), store))!
  }

  it('malformed percent-encoding -> 400', async () => {
    const { store, roomId, ownerToken } = await setup()
    const a = (await handleApi(req('GET', '/api/s/%E0%A4%A'), store))!
    expect(a.status).toBe(400)
    expect(await a.json()).toEqual({ error: 'bad path' })
    expect((await handleApi(req('GET', '/api/rooms/%/links', { bearer: ownerToken }), store))!.status).toBe(400)
    expect((await handleApi(req('DELETE', `/api/rooms/${roomId}/links/%`, { bearer: ownerToken }), store))!.status).toBe(400)
  })

  it('owner of room A cannot touch room B', async () => {
    const a = await setup()
    const b = await setup()
    expect((await handleApi(req('GET', `/api/rooms/${b.roomId}/links`, { bearer: a.ownerToken }), a.store))!.status).toBe(401)
    expect((await handleApi(req('POST', `/api/rooms/${b.roomId}/links`, { bearer: a.ownerToken, body: { role: 'view', expiresIn: null } }), a.store))!.status).toBe(401)
    expect((await handleApi(req('DELETE', `/api/rooms/${b.roomId}/links/abcdef`, { bearer: a.ownerToken }), a.store))!.status).toBe(401)
  })

  it('second DELETE of same prefix -> 404; resolve body keys', async () => {
    const { store, roomId, ownerToken } = await setup()
    const l = (await (await link(store, roomId, ownerToken, { role: 'view', expiresIn: null })).json()) as { token: string; tokenPrefix: string }
    const r = (await handleApi(req('GET', `/api/s/${l.token}`), store))!
    expect(Object.keys(await r.json())).toEqual(['roomId', 'role', 'title'])
    const d = () => handleApi(req('DELETE', `/api/rooms/${roomId}/links/${l.tokenPrefix}`, { bearer: ownerToken }), store)
    expect((await d())!.status).toBe(204)
    expect((await d())!.status).toBe(404)
  })

  it('rejects bad expiresIn / label / oversize body', async () => {
    const { store, roomId, ownerToken } = await setup()
    for (const expiresIn of [-1, 0, 1.5, 1e999, '7', 10 * 365 * 86_400_000 + 1]) {
      const res = await handleApi(
        new Request(`http://x/api/rooms/${roomId}/links`, {
          method: 'POST',
          headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
          body: `{"role":"view","expiresIn":${typeof expiresIn === 'string' ? JSON.stringify(expiresIn) : String(expiresIn)}}`,
        }),
        store,
      )
      expect(res!.status, String(expiresIn)).toBe(400)
    }
    expect((await link(store, roomId, ownerToken, { role: 'view', expiresIn: 1, label: 'x'.repeat(121) })).status).toBe(400)
    expect((await link(store, roomId, ownerToken, { role: 'view', expiresIn: 1, label: 'x'.repeat(120) })).status).toBe(201)
    const big = await link(store, roomId, ownerToken, { role: 'view', expiresIn: null, label: 'x'.repeat(5000) })
    expect(big.status).toBe(413)
    const bad = await handleApi(
      new Request(`http://x/api/rooms/${roomId}/links`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` }, body: '{' }),
      store,
    )
    expect(bad!.status).toBe(400)
  })

  it('MemoryTokenStore listLinks newest first, ties by insertion desc', async () => {
    const { store, roomId } = await setup()
    const a = await store.createLink(roomId, { role: 'view', expiresIn: null })
    const b = await store.createLink(roomId, { role: 'view', expiresIn: null })
    expect((await store.listLinks(roomId)).map((l) => l.tokenPrefix)).toEqual([b.tokenPrefix, a.tokenPrefix])
  })

  it('authCache is capped', async () => {
    const store = new MemoryTokenStore(now)
    for (let i = 0; i < 6000; i++) {
      await authorizeWs(new Request(`http://x/parties/doc-room/r?token=t${i}`), store, now)
    }
    expect(_authCacheSize()).toBeLessThanOrEqual(5000)
  })

  it('handleRequest: bad roomId encoding -> 400 before routeParty', async () => {
    const routeParty = vi.fn(async () => new Response('x'))
    const res = await handleRequest(new Request('http://x/parties/doc-room/%?token=x'), {} as never, {
      routeParty,
      store: new MemoryTokenStore(now),
    })
    expect(res.status).toBe(400)
    expect(routeParty).not.toHaveBeenCalled()
  })

  describe('x-mdr-internal header', () => {
    it('client header is stripped; snapshot route adds it', async () => {
      const store = new MemoryTokenStore(now)
      const room = await store.createRoom()
      const link = await store.createLink(room.roomId, { role: 'view', expiresIn: null })
      const seen: Request[] = []
      const routeParty = vi.fn(async (r: Request) => {
        seen.push(r)
        return new Response('x')
      })
      await handleRequest(
        new Request(`http://x/parties/doc-room/${room.roomId}?token=${link.token}`, { headers: { 'x-mdr-internal': '1' } }),
        {} as never,
        { routeParty: routeParty as never, store },
      )
      expect(seen[0]!.headers.get('x-mdr-internal')).toBeNull()
      await handleRequest(new Request(`http://x/api/s/${link.token}/snapshot`), {} as never, {
        routeParty: routeParty as never,
        store,
      })
      const snap = seen[1]!
      expect(snap.headers.get('x-mdr-internal')).toBe('1')
      expect(new URL(snap.url).pathname).toBe(`/parties/doc-room/${room.roomId}/snapshot`)
    })
  })

  describe('snapshot', () => {
    async function setup() {
      const store = new MemoryTokenStore(now)
      const room = await store.createRoom()
      const link = await store.createLink(room.roomId, { role: 'view', expiresIn: null })
      return { store, room, link }
    }
    const bytes = new Uint8Array([1, 2, 3])
    const okSnap = () => new Response(bytes, { status: 200, headers: { 'content-type': 'application/octet-stream' } })

    it('valid token -> 200 octet-stream with bytes', async () => {
      const { store, room, link } = await setup()
      const snapshot = vi.fn(async (_id: string) => okSnap())
      const res = await handleApi(new Request(`http://x/api/s/${link.token}/snapshot`), store, { snapshot })
      expect(res!.status).toBe(200)
      expect(res!.headers.get('content-type')).toBe('application/octet-stream')
      expect([...new Uint8Array(await res!.arrayBuffer())]).toEqual([1, 2, 3])
      expect(snapshot).toHaveBeenCalledWith(room.roomId)
    })
    it('unknown token -> 410, snapshot not called', async () => {
      const { store } = await setup()
      const snapshot = vi.fn(async (_id: string) => okSnap())
      const res = await handleApi(new Request('http://x/api/s/nope/snapshot'), store, { snapshot })
      expect(res!.status).toBe(410)
      expect(snapshot).not.toHaveBeenCalled()
    })
    it('missing deps.snapshot -> 501', async () => {
      const { store, link } = await setup()
      const res = await handleApi(new Request(`http://x/api/s/${link.token}/snapshot`), store)
      expect(res!.status).toBe(501)
    })
    it('handleRequest: snapshot path on party route -> 404, routeParty not called', async () => {
      const { store, room, link } = await setup()
      const routeParty = vi.fn(async () => new Response('x'))
      const res = await handleRequest(
        new Request(`http://x/parties/doc-room/${room.roomId}/snapshot?token=${link.token}`, {
          headers: { 'x-mdr-internal': '1' },
        }),
        {} as never,
        { routeParty, store },
      )
      expect(res.status).toBe(404)
      expect(routeParty).not.toHaveBeenCalled()
    })
  })
})

describe('handleApi limits', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])
  const mk = async () => {
    const { MemoryLimitStore } = await import('./limits.js')
    const { MemoryAssetStore } = await import('./assets.js')
    return { store: new MemoryTokenStore(now), limits: new MemoryLimitStore(now), assets: new MemoryAssetStore() }
  }
  const post = (headers: Record<string, string> = {}) =>
    new Request('http://x/api/rooms', { method: 'POST', headers })

  it('21st room from one install is 429 with retry-after', async () => {
    const { store, limits } = await mk()
    const h = { 'x-mdr-install': 'i'.repeat(20) }
    for (let i = 0; i < 20; i++) expect((await handleApi(post(h), store, { limits }))!.status).toBe(201)
    const r = (await handleApi(post(h), store, { limits }))!
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBeTruthy()
    const b = (await r.json()) as { error: string; retryAfter: number }
    expect(b.error).toBe('RATE_LIMITED')
    expect(b.retryAfter).toBeGreaterThan(0)
  })

  it('51st room from one IP without install header is 429', async () => {
    const { store, limits } = await mk()
    const h = { 'CF-Connecting-IP': '1.2.3.4' }
    for (let i = 0; i < 50; i++) expect((await handleApi(post(h), store, { limits }))!.status).toBe(201)
    expect((await handleApi(post(h), store, { limits }))!.status).toBe(429)
  })

  it('asset upload 429 after 100/day; 403 does not consume quota', async () => {
    const { store, limits, assets } = await mk()
    const h = { 'x-mdr-install': 'j'.repeat(20) }
    const room = (await (await handleApi(post(h), store, { limits }))!.json()) as { roomId: string; ownerToken: string }
    const up = (bearer: string) =>
      new Request(`http://x/api/rooms/${room.roomId}/assets`, {
        method: 'POST',
        headers: { authorization: `Bearer ${bearer}`, 'content-type': 'image/png', ...h },
        body: PNG,
      })
    for (let i = 0; i < 5; i++) expect((await handleApi(up('bad'), store, { limits, assets }))!.status).toBe(403)
    for (let i = 0; i < 100; i++) expect((await handleApi(up(room.ownerToken), store, { limits, assets }))!.status).toBe(201)
    const r = (await handleApi(up(room.ownerToken), store, { limits, assets }))!
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBeTruthy()
  })
})

describe('DELETE /api/rooms/:roomId (10e.2)', () => {
  const mk = async () => {
    const { MemoryLimitStore } = await import('./limits.js')
    const { MemoryAssetStore } = await import('./assets.js')
    return { limits: new MemoryLimitStore(now), assets: new MemoryAssetStore() }
  }

  it('owner deletes: 204, links die, other room intact, purge called', async () => {
    const { store, roomId, ownerToken } = await setup()
    const other = await store.createRoom()
    const edit = await store.createLink(roomId, { role: 'edit', expiresIn: null })
    const view = await store.createLink(roomId, { role: 'view', expiresIn: null })
    const purge = vi.fn(async () => {})
    const deps = { ...(await mk()), purge }
    const res = (await handleApi(req('DELETE', `/api/rooms/${roomId}`, { bearer: ownerToken }), store, deps))!
    expect(res.status).toBe(204)
    expect(purge).toHaveBeenCalledWith(roomId)
    expect((await handleApi(req('GET', `/api/s/${view.token}`), store))!.status).toBe(410)
    expect(
      (await handleApi(req('POST', `/api/rooms/${roomId}/links`, { bearer: ownerToken, body: { role: 'view', expiresIn: null } }), store))!.status,
    ).toBe(401)
    expect((await handleApi(req('DELETE', `/api/rooms/${roomId}`, { bearer: edit.token }), store))!.status).toBe(401)
    expect((await handleApi(req('GET', `/api/rooms/${other.roomId}/links`, { bearer: other.ownerToken }), store))!.status).toBe(200)
  })

  it('edit/view link cannot delete; unknown room 401', async () => {
    const { store, roomId } = await setup()
    const edit = await store.createLink(roomId, { role: 'edit', expiresIn: null })
    const purge = vi.fn(async () => {})
    expect((await handleApi(req('DELETE', `/api/rooms/${roomId}`, { bearer: edit.token }), store, { purge }))!.status).toBe(401)
    expect((await handleApi(req('DELETE', '/api/rooms/nope', { bearer: 'x' }), store, { purge }))!.status).toBe(401)
    expect(purge).not.toHaveBeenCalled()
  })

  it('purge failure still 204', async () => {
    const { store, roomId, ownerToken } = await setup()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const purge = vi.fn(async () => { throw new Error('boom') })
    const res = (await handleApi(req('DELETE', `/api/rooms/${roomId}`, { bearer: ownerToken }), store, { purge }))!
    expect(res.status).toBe(204)
    err.mockRestore()
  })

  it('clears authCache entries so old token is 410 immediately', async () => {
    const { store, roomId, ownerToken } = await setup()
    const link = await store.createLink(roomId, { role: 'edit', expiresIn: null })
    const wsReq = new Request(`http://x/parties/doc-room/${roomId}?token=${link.token}`)
    const first = await authorizeWs(wsReq, store, now)
    expect(first).toMatchObject({ roomId })
    expect(_authCacheSize()).toBe(1)
    await handleApi(req('DELETE', `/api/rooms/${roomId}`, { bearer: ownerToken }), store)
    expect(_authCacheSize()).toBe(0)
    expect(((await authorizeWs(wsReq, store, now)) as Response).status).toBe(410)
  })
})
