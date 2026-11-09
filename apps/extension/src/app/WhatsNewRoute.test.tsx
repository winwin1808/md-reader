// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { WhatsNewRoute, maybeRedirectToWhatsNew } from './WhatsNewRoute'
import { LocaleRoot } from './LocaleRoot'
import { LIFECYCLE_KEY } from '../worker/lifecycle'

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
  g.chrome = { storage: { local: { get, set } } }
  return set
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => {
  cleanup()
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
