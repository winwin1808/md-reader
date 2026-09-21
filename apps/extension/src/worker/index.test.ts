import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Service Worker', () => {
  let actionListener: ((tab?: any) => Promise<void> | void) | null = null
  let updatedListener: ((tabId: number, changeInfo: any, tab: any) => Promise<void>) | null = null
  let tabsUpdateMock = vi.fn()
  let tabsCreateMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    actionListener = null
    updatedListener = null
    tabsUpdateMock = vi.fn().mockResolvedValue(undefined)
    tabsCreateMock = vi.fn().mockResolvedValue(undefined)

    let messageListener: ((message: any, sender: any, sendResponse: any) => boolean | void) | null = null

    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
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

  it('does not intercept file:// URLs in tabs.onUpdated', async () => {
    await import('./index')
    expect(updatedListener).not.toBeNull()

    await updatedListener!(1, { url: 'file:///Users/me/document.md' }, {})
    expect(tabsUpdateMock).not.toHaveBeenCalled()
  })

  it('does not intercept .md navigation by default (alwaysOpenApp is false)', async () => {
    await import('./index')
    expect(updatedListener).not.toBeNull()

    await updatedListener!(1, { url: 'https://example.com/docs/readme.md' }, {})
    expect(tabsUpdateMock).not.toHaveBeenCalled()
  })

  it('intercepts .md navigation and updates tab url when alwaysOpenApp is true', async () => {
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ alwaysOpenApp: true })
    await import('./index')
    expect(updatedListener).not.toBeNull()

    await updatedListener!(1, { url: 'https://example.com/docs/readme.md' }, {})
    expect(tabsUpdateMock).toHaveBeenCalledWith(1, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('https://example.com/docs/readme.md'),
    })
  })

  it('does not intercept GitHub web blob pages', async () => {
    await import('./index')

    await updatedListener!(1, { url: 'https://github.com/facebook/react/blob/main/README.md' }, {})
    expect(tabsUpdateMock).not.toHaveBeenCalled()
  })

  it('does not intercept extension URLs', async () => {
    await import('./index')

    await updatedListener!(1, { url: 'chrome-extension://test-id/app.html?file=abc.md' }, {})
    expect(tabsUpdateMock).not.toHaveBeenCalled()
  })
})
