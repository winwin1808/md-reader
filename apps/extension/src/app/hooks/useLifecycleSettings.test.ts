// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { hasUnseenNotes, useLifecycleSettings } from './useLifecycleSettings'
import { LIFECYCLE_KEY } from '../../worker/lifecycle'
import type { ReleaseNote } from '../../shared/release-notes'

const note = (version: string, showOnUpdate = true): ReleaseNote => ({
  version, showOnUpdate, title: { vi: '', en: '' }, items: { vi: [], en: [] },
})

describe('hasUnseenNotes', () => {
  it('true when never seen', () => expect(hasUnseenNotes(null, [note('1.5.0')], '1.5.0')).toBe(true))
  it('false when seen current', () => expect(hasUnseenNotes('1.5.0', [note('1.5.0')], '1.5.0')).toBe(false))
  it('counts showOnUpdate false', () => expect(hasUnseenNotes('1.4.0', [note('1.4.1', false)], '1.5.0')).toBe(true))
  it('ignores notes newer than current', () => expect(hasUnseenNotes('1.4.0', [note('1.6.0')], '1.5.0')).toBe(false))
})

type L = (c: Record<string, { newValue?: unknown }>, area: string) => void
function install(init: unknown, getImpl?: () => Promise<unknown>) {
  const data: Record<string, unknown> = { [LIFECYCLE_KEY]: init }
  let listener: L | null = null
  const set = vi.fn(async (v: Record<string, unknown>) => { Object.assign(data, v) })
  const create = vi.fn()
  const removeListener = vi.fn(() => { listener = null })
  ;(globalThis as any).chrome = {
    storage: {
      local: { get: getImpl ?? (async (k: string) => ({ [k]: data[k] })), set },
      onChanged: { addListener: (fn: L) => { listener = fn }, removeListener },
    },
    runtime: { getManifest: () => ({ version: '1.5.0' }), getURL: (p: string) => 'chrome-extension://x/' + p },
    tabs: { create },
  }
  return { set, create, removeListener, emit: (v: unknown) => listener?.({ [LIFECYCLE_KEY]: { newValue: v } }, 'local') }
}

describe('useLifecycleSettings', () => {
  const orig = (globalThis as any).chrome
  afterEach(() => { cleanup(); (globalThis as any).chrome = orig })

  it('reads state and reacts to onChanged', async () => {
    const s = install({ lastSeenVersion: '1.4.0' })
    const { result } = renderHook(() => useLifecycleSettings())
    await waitFor(() => expect(result.current.hasUnseenNotes).toBe(true))
    act(() => { s.emit({ lastSeenVersion: '1.5.0' }) })
    await waitFor(() => expect(result.current.hasUnseenNotes).toBe(false))
  })

  it('toggle keeps other fields', async () => {
    const s = install({ lastSeenVersion: '1.4.0', docOpens: 7, review: 'dismissed' })
    const { result } = renderHook(() => useLifecycleSettings())
    await waitFor(() => expect(result.current.hasUnseenNotes).toBe(true))
    await act(async () => { await result.current.onAutoOpenWhatsNewChange(false) })
    const written = (s.set.mock.calls[0]![0] as any)[LIFECYCLE_KEY]
    expect(written.autoOpenWhatsNew).toBe(false)
    expect(written.docOpens).toBe(7)
    expect(written.review).toBe('dismissed')
  })

  it('opens whatsnew tab', async () => {
    const s = install({})
    const { result } = renderHook(() => useLifecycleSettings())
    act(() => { result.current.onOpenWhatsNew() })
    expect(s.create.mock.calls[0]![0].url).toContain('whatsnew=1&v=1.5.0')
  })

  it('storage reject gives defaults', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    install({}, () => Promise.reject(new Error('x')))
    const { result } = renderHook(() => useLifecycleSettings())
    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(result.current.autoOpenWhatsNew).toBe(true)
    expect(result.current.hasUnseenNotes).toBe(false)
    warn.mockRestore()
  })

  it('unmount removes listener', async () => {
    const s = install({})
    const { unmount } = renderHook(() => useLifecycleSettings())
    unmount()
    expect(s.removeListener).toHaveBeenCalled()
  })
})
