// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

const reg = vi.hoisted(() => ({
  findOrCreateByOrigin: vi.fn(),
  writeDocText: vi.fn(),
  docQuery: vi.fn(),
  listRecent: vi.fn(),
}))
vi.mock('./doc-registry', () => reg)
const bridge = vi.hoisted(() => ({ clients: [] as unknown[] }))
vi.mock('./hooks/useBridgeSettings', () => ({
  useBridgeSettings: () => ({ enabled: false, clients: bridge.clients, setEnabled: vi.fn(), revoke: vi.fn() }),
}))

import { WelcomeRoute } from './WelcomeRoute'
import { LocaleRoot } from './LocaleRoot'

const g = globalThis as unknown as { chrome?: unknown }
const assign = vi.fn()
const origLocation = window.location

function setChrome(c: unknown): void { g.chrome = c }

const PIN_STEP = /Pin MD Reader|Ghim MD Reader lên thanh công cụ/
const FILE_STEP = /Allow access to local files|Cho phép đọc file trên máy/
const OPEN_STEP = /^(Open a \.md file|Mở một file \.md)$/

function fileAccess(ok: boolean): unknown {
  return { isAllowedFileSchemeAccess: (cb: (v: boolean) => void) => cb(ok) }
}

function stepLi(label: RegExp): HTMLElement {
  return screen.getByText(label).closest('li') as HTMLElement
}

function renderRoute(): ReturnType<typeof render> {
  return render(<LocaleRoot><WelcomeRoute /></LocaleRoot>)
}

beforeEach(() => {
  vi.clearAllMocks()
  bridge.clients = []
  reg.listRecent.mockResolvedValue([])
  reg.findOrCreateByOrigin.mockResolvedValue({ docId: 'abc', originPath: 'mdr://welcome/vi' })
  reg.writeDocText.mockResolvedValue(undefined)
  reg.docQuery.mockResolvedValue('?d=abc')
  setChrome({ runtime: { id: 'xyz' }, tabs: { create: vi.fn() } })
  Object.defineProperty(window, 'location', { configurable: true, value: { ...origLocation, search: '?welcome=1', assign } })
})

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'location', { configurable: true, value: origLocation })
})

describe('WelcomeRoute', () => {
  it('opens the sample doc then navigates to app.html', async () => {
    renderRoute()
    const btn = document.querySelector('.welcome-primary') as HTMLElement
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    await waitFor(() => expect(assign).toHaveBeenCalled())
    const arg = reg.findOrCreateByOrigin.mock.calls[0]![0]
    expect(arg.originKind).toBe('drop')
    expect(String(arg.originPath)).toMatch(/^mdr:\/\/welcome\//)
    expect(reg.writeDocText.mock.calls[0]![2]).toBe('if-clean')
    expect(assign).toHaveBeenCalledWith('app.html?d=abc')
  })

  it('hides the pin step when getUserSettings is missing', async () => {
    setChrome({ runtime: { id: 'xyz' }, extension: fileAccess(true) })
    renderRoute()
    await waitFor(() => expect(stepLi(FILE_STEP).getAttribute('data-done')).toBe('true'))
    expect(screen.queryByText(PIN_STEP)).toBeNull()
  })

  it('shows the pin step done when on toolbar', async () => {
    setChrome({ runtime: { id: 'xyz' }, action: { getUserSettings: () => Promise.resolve({ isOnToolbar: true }) } })
    renderRoute()
    await waitFor(() => expect(stepLi(PIN_STEP).getAttribute('data-done')).toBe('true'))
  })

  it('shows the pin step not done when off toolbar', async () => {
    setChrome({
      runtime: { id: 'xyz' },
      extension: fileAccess(true),
      action: { getUserSettings: () => Promise.resolve({ isOnToolbar: false }) },
    })
    renderRoute()
    await waitFor(() => expect(stepLi(FILE_STEP).getAttribute('data-done')).toBe('true'))
    expect(stepLi(PIN_STEP).getAttribute('data-done')).toBe('false')
  })

  it('opened-file step is not done when only the sample exists', async () => {
    reg.listRecent.mockResolvedValue([{ docId: 'a', originPath: 'mdr://welcome/en' }])
    setChrome({
      runtime: { id: 'xyz' },
      action: { getUserSettings: () => Promise.resolve({ isOnToolbar: true }) },
    })
    renderRoute()
    await waitFor(() => expect(stepLi(PIN_STEP).getAttribute('data-done')).toBe('true'))
    expect(stepLi(OPEN_STEP).getAttribute('data-done')).toBe('false')
  })

  it('opened-file step is done with a real file', async () => {
    reg.listRecent.mockResolvedValue([{ docId: 'a', originPath: 'https://x/a.md' }])
    renderRoute()
    await waitFor(() => expect(stepLi(OPEN_STEP).getAttribute('data-done')).toBe('true'))
  })

  it('still renders and opened-file step stays not done when listRecent throws', async () => {
    reg.listRecent.mockRejectedValue(new Error('idb'))
    const onUnhandled = vi.fn()
    process.on('unhandledRejection', onUnhandled)
    try {
      setChrome({
        runtime: { id: 'xyz' },
        extension: fileAccess(true),
        action: { getUserSettings: () => Promise.resolve({ isOnToolbar: true }) },
      })
      renderRoute()
      await waitFor(() => expect(stepLi(FILE_STEP).getAttribute('data-done')).toBe('true'))
      expect(stepLi(OPEN_STEP).getAttribute('data-done')).toBe('false')
      expect(document.querySelector('main.welcome')).toBeTruthy()
      await new Promise((r) => setTimeout(r, 0))
      expect(onUnhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('AI client marks the AI step done', async () => {
    bridge.clients = [{ id: 'c' }]
    renderRoute()
    await waitFor(() => expect(document.querySelector('[data-done="true"]')).toBeTruthy())
  })
})
