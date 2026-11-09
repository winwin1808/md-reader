// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { WhatsNewRoute, maybeRedirectToWhatsNew, resolveSeenVersion, WHATSNEW_SHOWN_KEY } from './WhatsNewRoute'
import { LocaleRoot } from './LocaleRoot'
import { LIFECYCLE_KEY, parseLifecycleState, markWhatsNewSeen } from '../worker/lifecycle'
import { hasUnseenNotes } from './hooks/useLifecycleSettings'

const g = globalThis as unknown as { chrome?: unknown }
const assign = vi.fn()
const replace = vi.fn()
const origLocation = window.location

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', { configurable: true, value: { ...origLocation, search, assign, replace } })
}

function state(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { v: 1, startedAt: 1, lastSeenVersion: '1.4.0', pendingWhatsNew: '1.5.0', pendingWelcome: false, autoOpenWhatsNew: true, docOpens: 0, review: 'idle', ...over }
}

function setChrome(get: () => Promise<unknown>, set = vi.fn().mockResolvedValue(undefined)): ReturnType<typeof vi.fn> {
  g.chrome = { storage: { local: { get, set } }, runtime: { getManifest: () => ({ version: '1.5.0' }) } }
  return set
}

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear() })
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  Object.defineProperty(window, 'location', { configurable: true, value: origLocation })
})

describe('WhatsNewRoute', () => {
  it('highlights ?v and marks it seen in storage', async () => {
    setSearch('?whatsnew=1&v=1.5.0')
    const set = setChrome(() => Promise.resolve({ [LIFECYCLE_KEY]: state() }))
    const { container } = render(<LocaleRoot><WhatsNewRoute /></LocaleRoot>)
    await waitFor(() => expect(set).toHaveBeenCalled())
    const arg = (set.mock.calls[0]?.[0] ?? {}) as Record<string, Record<string, unknown>>
    expect(arg[LIFECYCLE_KEY]?.pendingWhatsNew).toBeNull()
    expect(arg[LIFECYCLE_KEY]?.lastSeenVersion).toBe('1.5.0')
    expect(container.querySelector('section[data-version="1.5.0"][data-highlight="true"]')).not.toBeNull()
  })

  it('still renders when storage.get rejects', async () => {
    setSearch('?whatsnew=1&v=1.5.0')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setChrome(() => Promise.reject(new Error('boom')))
    const { container } = render(<LocaleRoot><WhatsNewRoute /></LocaleRoot>)
    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(container.querySelector('main.whatsnew')).not.toBeNull()
    warn.mockRestore()
  })
})

describe('maybeRedirectToWhatsNew', () => {
  it('replaces location when pending and app page is empty', async () => {
    setSearch('')
    setChrome(() => Promise.resolve({ [LIFECYCLE_KEY]: state() }))
    await expect(maybeRedirectToWhatsNew()).resolves.toBe(true)
    expect(replace).toHaveBeenCalledWith('app.html?whatsnew=1&v=1.5.0')
  })

  it('never redirects when a document is open', async () => {
    setSearch('?d=x')
    setChrome(() => Promise.resolve({ [LIFECYCLE_KEY]: state() }))
    await expect(maybeRedirectToWhatsNew()).resolves.toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('resolveSeenVersion', () => {
  const mk = (version: string, showOnUpdate = true) => ({ version, showOnUpdate, title: { vi: '', en: '' }, items: { vi: [], en: [] } })
  const notes = [mk('1.6.0'), mk('1.5.0'), mk('1.4.0'), mk('1.3.0', false)]
  it('returns the newest note <= current regardless of v', () => {
    expect(resolveSeenVersion('99.0.0', notes, '1.5.0')).toBe('1.5.0')
    expect(resolveSeenVersion(null, notes, '1.5.0')).toBe('1.5.0')
    expect(resolveSeenVersion('1.2.0', notes, '1.5.0')).toBe('1.5.0')
    expect(resolveSeenVersion('1.4.0', notes, '1.5.0')).toBe('1.5.0')
  })
  it('counts notes with showOnUpdate false', () => {
    const n = [mk('1.5.1', false), mk('1.5.0')]
    expect(resolveSeenVersion('1.5.0', n, '1.5.1')).toBe('1.5.1')
  })
  it('returns null when nothing qualifies', () => {
    expect(resolveSeenVersion(null, [mk('2.0.0')], '1.5.0')).toBeNull()
  })
  it('opening the page clears the unseen dot', () => {
    const n = [mk('1.5.0'), mk('1.5.1', false)]
    const s = parseLifecycleState({ lastSeenVersion: '1.4.0' })
    expect(hasUnseenNotes(s.lastSeenVersion, n, '1.5.1')).toBe(true)
    const after = markWhatsNewSeen(s, resolveSeenVersion('1.5.0', n, '1.5.1')!)
    expect(hasUnseenNotes(after.lastSeenVersion, n, '1.5.1')).toBe(false)
  })
})

describe('redirect guards', () => {
  it('does not redirect again after the page was shown, even if storage.set rejects', async () => {
    setSearch('?whatsnew=1&v=1.5.0')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const set = setChrome(() => Promise.resolve({ [LIFECYCLE_KEY]: state() }), vi.fn().mockRejectedValue(new Error('x')))
    render(<LocaleRoot><WhatsNewRoute /></LocaleRoot>)
    await waitFor(() => expect(set).toHaveBeenCalled())
    expect(sessionStorage.getItem(WHATSNEW_SHOWN_KEY)).toBe('1')
    setSearch('')
    await expect(maybeRedirectToWhatsNew()).resolves.toBe(false)
    expect(replace).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it.each(['?doc=x', '?file=y', '?speaker=true'])('never redirects for %s', async (q) => {
    setSearch(q)
    setChrome(() => Promise.resolve({ [LIFECYCLE_KEY]: state() }))
    await expect(maybeRedirectToWhatsNew()).resolves.toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('does not replace when aborted while storage.get is pending', async () => {
    setSearch('')
    let resolveGet: (v: unknown) => void = () => {}
    const get = vi.fn(() => new Promise((r) => { resolveGet = r }))
    setChrome(get)
    const ctrl = new AbortController()
    const p = maybeRedirectToWhatsNew(ctrl.signal)
    ctrl.abort()
    resolveGet({ [LIFECYCLE_KEY]: state() })
    await expect(p).resolves.toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('does not touch storage when a doc param is present', async () => {
    setSearch('?d=x')
    const get = vi.fn(() => Promise.resolve({ [LIFECYCLE_KEY]: state() }))
    setChrome(get)
    await expect(maybeRedirectToWhatsNew()).resolves.toBe(false)
    expect(get).not.toHaveBeenCalled()
  })

  it('does not redirect when autoOpenWhatsNew is false', async () => {
    setSearch('')
    setChrome(() => Promise.resolve({ [LIFECYCLE_KEY]: state({ autoOpenWhatsNew: false }) }))
    await expect(maybeRedirectToWhatsNew()).resolves.toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('onDone assigns app.html only after storage.set was called', async () => {
    setSearch('?whatsnew=1&v=1.5.0')
    const order: string[] = []
    const set = vi.fn().mockImplementation(async () => { order.push('set') })
    setChrome(() => Promise.resolve({ [LIFECYCLE_KEY]: state() }), set)
    assign.mockImplementation(() => { order.push('assign') })
    const { container } = render(<LocaleRoot><WhatsNewRoute /></LocaleRoot>)
    await waitFor(() => expect(set).toHaveBeenCalled())
    const btn = container.querySelector('button')!
    btn.click()
    await waitFor(() => expect(assign).toHaveBeenCalledWith('app.html'))
    expect(order).toEqual(['set', 'assign'])
  })
})
