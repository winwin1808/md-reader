// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { __resetForTests, createRecord, getRecord } from '../doc-registry'
import { useShare } from './useShare'

const SERVER = 'https://x.test'
const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response)
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
    fetchMock.mockReturnValueOnce(json({}))
    await act(async () => { await h.result.current.revoke('aaaa') })
    const [url, init] = fetchMock.mock.calls[2]
    expect(url).toBe(`${SERVER}/api/rooms/r1/links/aaaa`)
    expect(init.method).toBe('DELETE')
    expect(h.result.current.links).toEqual([])
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
      release({ ok: true, status: 200, json: async () => ({ roomId: 'r1', ownerToken: 'o' }) } as Response)
      await p
    })
    expect(h.result.current.busy).toBe(false)
  })
})
