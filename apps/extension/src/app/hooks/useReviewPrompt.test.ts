// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { useReviewPrompt, REVIEW_URL, REVIEW_DECISION_KEY } from './useReviewPrompt'
import { LIFECYCLE_KEY } from '../../worker/lifecycle'

type L = (c: Record<string, { newValue?: unknown }>, area: string) => void
const DAY = 86_400_000

function install(init: unknown, opts: { reject?: boolean; rejectSet?: boolean } = {}) {
  const data: Record<string, unknown> = { [LIFECYCLE_KEY]: init }
  const set = vi.fn(async (v: Record<string, unknown>) => { if (opts.rejectSet) throw new Error('setfail'); Object.assign(data, v) })
  const get = opts.reject ? vi.fn(async () => { throw new Error('boom') }) : vi.fn(async (k: string | string[]) => Object.fromEntries((Array.isArray(k) ? k : [k]).map((x) => [x, data[x]])))
  const create = vi.fn()
  const removeListener = vi.fn()
  const addListener = vi.fn((_fn: L) => {})
  ;(globalThis as any).chrome = {
    storage: { local: { get, set }, onChanged: { addListener, removeListener } },
    tabs: { create },
  }
  const fire = (c: Record<string, { newValue?: unknown }>, area = 'local') => addListener.mock.calls.forEach((a) => a[0](c, area))
  return { data, set, create, addListener, removeListener, fire, get }
}

const ready = (over: Record<string, unknown> = {}) => ({ v: 1, startedAt: Date.now() - 8 * DAY, docOpens: 10, review: 'idle', ...over })

describe('useReviewPrompt', () => {
  const orig = (globalThis as any).chrome
  const ua = navigator.userAgent
  afterEach(() => {
    cleanup(); (globalThis as any).chrome = orig
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  })

  it('bumps docOpens on each docId change, not on rerender or null', async () => {
    const c = install(ready({ docOpens: 0, startedAt: Date.now() }))
    const { rerender } = renderHook(({ id }: { id: string | null }) => useReviewPrompt(id), { initialProps: { id: null as string | null } })
    await act(async () => {})
    expect(c.set).not.toHaveBeenCalled()
    rerender({ id: 'a' }); await waitFor(() => expect((c.data[LIFECYCLE_KEY] as any).docOpens).toBe(1))
    rerender({ id: 'a' }); await act(async () => {})
    expect((c.data[LIFECYCLE_KEY] as any).docOpens).toBe(1)
    rerender({ id: 'b' }); await waitFor(() => expect((c.data[LIFECYCLE_KEY] as any).docOpens).toBe(2))
    rerender({ id: 'b' }); await act(async () => {})
    expect((c.data[LIFECYCLE_KEY] as any).docOpens).toBe(2)
    rerender({ id: null }); await act(async () => {})
    expect((c.data[LIFECYCLE_KEY] as any).docOpens).toBe(2)
  })

  it('shows when 10 opens, 8 days, idle', async () => {
    install(ready())
    const { result } = renderHook(() => useReviewPrompt(null))
    await waitFor(() => expect(result.current.show).toBe(true))
  })

  it('hidden on Firefox', async () => {
    install(ready())
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Gecko/20100101 Firefox/130.0', configurable: true })
    const { result } = renderHook(() => useReviewPrompt(null))
    await act(async () => {})
    expect(result.current.show).toBe(false)
  })

  it('onRate opens reviews, records accepted, hides', async () => {
    const c = install(ready())
    const { result } = renderHook(() => useReviewPrompt(null))
    await waitFor(() => expect(result.current.show).toBe(true))
    await act(async () => { result.current.onRate() })
    expect(c.create).toHaveBeenCalledWith({ url: REVIEW_URL })
    await waitFor(() => expect((c.data[LIFECYCLE_KEY] as any).review).toBe('accepted'))
    expect(result.current.show).toBe(false)
  })

  it('onDismiss records dismissed, hides', async () => {
    const c = install(ready())
    const { result } = renderHook(() => useReviewPrompt(null))
    await waitFor(() => expect(result.current.show).toBe(true))
    await act(async () => { result.current.onDismiss() })
    await waitFor(() => expect((c.data[LIFECYCLE_KEY] as any).review).toBe('dismissed'))
    expect(result.current.show).toBe(false)
  })

  it('storage rejection: show false, no throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    install(ready(), { reject: true })
    const { result } = renderHook(() => useReviewPrompt('a'))
    await act(async () => {})
    expect(result.current.show).toBe(false)
    warn.mockRestore()
  })

  it('unmount removes listener', async () => {
    const c = install(ready())
    const { unmount } = renderHook(() => useReviewPrompt(null))
    await act(async () => {})
    unmount()
    expect(c.removeListener).toHaveBeenCalledWith(c.addListener.mock.calls[0]![0])
  })

  it('onDismiss writes decision key first', async () => {
    const c = install(ready())
    const { result } = renderHook(() => useReviewPrompt(null))
    await waitFor(() => expect(result.current.show).toBe(true))
    await act(async () => { result.current.onDismiss() })
    await waitFor(() => expect(c.data[REVIEW_DECISION_KEY]).toBe('dismissed'))
    expect(c.set.mock.calls[0]![0]).toEqual({ [REVIEW_DECISION_KEY]: 'dismissed' })
  })

  it('stays hidden after lifecycle overwritten by another writer', async () => {
    const c = install(ready())
    const { result } = renderHook(() => useReviewPrompt(null))
    await waitFor(() => expect(result.current.show).toBe(true))
    await act(async () => { result.current.onDismiss() })
    await waitFor(() => expect(c.data[REVIEW_DECISION_KEY]).toBe('dismissed'))
    act(() => { c.fire({ [LIFECYCLE_KEY]: { newValue: ready({ review: 'idle' }) } }) })
    expect(result.current.show).toBe(false)
  })

  it('mount with decision present: hidden', async () => {
    const c = install(ready()); c.data[REVIEW_DECISION_KEY] = 'accepted'
    const { result } = renderHook(() => useReviewPrompt(null))
    await act(async () => {})
    expect(result.current.show).toBe(false)
  })

  it('ignores onChanged from sync area or other keys', async () => {
    const c = install(ready({ docOpens: 0 }))
    const { result } = renderHook(() => useReviewPrompt(null))
    await act(async () => {})
    expect(result.current.show).toBe(false)
    act(() => { c.fire({ [LIFECYCLE_KEY]: { newValue: ready() } }, 'sync') })
    act(() => { c.fire({ other: { newValue: ready() } }) })
    expect(result.current.show).toBe(false)
    act(() => { c.fire({ [LIFECYCLE_KEY]: { newValue: ready() } }) })
    expect(result.current.show).toBe(true)
  })

  it('set rejection: hidden, no throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = install(ready(), { rejectSet: true })
    const { result } = renderHook(() => useReviewPrompt(null))
    await waitFor(() => expect(result.current.show).toBe(true))
    await act(async () => { result.current.onDismiss() })
    expect(result.current.show).toBe(false)
    expect(c.data[REVIEW_DECISION_KEY]).toBeUndefined()
    warn.mockRestore()
  })

  it('newer onChanged during bump wins over bump result', async () => {
    const c = install(ready({ docOpens: 0, startedAt: Date.now() }))
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useReviewPrompt(id), { initialProps: { id: null as string | null } })
    await act(async () => {})
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const orig = c.get.getMockImplementation()!
    c.get.mockImplementationOnce(async (k: any) => { const v = await orig(k); await gate; return v })
    rerender({ id: 'a' })
    await act(async () => {})
    act(() => { c.fire({ [LIFECYCLE_KEY]: { newValue: ready() } }) })
    expect(result.current.show).toBe(true)
    await act(async () => { release(); await gate })
    expect(result.current.show).toBe(true)
  })
})
