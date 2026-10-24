import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizeWs, handleApi, _resetAuthCache } from './api.js'
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
