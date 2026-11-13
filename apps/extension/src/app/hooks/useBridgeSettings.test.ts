// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBridgeSettings } from './useBridgeSettings'
import { BRIDGE_STORAGE_KEY, BRIDGE_SEEN_KEY, SEEN_TTL_MS } from '../../worker/bridge-storage'

function fakeStore(init?: unknown) {
  const data: Record<string, unknown> = init === undefined ? {} : { [BRIDGE_STORAGE_KEY]: init }
  let listener: ((c: Record<string, { newValue?: unknown }>, area: string) => void) | null = null
  return {
    data,
    get: async (k: string) => ({ [k]: data[k] }),
    set: async (v: Record<string, unknown>) => { Object.assign(data, v) },
    onChanged: {
      addListener: (fn: typeof listener) => { listener = fn },
      removeListener: () => { listener = null },
    },
    emit: (v: unknown) => listener?.({ [BRIDGE_STORAGE_KEY]: { newValue: v } }, 'local'),
  }
}

describe('useBridgeSettings', () => {
  it('defaults to disabled with no clients', async () => {
    const s = fakeStore()
    const { result } = renderHook(() => useBridgeSettings(s))
    await waitFor(() => expect(result.current.enabled).toBe(false))
    expect(result.current.clients).toEqual([])
  })

  it('setEnabled writes and keeps approved', async () => {
    const a = { keyHash: 'h1', client: 'Claude', at: 1, serverKey: 'sk' }
    const s = fakeStore({ enabled: false, approved: [a] })
    const { result } = renderHook(() => useBridgeSettings(s))
    await waitFor(() => expect(result.current.clients).toEqual([a]))
    await act(async () => { await result.current.setEnabled(true) })
    expect(s.data[BRIDGE_STORAGE_KEY]).toEqual({ enabled: true, approved: [a] })
  })

  it('updates when storage changes', async () => {
    const s = fakeStore()
    const { result } = renderHook(() => useBridgeSettings(s))
    await waitFor(() => expect(result.current.enabled).toBe(false))
    act(() => { s.emit({ enabled: true, approved: [{ keyHash: 'x', client: 'C', at: 2, serverKey: 'sk' }] }) })
    expect(result.current.enabled).toBe(true)
    expect(result.current.clients).toHaveLength(1)
  })

  it('revoke removes the matching keyHash', async () => {
    const s = fakeStore({ enabled: true, approved: [{ keyHash: 'a', client: 'A', at: 1, serverKey: 'sk' }, { keyHash: 'b', client: 'B', at: 2, serverKey: 'sk' }] })
    const { result } = renderHook(() => useBridgeSettings(s))
    await waitFor(() => expect(result.current.clients).toHaveLength(2))
    await act(async () => { await result.current.revoke('a') })
    expect((s.data[BRIDGE_STORAGE_KEY] as { approved: { keyHash: string }[] }).approved.map((x) => x.keyHash)).toEqual(['b'])
  })
})

describe('useBridgeSettings discovered/connect', () => {
  type L = (c: Record<string, { newValue?: unknown }>, area: string) => void
  const H = (c: string) => c.repeat(64)
  const seen = (o: Record<string, unknown> = {}) => ({
    keyHash: H('1'), client: 'Claude', port: 47821, pinned: 'unknown', rejected: false, at: Date.now(), ...o,
  })
  function stubChrome(session: unknown, sendMessage: (m: unknown) => Promise<unknown> = async () => ({ ok: true })) {
    let listener: L | null = null
    const sess = { [BRIDGE_SEEN_KEY]: session }
    const c = {
      storage: {
        session: { get: async (k: string) => ({ [k]: sess[k as typeof BRIDGE_SEEN_KEY] }) },
        onChanged: { addListener: (fn: L) => { listener = fn }, removeListener: () => { listener = null } },
      },
      runtime: { sendMessage },
    }
    vi.stubGlobal('chrome', c)
    return { sess, emit: (v: unknown) => listener?.({ [BRIDGE_SEEN_KEY]: { newValue: v } }, 'session') }
  }
  const st = fakeStore()
  afterEach(() => { vi.unstubAllGlobals() })

  it('waiting for unknown pin', async () => {
    stubChrome([seen()])
    const { result } = renderHook(() => useBridgeSettings(st))
    await waitFor(() => expect(result.current.discovered).toEqual([{ keyHash: H('1'), client: 'Claude', status: 'waiting' }]))
  })

  it('other for pinned other or rejected', async () => {
    stubChrome([seen({ keyHash: H('a'), pinned: 'other' }), seen({ keyHash: H('b'), rejected: true })])
    const { result } = renderHook(() => useBridgeSettings(st))
    await waitFor(() => expect(result.current.discovered.map((d) => d.status)).toEqual(['other', 'other']))
  })

  it('hides approved unless pinned other', async () => {
    stubChrome([seen({ keyHash: H('a') }), seen({ keyHash: H('b'), pinned: 'other' }), seen({ keyHash: H('c') })])
    const ap = (h: string) => ({ keyHash: h, client: 'X', at: 1, serverKey: 'sk' })
    const s = fakeStore({ enabled: true, approved: [ap(H('a')), ap(H('b'))] })
    const { result } = renderHook(() => useBridgeSettings(s))
    await waitFor(() => expect(result.current.clients).toHaveLength(2))
    await waitFor(() => expect(result.current.discovered.map((d) => d.keyHash)).toEqual([H('b'), H('c')]))
  })

  it('drops stale, garbage, and missing session', async () => {
    stubChrome([seen({ at: Date.now() - SEEN_TTL_MS - 1000 })])
    const r1 = renderHook(() => useBridgeSettings(st))
    await waitFor(() => expect(r1.result.current.enabled).toBe(false))
    expect(r1.result.current.discovered).toEqual([])
    stubChrome('garbage')
    const r2 = renderHook(() => useBridgeSettings(st))
    await waitFor(() => expect(r2.result.current.enabled).toBe(false))
    expect(r2.result.current.discovered).toEqual([])
    vi.stubGlobal('chrome', { storage: {} })
    const r3 = renderHook(() => useBridgeSettings(st))
    await waitFor(() => expect(r3.result.current.enabled).toBe(false))
    expect(r3.result.current.discovered).toEqual([])
  })

  it('updates on session onChanged', async () => {
    const c = stubChrome([])
    const { result } = renderHook(() => useBridgeSettings(st))
    await waitFor(() => expect(result.current.enabled).toBe(false))
    act(() => { c.emit([seen({ keyHash: H('f') })]) })
    await waitFor(() => expect(result.current.discovered.map((d) => d.keyHash)).toEqual([H('f')]))
  })

  it('connect sends message and swallows errors', async () => {
    const sent: unknown[] = []
    stubChrome([], async (m) => { sent.push(m); throw new Error('boom') })
    const { result } = renderHook(() => useBridgeSettings(st))
    await waitFor(() => expect(result.current.enabled).toBe(false))
    await act(async () => { await result.current.connect('h') })
    expect(sent).toEqual([{ type: 'mdr-bridge-connect', keyHash: 'h' }])
  })
})
