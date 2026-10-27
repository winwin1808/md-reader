// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBridgeSettings } from './useBridgeSettings'
import { BRIDGE_STORAGE_KEY } from '../../worker/bridge-storage'

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
