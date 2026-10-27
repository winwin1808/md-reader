import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleRequest } from './index.js'
import { _resetAuthCache } from './api.js'
import { MemoryTokenStore } from './tokens.js'
import type { Env } from './env.js'

const env = {} as Env
const ok = () => Promise.resolve(new Response('party', { status: 200 }))

async function twoRooms() {
  const store = new MemoryTokenStore()
  const a = await store.createRoom()
  const b = await store.createRoom()
  const view = await store.createLink(a.roomId, { role: 'view', expiresIn: null })
  return { store, a, b, view }
}

beforeEach(() => _resetAuthCache())

describe('handleRequest', () => {
  it('health returns 200 ok', async () => {
    const res = await handleRequest(new Request('http://x/api/health'), env, {
      routeParty: ok,
      store: new MemoryTokenStore(),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects room without token before touching the DO', async () => {
    const routeParty = vi.fn(ok)
    const res = await handleRequest(new Request('http://x/parties/doc-room/r1'), env, {
      routeParty,
      store: new MemoryTokenStore(),
    })
    expect(res.status).toBe(401)
    expect(routeParty).not.toHaveBeenCalled()
  })

  it('rejects unknown token (410) before the DO', async () => {
    const routeParty = vi.fn(ok)
    const res = await handleRequest(new Request('http://x/parties/doc-room/r1?token=bad'), env, {
      routeParty,
      store: new MemoryTokenStore(),
    })
    expect(res.status).toBe(410)
    expect(routeParty).not.toHaveBeenCalled()
  })

  it('token of room A cannot open room B (403)', async () => {
    const { store, a, b } = await twoRooms()
    const routeParty = vi.fn(ok)
    const res = await handleRequest(
      new Request(`http://x/parties/doc-room/${b.roomId}?token=${a.ownerToken}`),
      env,
      { routeParty, store },
    )
    expect(res.status).toBe(403)
    expect(routeParty).not.toHaveBeenCalled()
  })

  it.each([undefined, 'edit', 'view'])('overwrites x-mdr-role with the token role (client sent %s)', async (sent) => {
    const { store, a, view } = await twoRooms()
    const routeParty = vi.fn(ok)
    const headers: Record<string, string> = {}
    if (sent) headers['x-mdr-role'] = sent
    const res = await handleRequest(
      new Request(`http://x/parties/doc-room/${a.roomId}?token=${view.token}`, { headers }),
      env,
      { routeParty, store },
    )
    expect(res.status).toBe(200)
    const forwarded = (routeParty.mock.calls as unknown as [Request, Env][])[0]![0]
    expect(forwarded.headers.get('x-mdr-role')).toBe('view')
  })

  it('forwards the real prefix/expiry and ignores client-sent x-mdr-prefix/x-mdr-expires', async () => {
    const { store, a, view } = await twoRooms()
    const routeParty = vi.fn(ok)
    await handleRequest(
      new Request(`http://x/parties/doc-room/${a.roomId}?token=${view.token}`, {
        headers: { 'x-mdr-prefix': 'evil', 'x-mdr-expires': '1' },
      }),
      env,
      { routeParty, store },
    )
    const forwarded = (routeParty.mock.calls as unknown as [Request, Env][])[0]![0]
    expect(forwarded.headers.get('x-mdr-prefix')).toBe(view.tokenPrefix)
    expect(forwarded.headers.get('x-mdr-expires') ?? '').toBe('')
  })

  it('owner token gets role edit', async () => {
    const { store, a } = await twoRooms()
    const routeParty = vi.fn(ok)
    await handleRequest(new Request(`http://x/parties/doc-room/${a.roomId}?token=${a.ownerToken}`), env, {
      routeParty,
      store,
    })
    const forwarded = (routeParty.mock.calls as unknown as [Request, Env][])[0]![0]
    expect(forwarded.headers.get('x-mdr-role')).toBe('edit')
  })

  it('404 when routeParty returns null', async () => {
    const { store, a } = await twoRooms()
    const res = await handleRequest(new Request(`http://x/parties/doc-room/${a.roomId}?token=${a.ownerToken}`), env, {
      routeParty: () => Promise.resolve(null),
      store,
    })
    expect(res.status).toBe(404)
  })

  it('404 for other parties and unknown paths', async () => {
    const routeParty = vi.fn(ok)
    const store = new MemoryTokenStore()
    const a = await handleRequest(new Request('http://x/parties/other/r1?token=t'), env, { routeParty, store })
    expect(a.status).toBe(404)
    const b = await handleRequest(new Request('http://x/nope'), env, { routeParty, store })
    expect(b.status).toBe(404)
    expect(await b.json()).toEqual({ error: 'not found' })
    expect(routeParty).not.toHaveBeenCalled()
  })
})

describe('CORS', () => {
  it('OPTIONS preflight returns 204 without touching store', async () => {
    const store = new MemoryTokenStore()
    const spy = vi.spyOn(store, 'createRoom')
    const routeParty = vi.fn(ok)
    const res = await handleRequest(
      new Request('http://x/api/rooms/abc/links', { method: 'OPTIONS' }),
      env,
      { routeParty, store },
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS')
    expect(res.headers.get('access-control-allow-headers')).toBe('authorization, content-type, x-mdr-install')
    expect(res.headers.get('access-control-max-age')).toBe('86400')
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    expect(routeParty).not.toHaveBeenCalled()
  })

  it('POST /api/rooms carries ACAO *', async () => {
    const res = await handleRequest(new Request('http://x/api/rooms', { method: 'POST' }), env, {
      routeParty: ok,
      store: new MemoryTokenStore(),
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-expose-headers')).toBe('content-type, retry-after')
  })

  it('401 from GET links carries ACAO *', async () => {
    const res = await handleRequest(new Request('http://x/api/rooms/abc/links'), env, {
      routeParty: ok,
      store: new MemoryTokenStore(),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('parties path has no ACAO', async () => {
    const res = await handleRequest(new Request('http://x/parties/doc-room/x'), env, {
      routeParty: ok,
      store: new MemoryTokenStore(),
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('CORS on errors and passthrough', () => {
  it('thrown store error becomes 500 with ACAO * and no error text', async () => {
    const store = new MemoryTokenStore()
    const boom = 'secret-db-failure-xyz'
    vi.spyOn(store, 'listLinks').mockRejectedValue(new Error(boom))
    vi.spyOn(store, 'verifyOwner').mockRejectedValue(new Error(boom))
    const res = await handleRequest(
      new Request('http://x/api/rooms/r/links', { headers: { authorization: 'Bearer owner-tok' } }),
      env,
      { routeParty: ok, store },
    )
    expect(res.status).toBe(500)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    const text = await res.text()
    expect(text).not.toContain(boom)
    expect(JSON.parse(text)).toEqual({ error: 'internal' })
  })

  it('snapshot passes octet-stream bytes with ACAO *', async () => {
    const { store, a, view } = await twoRooms()
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    const routeParty = vi.fn(() =>
      Promise.resolve(new Response(bytes, { status: 200, headers: { 'content-type': 'application/octet-stream' } })),
    )
    const res = await handleRequest(new Request(`http://x/api/s/${view.token}/snapshot`), env, { routeParty, store })
    expect(a.roomId).toBeTruthy()
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
  })

  it('unknown /api path is 404 with ACAO *', async () => {
    const res = await handleRequest(new Request('http://x/api/nope'), env, {
      routeParty: ok,
      store: new MemoryTokenStore(),
    })
    expect(res.status).toBe(404)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('asset upload is wired to D1 (not 501)', async () => {
    const store = new MemoryTokenStore()
    const room = await store.createRoom()
    const stmt: any = {
      bind: () => stmt,
      first: async () => ({ n: 0, total: 0 }),
      all: async () => ({ results: [] }),
      run: async () => ({}),
    }
    const db = { prepare: () => stmt, batch: async () => [] } as unknown as Env['DB']
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const res = await handleRequest(
      new Request(`http://x/api/rooms/${room.roomId}/assets`, {
        method: 'POST',
        headers: { authorization: `Bearer ${room.ownerToken}`, 'content-type': 'image/png' },
        body: png,
      }),
      { DB: db } as Env,
      { routeParty: ok, store },
    )
    expect(res.status).not.toBe(501)
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/rooms/:roomId', () => {
  it('purges the DO via internal POST route', async () => {
    const store = new MemoryTokenStore()
    const room = await store.createRoom()
    const stmt = {
      bind: () => stmt,
      run: async () => ({}),
      all: async () => ({ results: [] }),
    }
    const db = { prepare: () => stmt, batch: async () => [] }
    const seen: Request[] = []
    const routeParty = vi.fn(async (r: Request) => {
      seen.push(r)
      return new Response(null, { status: 204 })
    })
    const res = await handleRequest(
      new Request(`http://x/api/rooms/${room.roomId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${room.ownerToken}` },
      }),
      { DB: db } as unknown as Env,
      { routeParty: routeParty as never, store },
    )
    expect(res.status).toBe(204)
    expect(seen).toHaveLength(1)
    expect(seen[0]!.method).toBe('POST')
    expect(seen[0]!.headers.get('x-mdr-internal')).toBe('1')
    expect(new URL(seen[0]!.url).pathname).toBe(`/parties/doc-room/${room.roomId}/purge`)
  })

  it('external /purge never reaches routeParty', async () => {
    const { store, a } = await twoRooms()
    const edit = await store.createLink(a.roomId, { role: 'edit', expiresIn: null })
    const routeParty = vi.fn(ok)
    const res = await handleRequest(
      new Request(`http://x/parties/doc-room/${a.roomId}/purge?token=${edit.token}`, {
        method: 'POST',
        headers: { 'x-mdr-internal': '1' },
      }),
      env,
      { routeParty, store },
    )
    expect(res.status).toBe(404)
    expect(routeParty).not.toHaveBeenCalled()
  })
})

describe('revokeLive status', () => {
  it('DO 500 on /revoke -> route returns 502', async () => {
    const store = new MemoryTokenStore()
    const room = await store.createRoom()
    const link = await store.createLink(room.roomId, { role: 'view', expiresIn: null })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const routeParty = vi.fn(async () => new Response('err', { status: 500 }))
    const res = await handleRequest(
      new Request(`http://x/api/rooms/${room.roomId}/links/${link.tokenPrefix}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${room.ownerToken}` },
      }),
      env,
      { routeParty, store },
    )
    expect(res.status).toBe(502)
    spy.mockRestore()
  })
})
