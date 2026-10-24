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
})
