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
      'file_content_file:///test.md': '# Hello',
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
})
