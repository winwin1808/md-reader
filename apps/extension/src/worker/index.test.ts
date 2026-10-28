import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Service Worker', () => {
  let actionListener: ((tab?: any) => Promise<void> | void) | null = null
  let updatedListener: ((tabId: number, changeInfo: any, tab: any) => Promise<void>) | null = null
  let startupListener: (() => Promise<void>) | null = null
  let installedListener: (() => Promise<void>) | null = null
  let removeMock = vi.fn()
  let tabsUpdateMock = vi.fn()
  let tabsCreateMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    actionListener = null
    updatedListener = null
    startupListener = null
    installedListener = null
    removeMock = vi.fn().mockResolvedValue(undefined)
    tabsUpdateMock = vi.fn().mockResolvedValue(undefined)
    tabsCreateMock = vi.fn().mockResolvedValue(undefined)

    let messageListener: ((message: any, sender: any, sendResponse: any) => boolean | void) | null = null

    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
        onStartup: { addListener: vi.fn((cb) => { startupListener = cb }) },
        onInstalled: { addListener: vi.fn((cb) => { installedListener = cb }) },
        onMessage: {
          addListener: vi.fn((cb) => {
            messageListener = cb
          }),
        },
      },
      action: {
        onClicked: {
          addListener: vi.fn((cb) => {
            actionListener = cb
          }),
        },
      },
      tabs: {
        create: tabsCreateMock,
        update: tabsUpdateMock,
        onUpdated: {
          addListener: vi.fn((cb) => {
            updatedListener = cb
          }),
        },
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
        },
        local: {
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({
            file_content_legacy: '# x',
            file_content_old: { text: 'x', ts: 0 },
            file_content_fresh: { text: 'x', ts: Date.now() },
            other_key: '# keep',
          }),
          remove: removeMock,
        },
      },
    } as any
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).chrome
  })

  it('opens app.html when extension icon is clicked without active file tab', async () => {
    await import('./index')
    expect(actionListener).not.toBeNull()

    await actionListener!({} as any)
    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://test-id/app.html',
    })
  })

  it('updates tab when extension icon is clicked on a .md file tab', async () => {
    await import('./index')
    await actionListener!({ id: 10, url: 'file:///path/to/notes.md' } as any)
    expect(tabsUpdateMock).toHaveBeenCalledWith(10, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('file:///path/to/notes.md'),
    })
  })

  it('handles openApp message with replace=true', async () => {
    await import('./index')
    const sendResponse = vi.fn()
    const messageListener = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    messageListener(
      { action: 'openApp', fileUrl: 'file:///test.md', content: '# Hello', replace: true },
      { tab: { id: 5 } },
      sendResponse
    )
    for (let i = 0; i < 5; i++) await Promise.resolve()

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      'file_content_file:///test.md': { text: '# Hello', ts: expect.any(Number) },
    })
    expect(tabsUpdateMock).toHaveBeenCalledWith(5, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('file:///test.md'),
    })
  })

  it('handles openApp message with replace=false', async () => {
    await import('./index')
    const sendResponse = vi.fn()
    const messageListener = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    messageListener(
      { action: 'openApp', fileUrl: 'file:///test.md', content: '# Hello', replace: false },
      {},
      sendResponse
    )
    for (let i = 0; i < 5; i++) await Promise.resolve()

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('file:///test.md'),
    })
  })

  it('action click on non-markdown tab opens blank app', async () => {
    await import('./index')
    await actionListener!({ id: 3, url: 'https://example.com/page.html' } as any)
    expect(tabsUpdateMock).not.toHaveBeenCalled()
    expect(tabsCreateMock).toHaveBeenCalledWith({ url: 'chrome-extension://test-id/app.html' })
  })

  it('action click on a github blob md page opens the app', async () => {
    await import('./index')
    const u = 'https://github.com/o/r/blob/main/a.md'
    await actionListener!({ id: 4, url: u } as any)
    expect(tabsUpdateMock).toHaveBeenCalledWith(4, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent(u),
    })
  })

  it('registers no tabs.onUpdated listener', async () => {
    await import('./index')
    expect(updatedListener).toBeNull()
  })

  it('purges only stale/legacy file_content_* keys on startup and install', async () => {
    await import('./index')
    expect(startupListener).not.toBeNull()
    expect(installedListener).not.toBeNull()
    await startupListener!()
    expect(removeMock).toHaveBeenCalledWith(['file_content_legacy', 'file_content_old'])
    removeMock.mockClear()
    await installedListener!()
    expect(removeMock).toHaveBeenCalledWith(['file_content_legacy', 'file_content_old'])
  })
  it('renderMd responds synchronously with html', async () => {
    await import('./index')
    const sendResponse = vi.fn()
    const l = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    const ret = l({ action: 'renderMd', markdown: '# Hi' }, {}, sendResponse)
    expect(ret).not.toBe(true)
    const arg = sendResponse.mock.calls[0]![0]
    expect(arg.ok).toBe(true)
    expect(arg.html).toContain('<h1')
    expect(arg.title).toBe('Hi')
  })

  it('renderMd rejects non-string and too-large input', async () => {
    await import('./index')
    const l = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    const r1 = vi.fn()
    l({ action: 'renderMd', markdown: 42 }, {}, r1)
    expect(r1).toHaveBeenCalledWith({ ok: false, error: 'bad-request' })
    const r2 = vi.fn()
    l({ action: 'renderMd', markdown: 'a'.repeat(2_000_001) }, {}, r2)
    expect(r2).toHaveBeenCalledWith({ ok: false, error: 'too-large' })
  })
})

describe('Service Worker revokedUntil expiry (15g)', () => {
  const approved = [{ keyHash: 'k1', client: 'c', at: 1, serverKey: 's' }]
  let changed: ((c: any, area: string) => void) | null = null
  let reqPairing: ((a: { port: number; client: string; keyHash: string }) => void) | null = null
  let tabsCreate: ReturnType<typeof vi.fn>
  let expiryMap: Map<string, number> | null = null

  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    changed = null
    reqPairing = null
    expiryMap = null
    tabsCreate = vi.fn().mockResolvedValue(undefined)
    vi.doMock('./bridge', async (orig) => {
      const actual = await orig<typeof import('./bridge')>()
      return {
        ...actual,
        createBridge: (deps: any) => {
          reqPairing = deps.requestPairing
          return actual.createBridge(deps)
        },
      }
    })
    vi.doMock('../shared/md-url', async (orig) => {
      const actual = await orig<typeof import('../shared/md-url')>()
      return {
        ...actual,
        isExpiryActive: (m: Map<string, number>, k: string, n?: number) => { expiryMap = m; return actual.isExpiryActive(m, k, n) },
        setExpiry: (m: Map<string, number>, k: string, u: number, n?: number) => { expiryMap = m; return actual.setExpiry(m, k, u, n) },
      }
    })
    globalThis.chrome = {
      runtime: {
        id: 'x', getURL: (p: string) => `chrome-extension://x/${p}`,
        onStartup: { addListener: vi.fn() }, onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() },
      },
      action: { onClicked: { addListener: vi.fn() } },
      tabs: { create: tabsCreate, update: vi.fn(), onUpdated: { addListener: vi.fn() } },
      storage: {
        sync: { get: vi.fn().mockResolvedValue({}) },
        local: { set: vi.fn(), get: vi.fn().mockResolvedValue({}), remove: vi.fn() },
        onChanged: { addListener: vi.fn((cb) => { changed = cb }) },
      },
    } as any
    await import('./index')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.doUnmock('./bridge')
    vi.doUnmock('../shared/md-url')
    delete (globalThis as any).chrome
  })

  const revoke = () => changed!({ 'mdr.bridge': { oldValue: { enabled: true, approved }, newValue: { enabled: true, approved: [] } } }, 'local')
  const pair = () => reqPairing!({ port: 47821, client: 'c', keyHash: 'k1' })

  it('ignores pairing from a revoked keyHash for 60s, accepts after, and drops the expired entry', () => {
    revoke()
    pair()
    expect(tabsCreate).not.toHaveBeenCalled()
    vi.setSystemTime(1_000_000 + 59_000)
    pair()
    expect(tabsCreate).not.toHaveBeenCalled()
    vi.setSystemTime(1_000_000 + 61_000)
    pair()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(expiryMap!.has('k1')).toBe(false)
  })

  it('sweeps other expired entries when a new revocation is recorded', () => {
    revoke()
    vi.setSystemTime(1_000_000 + 61_000)
    changed!({ 'mdr.bridge': {
      oldValue: { enabled: true, approved: [{ keyHash: 'k2', client: 'c', at: 1, serverKey: 's' }] },
      newValue: { enabled: true, approved: [] },
    } }, 'local')
    expect([...expiryMap!.keys()]).toEqual(['k2'])
  })
})
