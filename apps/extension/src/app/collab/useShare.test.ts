// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { __resetForTests, createRecord, getRecord } from '../doc-registry'
import { useShare } from './useShare'

const SERVER = 'https://x.test'
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const link = (token: string, prefix: string) => ({
  token, tokenPrefix: prefix, roomId: 'r1', role: 'view', label: '', createdAt: 1, expiresAt: null, revokedAt: null,
})

let fetchMock: any
let docId: string

beforeEach(async () => {
  await __resetForTests()
  docId = (await createRecord({ title: 't', originKind: 'drop', originPath: null })).docId
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
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

  describe('revokeAll', () => {
    const noContent = () => Promise.resolve(new Response(null, { status: 204 }))
    async function withLinks() {
      const h = await bound()
      const list = [link('', 'aaaa'), link('', 'bbbb'), { ...link('', 'dead'), revokedAt: 5 }, link('', 'cccc')]
      fetchMock.mockReturnValueOnce(json(list))
      await act(async () => { await h.result.current.refresh() })
      return h
    }

    it('DELETEs active links in order, marks revoked, keeps binding', async () => {
      const h = await withLinks()
      const before = h.result.current.binding
      fetchMock.mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent())
      fetchMock.mockReturnValueOnce(json({}, 500)) // refresh fails; local state must stand
      await act(async () => { await h.result.current.revokeAll() })
      const urls = fetchMock.mock.calls.slice(2, 5).map((c: any) => c[0])
      expect(urls).toEqual([
        `${SERVER}/api/rooms/r1/links/aaaa`, `${SERVER}/api/rooms/r1/links/bbbb`, `${SERVER}/api/rooms/r1/links/cccc`,
      ])
      expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer own')
      expect(h.result.current.links).toHaveLength(4)
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
      expect(h.result.current.binding).toEqual(before)
      expect((await getRecord(docId))?.room).toEqual(before)
    })

    it('reports remaining count when a DELETE fails, keeps earlier successes', async () => {
      const h = await withLinks()
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
      fetchMock.mockReturnValueOnce(json({}, 404)).mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent())
      fetchMock.mockReturnValueOnce(json({}, 500))
      await act(async () => { await h.result.current.revokeAll() })
      expect(h.result.current.error).toBeNull()
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
    })

    it('all 401 surfaces the mapped cause, not the count', async () => {
      const h = await withLinks()
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
      fetchMock.mockReturnValueOnce(new Promise((r) => { release = () => r(new Response(null, { status: 204 })) }))
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
      fetchMock.mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent()).mockReturnValueOnce(noContent())
      fetchMock.mockReturnValueOnce(json([
        { ...link('', 'aaaa'), revokedAt: 9 }, { ...link('', 'bbbb'), revokedAt: 9 },
        { ...link('', 'dead'), revokedAt: 5 }, { ...link('', 'cccc'), revokedAt: 9 },
      ]))
      await act(async () => { await h.result.current.revokeAll() })
      expect(h.result.current.links).toHaveLength(4)
      expect(h.result.current.links.every((l) => l.revokedAt !== null)).toBe(true)
    })

    it('rejects when not bound', async () => {
      const h = renderHook(() => useShare({ docId, serverUrl: SERVER }))
      await act(async () => { await expect(h.result.current.revokeAll()).rejects.toThrow('Chưa bật chia sẻ') })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
