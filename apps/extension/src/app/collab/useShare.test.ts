// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { __resetForTests, createRecord, getRecord, touchRecord } from '../doc-registry'
import { useShare } from './useShare'

const SERVER = 'https://x.test'
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const link = (token: string, prefix: string) => ({
  token, tokenPrefix: prefix, roomId: 'r1', role: 'view', label: '', createdAt: 1, expiresAt: null, revokedAt: null,
})

let fetchMock: any
let docId: string
let store: Record<string, any>

beforeEach(async () => {
  await __resetForTests()
  docId = (await createRecord({ title: 't', originKind: 'drop', originPath: null })).docId
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
  store = {}
  ;(globalThis as any).chrome = { storage: { local: {
    get: async (k: string) => (k in store ? { [k]: store[k] } : {}),
    set: async (o: Record<string, unknown>) => { Object.assign(store, o) },
    remove: async (k: string) => { delete store[k] },
  } } }
})

async function bound() {
  fetchMock.mockReturnValueOnce(json({ roomId: 'r1', ownerToken: 'own' }))
  const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
  await act(async () => { await h.result.current.enable() })
  return h
}

describe('useShare', () => {
  it('enable POSTs /api/rooms and persists room', async () => {
    const h = await bound()
    expect(fetchMock.mock.calls[0][0]).toBe(`${SERVER}/api/rooms`)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(h.result.current.binding).toEqual({ serverUrl: SERVER, roomId: 'r1', ownerToken: 'own' })
    expect((await getRecord(docId))?.room).toEqual({ serverUrl: SERVER, roomId: 'r1', ownerToken: 'own' })
  })

  it('enable when bound makes no request', async () => {
    const h = await bound()
    await act(async () => { await h.result.current.enable() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads stored binding on mount', async () => {
    await bound()
    const h2 = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    await waitFor(() => expect(h2.result.current.binding?.roomId).toBe('r1'))
  })

  it('refresh sends bearer to links path', async () => {
    const h = await bound()
    fetchMock.mockReturnValueOnce(json([link('', 'aaaa')]))
    await act(async () => { await h.result.current.refresh() })
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe(`${SERVER}/api/rooms/r1/links`)
    expect(init.headers.Authorization).toBe('Bearer own')
    expect(h.result.current.links).toHaveLength(1)
  })

  it('createLink prepends with token; refresh keeps token', async () => {
    const h = await bound()
    fetchMock.mockReturnValueOnce(json(link('SECRET', 'aaaa')))
    await act(async () => { await h.result.current.createLink({ role: 'view', expiresIn: null }) })
    expect(h.result.current.links[0]!.token).toBe('SECRET')
    fetchMock.mockReturnValueOnce(json([link('', 'bbbb'), link('', 'aaaa')]))
    await act(async () => { await h.result.current.refresh() })
    expect(h.result.current.links.map((l) => l.token)).toEqual(['', 'SECRET'])
  })

  it('cached full token fills listed link with empty token; created saved; revoked forgotten', async () => {
    const h = await bound()
    fetchMock.mockReturnValueOnce(json(link('SECRET', 'aaaa')))
    await act(async () => { await h.result.current.createLink({ role: 'view', expiresIn: null }) })
    expect(store['mdr.links.r1']).toEqual({ aaaa: 'SECRET' })
    store['mdr.links.r1'] = { aaaa: 'SECRET', cccc: 'CACHED' }
    const h2 = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    await waitFor(() => expect(h2.result.current.binding?.roomId).toBe('r1'))
    fetchMock.mockReturnValueOnce(json([link('', 'cccc')]))
    await act(async () => { await h2.result.current.refresh() })
    expect(h2.result.current.links[0]!.token).toBe('CACHED')
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response(null, { status: 204 })))
    await act(async () => { await h2.result.current.revoke('cccc') })
    expect(store['mdr.links.r1']).toEqual({ aaaa: 'SECRET' })
  })

  it('revoke DELETEs and removes row', async () => {
    const h = await bound()
    fetchMock.mockReturnValueOnce(json(link('S', 'aaaa')))
    await act(async () => { await h.result.current.createLink({ role: 'view', expiresIn: null }) })
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response(null, { status: 204 })))
    await act(async () => { await h.result.current.revoke('aaaa') })
    const [url, init] = fetchMock.mock.calls[2]
    expect(url).toBe(`${SERVER}/api/rooms/r1/links/aaaa`)
    expect(init.method).toBe('DELETE')
    expect(h.result.current.links).toEqual([])
    expect(h.result.current.error).toBeNull()
  })

  it('401 sets error and rejects', async () => {
    const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    fetchMock.mockReturnValueOnce(json({}, 401))
    await act(async () => {
      await expect(h.result.current.enable()).rejects.toThrow('Không có quyền với phòng này')
    })
    expect(h.result.current.error).toBe('Không có quyền với phòng này')
  })

  it('fetch throw maps message; other status maps', async () => {
    const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    fetchMock.mockRejectedValueOnce(new TypeError('boom'))
    await act(async () => {
      await expect(h.result.current.enable()).rejects.toThrow('Không kết nối được máy chủ')
    })
    fetchMock.mockReturnValueOnce(json({}, 500))
    await act(async () => {
      await expect(h.result.current.enable()).rejects.toThrow('Máy chủ trả lỗi 500')
    })
  })

  it('busy toggles', async () => {
    const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    let release!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { release = r }))
    let p!: Promise<unknown>
    act(() => { p = h.result.current.enable() })
    await waitFor(() => expect(h.result.current.busy).toBe(true))
    await act(async () => {
      release(new Response(JSON.stringify(({ roomId: 'r1', ownerToken: 'o' })), { status: 200 }))
      await p
    })
    expect(h.result.current.busy).toBe(false)
  })

  it('two enable() calls share one request', async () => {
    const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    let release!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { release = r }))
    let p1!: Promise<unknown>, p2!: Promise<unknown>
    act(() => { p1 = h.result.current.enable(); p2 = h.result.current.enable() })
    let out: unknown[] = []
    await act(async () => {
      release(new Response(JSON.stringify(({ roomId: 'r1', ownerToken: 'o' })), { status: 200 }))
      out = await Promise.all([p1, p2])
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(out[0]).toEqual(out[1])
  })

  it('drops stale enable result after doc change', async () => {
    const docB = (await createRecord({ title: 'b', originKind: 'drop', originPath: null })).docId
    let cur = docId
    const h = renderHook(() => useShare({ docId: cur, serverUrl: SERVER }))
    let release!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { release = r }))
    let p!: Promise<unknown>
    act(() => { p = h.result.current.enable() })
    cur = docB
    h.rerender()
    await act(async () => {
      release(new Response(JSON.stringify(({ roomId: 'r1', ownerToken: 'o' })), { status: 200 }))
      await p.catch(() => {})
    })
    expect(h.result.current.binding).toBeNull()
    expect((await getRecord(docId))?.room?.roomId).toBe('r1')
    expect((await getRecord(docB))?.room).toBeFalsy()
  })

  it('maps non-JSON 2xx to invalid-data error', async () => {
    const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response('<html>', { status: 200 })))
    await act(async () => {
      await expect(h.result.current.enable()).rejects.toThrow('Máy chủ trả dữ liệu không hợp lệ')
    })
    expect(h.result.current.error).toBe('Máy chủ trả dữ liệu không hợp lệ')
  })

  it('overlapping refresh and createLink keep busy until both finish', async () => {
    const h = await bound()
    let r1!: (r: Response) => void, r2!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { r1 = r }))
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { r2 = r }))
    let p1!: Promise<unknown>, p2!: Promise<unknown>
    act(() => {
      p1 = h.result.current.refresh()
      p2 = h.result.current.createLink({ role: 'view', expiresIn: null })
    })
    await waitFor(() => expect(h.result.current.busy).toBe(true))
    await act(async () => {
      r1(new Response('[]', { status: 200 }))
      await p1
    })
    expect(h.result.current.busy).toBe(true)
    await act(async () => {
      r2(new Response(JSON.stringify(link('S', 'aaaa')), { status: 200 }))
      await p2
    })
    expect(h.result.current.busy).toBe(false)
  })

  it('refresh resolving after createLink keeps the new link', async () => {
    const h = await bound()
    let r1!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { r1 = r }))
    fetchMock.mockReturnValueOnce(json(link('SECRET', 'aaaa')))
    let p1!: Promise<unknown>
    act(() => { p1 = h.result.current.refresh() })
    await act(async () => { await h.result.current.createLink({ role: 'view', expiresIn: null }) })
    await act(async () => {
      r1(new Response(JSON.stringify([link('', 'bbbb')]), { status: 200 }))
      await p1
    })
    expect(h.result.current.links.map((l) => [l.tokenPrefix, l.token])).toEqual([['aaaa', 'SECRET'], ['bbbb', '']])
  })

  it('refresh does not resurrect a revoked session link', async () => {
    const h = await bound()
    fetchMock.mockReturnValueOnce(json(link('S', 'aaaa')))
    await act(async () => { await h.result.current.createLink({ role: 'view', expiresIn: null }) })
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response(null, { status: 204 })))
    await act(async () => { await h.result.current.revoke('aaaa') })
    fetchMock.mockReturnValueOnce(json([]))
    await act(async () => { await h.result.current.refresh() })
    expect(h.result.current.links).toEqual([])
  })

  it('enable retries after a rejected attempt', async () => {
    const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
    fetchMock.mockRejectedValueOnce(new TypeError('boom'))
    await act(async () => { await expect(h.result.current.enable()).rejects.toThrow() })
    fetchMock.mockReturnValueOnce(json({ roomId: 'r1', ownerToken: 'own' }))
    await act(async () => { await h.result.current.enable() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(h.result.current.binding?.roomId).toBe('r1')
  })

  describe('current* sync reads', () => {
    it('currentLinks right after await refresh/revoke; currentBinding after enable', async () => {
      fetchMock.mockReturnValueOnce(json({ roomId: 'r1', ownerToken: 'own' }))
      const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
      const api = h.result.current as any
      let b: unknown, l1: unknown[] = [], l2: unknown[] = []
      await act(async () => {
        await api.enable()
        b = api.currentBinding()
        fetchMock.mockReturnValueOnce(json([link('', 'aaaa'), link('', 'bbbb')]))
        await api.refresh()
        l1 = api.currentLinks()
        fetchMock.mockReturnValueOnce(Promise.resolve(new Response(null, { status: 204 })))
        await api.revoke('aaaa')
        l2 = api.currentLinks()
      })
      expect(b).not.toBeNull()
      expect(l1).toHaveLength(2)
      expect((l2 as any[]).map((l) => l.tokenPrefix)).toEqual(['bbbb'])
    })
  })

  describe('revokeAll', () => {
    const noContent = () => Promise.resolve(new Response(null, { status: 204 }))
    async function withLinks() {
      const h = await bound()
      const list = [link('', 'aaaa'), link('', 'bbbb'), { ...link('', 'dead'), revokedAt: 5 }, link('', 'cccc')]
      fetchMock.mockReturnValueOnce(json(list))
      await act(async () => { await h.result.current.refresh() })
      return h
    }

    it('one POST revoke-all, no DELETE, marks all revoked and forgets tokens', async () => {
      const h = await withLinks()
      fetchMock.mockReturnValueOnce(json({ revoked: 3 }))
      fetchMock.mockReturnValueOnce(json({}, 500))
      await act(async () => { await h.result.current.revokeAll() })
      const calls = fetchMock.mock.calls.slice(2)
      expect(calls[0][0]).toBe(`${SERVER}/api/rooms/r1/links/revoke-all`)
      expect(calls[0][1].method).toBe('POST')
      expect(calls[0][1].headers.Authorization).toBe('Bearer own')
      expect(calls.some((c: any) => c[1]?.method === 'DELETE')).toBe(false)
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
    })

    it('502 retries once then succeeds', async () => {
      const h = await withLinks()
      fetchMock.mockReturnValueOnce(json({ error: 'REVOKE_LIVE_FAILED' }, 502)).mockReturnValueOnce(json({ revoked: 3 }))
      fetchMock.mockReturnValueOnce(json({}, 500))
      await act(async () => { await h.result.current.revokeAll() })
      const posts = fetchMock.mock.calls.filter((c: any) => String(c[0]).endsWith('/revoke-all'))
      expect(posts).toHaveLength(2)
      expect(h.result.current.error).toBeNull()
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
    })

    it('502 twice reports revokeFailed', async () => {
      const h = await withLinks()
      fetchMock.mockReturnValueOnce(json({}, 502)).mockReturnValueOnce(json({}, 502))
      await act(async () => { await expect(h.result.current.revokeAll()).rejects.toThrow('Còn 3 link chưa thu hồi được') })
      expect(fetchMock.mock.calls.filter((c: any) => c[1]?.method === 'DELETE')).toHaveLength(0)
      expect(h.result.current.links.filter((l) => l.revokedAt === null)).toHaveLength(3)
    })

    it('DELETEs active links in order, marks revoked, keeps binding', async () => {
      const h = await withLinks()
      const before = h.result.current.binding
      fetchMock.mockReturnValueOnce(json({}, 404))
      fetchMock.mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent())
      fetchMock.mockReturnValueOnce(json({}, 500)) // refresh fails; local state must stand
      await act(async () => { await h.result.current.revokeAll() })
      const urls = fetchMock.mock.calls.slice(3, 6).map((c: any) => c[0])
      expect(urls).toEqual([
        `${SERVER}/api/rooms/r1/links/aaaa`, `${SERVER}/api/rooms/r1/links/bbbb`, `${SERVER}/api/rooms/r1/links/cccc`,
      ])
      expect(fetchMock.mock.calls[3][1].method).toBe('DELETE')
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer own')
      expect(h.result.current.links).toHaveLength(4)
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
      expect(h.result.current.binding).toEqual(before)
      expect((await getRecord(docId))?.room).toEqual(before)
    })

    it('reports remaining count when a DELETE fails, keeps earlier successes', async () => {
      const h = await withLinks()
      fetchMock.mockReturnValueOnce(json({}, 404))
      fetchMock.mockReturnValueOnce(noContent()).mockReturnValueOnce(json({}, 500)).mockReturnValueOnce(json({}, 500))
      fetchMock.mockReturnValueOnce(json({}, 500))
      await act(async () => { await expect(h.result.current.revokeAll()).rejects.toThrow('Còn 2 link chưa thu hồi được') })
      expect(h.result.current.error).toBe('Còn 2 link chưa thu hồi được')
      expect(h.result.current.links.find((l) => l.tokenPrefix === 'aaaa')!.revokedAt).not.toBeNull()
      expect(h.result.current.links.find((l) => l.tokenPrefix === 'bbbb')!.revokedAt).toBeNull()
      expect(h.result.current.binding).not.toBeNull()
    })

    it('404 DELETE counts as revoked, no error', async () => {
      const h = await withLinks()
      fetchMock.mockReturnValueOnce(json({}, 404))
      fetchMock.mockReturnValueOnce(json({}, 404)).mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent())
      fetchMock.mockReturnValueOnce(json({}, 500))
      await act(async () => { await h.result.current.revokeAll() })
      expect(h.result.current.error).toBeNull()
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
    })

    it('all 401 surfaces the mapped cause, not the count', async () => {
      const h = await withLinks()
      fetchMock.mockReturnValueOnce(json({}, 404))
      fetchMock.mockReturnValueOnce(json({}, 401)).mockReturnValueOnce(json({}, 401)).mockReturnValueOnce(json({}, 401))
      fetchMock.mockReturnValueOnce(json({}, 500))
      await act(async () => { await expect(h.result.current.revokeAll()).rejects.toThrow('Không có quyền với phòng này') })
      expect(h.result.current.error).toBe('Không có quyền với phòng này')
    })

    it('doc switch during first DELETE stops the loop silently', async () => {
      fetchMock.mockReturnValueOnce(json({ roomId: 'r1', ownerToken: 'own' }))
      const other = (await createRecord({ title: 'o', originKind: 'drop', originPath: null })).docId
      const h = renderHook((p: { id: string }) => useShare({ docId: p.id, serverUrl: SERVER }), { initialProps: { id: docId } })
      await act(async () => { await h.result.current.enable() })
      fetchMock.mockReturnValueOnce(json([link('', 'aaaa'), link('', 'bbbb'), link('', 'cccc')]))
      await act(async () => { await h.result.current.refresh() })
      let release!: () => void
      fetchMock.mockReturnValueOnce(new Promise((r) => { release = () => r(new Response(JSON.stringify({ revoked: 3 }), { status: 200 })) }))
      let pr!: Promise<unknown>
      act(() => { pr = h.result.current.revokeAll() })
      const callsBefore = fetchMock.mock.calls.length
      h.rerender({ id: other })
      await act(async () => { release(); await pr })
      expect(fetchMock.mock.calls.length).toBe(callsBefore)
      expect(h.result.current.error).toBeNull()
    })

    it('successful refresh with revokedAt set does not resurrect rows', async () => {
      const h = await withLinks()
      fetchMock.mockReturnValueOnce(json({}, 404))
      fetchMock.mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent())
      fetchMock.mockReturnValueOnce(json([
        { ...link('', 'aaaa'), revokedAt: 9 }, { ...link('', 'bbbb'), revokedAt: 9 },
        { ...link('', 'dead'), revokedAt: 5 }, { ...link('', 'cccc'), revokedAt: 9 },
      ]))
      await act(async () => { await h.result.current.revokeAll() })
      expect(h.result.current.links).toHaveLength(4)
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
    })

    it('revokeAll in flight on A, switch to B: B links/tokens untouched, A correct on return', async () => {
      const B = (await createRecord({ title: 'b', originKind: 'drop', originPath: null })).docId
      await touchRecord(B, { room: { serverUrl: SERVER, roomId: 'r2', ownerToken: 'own2' } })
      fetchMock.mockReturnValueOnce(json({ roomId: 'r1', ownerToken: 'own' }))
      const h = renderHook((p: { id: string }) => useShare({ docId: p.id, serverUrl: SERVER }), { initialProps: { id: docId } })
      await act(async () => { await h.result.current.enable() })
      fetchMock.mockReturnValueOnce(json([link('', 'aaaa')]))
      await act(async () => { await h.result.current.refresh() })
      let release!: () => void
      fetchMock.mockReturnValueOnce(new Promise((r) => { release = () => r(new Response(JSON.stringify({ revoked: 1 }), { status: 200 })) }))
      let pr!: Promise<unknown>
      act(() => { pr = h.result.current.revokeAll() })
      h.rerender({ id: B })
      await waitFor(() => expect(h.result.current.binding?.roomId).toBe('r2'))
      const bLink = { ...link('', 'bbbb'), roomId: 'r2' }
      fetchMock.mockReturnValueOnce(json([bLink]))
      await act(async () => { await h.result.current.refresh() })
      const callsBefore = fetchMock.mock.calls.length
      const bState = h.result.current.links
      await act(async () => { release(); await pr })
      expect(fetchMock.mock.calls.length).toBe(callsBefore) // no refresh/DELETE after stale
      expect(h.result.current.links).toBe(bState)
      expect(h.result.current.links.map((l) => [l.tokenPrefix, l.revokedAt])).toEqual([['bbbb', null]])
      expect(h.result.current.error).toBeNull()
      // back to A: server says aaaa is revoked
      h.rerender({ id: docId })
      await waitFor(() => expect(h.result.current.binding?.roomId).toBe('r1'))
      fetchMock.mockReturnValueOnce(json([{ ...link('', 'aaaa'), revokedAt: 7 }]))
      await act(async () => { await h.result.current.refresh() })
      expect(h.result.current.links.map((l) => [l.tokenPrefix, l.revokedAt])).toEqual([['aaaa', 7]])
    })

    it('rejects when not bound', async () => {
      const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
      await act(async () => { await expect(h.result.current.revokeAll()).rejects.toThrow('Chưa bật chia sẻ') })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('deleteRemote', () => {
    async function boundWithLink() {
      const h = await bound()
      fetchMock.mockReturnValueOnce(json(link('SECRET', 'aaaa')))
      await act(async () => { await h.result.current.createLink({ role: 'view', expiresIn: null }) })
      expect(store['mdr.links.r1']).toBeTruthy()
      return h
    }
    for (const status of [204, 404]) {
      it(`DELETE ${status} unbinds, clears links and cache`, async () => {
        const h = await boundWithLink()
        fetchMock.mockReturnValueOnce(Promise.resolve(new Response(status === 204 ? null : '{}', { status })))
        await act(async () => { await h.result.current.deleteRemote() })
        const [url, init] = fetchMock.mock.calls[2]
        expect(url).toBe(`${SERVER}/api/rooms/r1`)
        expect(init.method).toBe('DELETE')
        expect(init.headers.Authorization).toBe('Bearer own')
        expect(h.result.current.binding).toBeNull()
        expect(h.result.current.links).toEqual([])
        expect(store['mdr.links.r1']).toBeUndefined()
        expect((await getRecord(docId))?.room).toBeUndefined()
      })
    }
    it('401 + resolve 410 unbinds as if deleted', async () => {
      const h = await boundWithLink()
      fetchMock.mockReturnValueOnce(Promise.resolve(new Response('{}', { status: 401 })))
      fetchMock.mockReturnValueOnce(Promise.resolve(new Response('{}', { status: 410 })))
      await act(async () => { await h.result.current.deleteRemote() })
      expect(fetchMock.mock.calls[3][0]).toBe(`${SERVER}/api/s/own`)
      expect(h.result.current.binding).toBeNull()
      expect(store['mdr.links.r1']).toBeUndefined()
      expect((await getRecord(docId))?.room).toBeUndefined()
    })
    it('401 + resolve 200 throws and keeps binding', async () => {
      const h = await boundWithLink()
      fetchMock.mockReturnValueOnce(Promise.resolve(new Response('{}', { status: 401 })))
      fetchMock.mockReturnValueOnce(Promise.resolve(new Response('{}', { status: 200 })))
      await act(async () => { await expect(h.result.current.deleteRemote()).rejects.toThrow() })
      expect(h.result.current.binding?.roomId).toBe('r1')
      expect(store['mdr.links.r1']).toBeTruthy()
    })
    it('401 + resolve network error throws and keeps binding', async () => {
      const h = await boundWithLink()
      fetchMock.mockReturnValueOnce(Promise.resolve(new Response('{}', { status: 401 })))
      fetchMock.mockReturnValueOnce(Promise.reject(new TypeError('net')))
      await act(async () => { await expect(h.result.current.deleteRemote()).rejects.toThrow() })
      expect(h.result.current.binding?.roomId).toBe('r1')
      expect(store['mdr.links.r1']).toBeTruthy()
    })
    it('401 throws and keeps binding', async () => {
      const h = await boundWithLink()
      fetchMock.mockReturnValueOnce(Promise.resolve(new Response('{}', { status: 401 })))
      await act(async () => { await expect(h.result.current.deleteRemote()).rejects.toThrow() })
      expect(h.result.current.binding?.roomId).toBe('r1')
      expect(store['mdr.links.r1']).toBeTruthy()
    })
  })

  it('enable on A then switch to B before createRoom resolves: room attached to A only, none orphaned', async () => {
    const B = (await createRecord({ title: 'b', originKind: 'drop', originPath: null })).docId
    let release!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((res) => { release = res }))
    const h = renderHook((p: { docId: string }) => useShare({ docId: p.docId, serverUrl: SERVER }), { initialProps: { docId } })
    let pr!: Promise<unknown>
    act(() => { pr = h.result.current.enable().catch(() => {}) })
    h.rerender({ docId: B })
    release(new Response(JSON.stringify({ roomId: 'r9', ownerToken: 'o9' }), { status: 200 }))
    await act(async () => { await pr })
    expect((await getRecord(docId))?.room?.roomId).toBe('r9')
    expect((await getRecord(B))?.room).toBeUndefined()
    expect(h.result.current.binding).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1) // no DELETE needed
  })

  it('operations in the render->effect window do not hit the previous doc room', async () => {
    const B = (await createRecord({ title: 'b', originKind: 'drop', originPath: null })).docId
    const h = await bound()
    const hook = renderHook((p: { docId: string }) => useShare({ docId: p.docId, serverUrl: SERVER }), { initialProps: { docId } })
    await waitFor(() => expect(hook.result.current.binding?.roomId).toBe('r1'))
    const api = hook.result.current
    fetchMock.mockClear()
    // new render with doc B; call the OLD closure before effects/state settle
    hook.rerender({ docId: B })
    expect(api.currentBinding()).toBeNull()
    await act(async () => { await expect(api.refresh()).rejects.toThrow() })
    expect(fetchMock).not.toHaveBeenCalled()
    h.unmount()
  })
})
