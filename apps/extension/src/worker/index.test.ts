import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Service Worker', () => {
  let actionListener: (() => void) | null = null
  let updatedListener: ((tabId: number, changeInfo: any, tab: any) => Promise<void>) | null = null
  let tabsUpdateMock = vi.fn()
  let tabsCreateMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    actionListener = null
    updatedListener = null
    tabsUpdateMock = vi.fn().mockResolvedValue(undefined)
    tabsCreateMock = vi.fn().mockResolvedValue(undefined)

    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
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
      },
    } as any
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).chrome
  })

  it('opens app.html when extension icon is clicked', async () => {
    await import('./index')
    expect(actionListener).not.toBeNull()

    actionListener!()
    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://test-id/app.html',
    })
  })

  it('intercepts .md navigation and updates tab url by default', async () => {
    await import('./index')
    expect(updatedListener).not.toBeNull()

    await updatedListener!(1, { url: 'https://example.com/docs/readme.md' }, {})
    expect(tabsUpdateMock).toHaveBeenCalledWith(1, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('https://example.com/docs/readme.md'),
    })
  })

  it('does not intercept when alwaysOpenApp is false', async () => {
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ alwaysOpenApp: false })
    await import('./index')

    await updatedListener!(1, { url: 'https://example.com/docs/readme.md' }, {})
    expect(tabsUpdateMock).not.toHaveBeenCalled()
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
