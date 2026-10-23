import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react-dom/client', () => {
  return {
    createRoot: vi.fn(() => ({
      render: vi.fn()
    }))
  }
})
vi.mock('./ContentApp', () => {
  return {
    ContentApp: () => null
  }
})

describe('Content script entry point', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    Object.defineProperty(window, 'location', {
      value: { pathname: '/index.html', href: 'https://example.com/index.html', protocol: 'https:' },
      writable: true,
      configurable: true,
    })
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `mock-url/${path}`)
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({})
        }
      }
    } as any
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).chrome
  })

  it('detects markdown in pre and mounts shadow dom when alwaysOpenApp is false', async () => {
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ alwaysOpenApp: false })
    document.body.innerHTML = '<pre># Hello</pre>'; Object.defineProperty(window, 'location', { value: { pathname: '/test.md', href: 'file:///test.md', protocol: 'file:' }, writable: true });
    
    await import('./index')

    const root = document.getElementById('md-reader-root')
    expect(root).not.toBeNull()
    expect(root!.shadowRoot).not.toBeNull()
    
    const link = root!.shadowRoot!.querySelector('link[rel="stylesheet"]')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('mock-url/app.css')
  })

  it('restores body on render error when alwaysOpenApp is false', async () => {
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ alwaysOpenApp: false })
    document.body.innerHTML = '<pre># Hello</pre>'; Object.defineProperty(window, 'location', { value: { pathname: '/test.md', href: 'file:///test.md', protocol: 'file:' }, writable: true });
    
    const { createRoot } = await import('react-dom/client')
    vi.mocked(createRoot).mockImplementationOnce(() => {
      throw new Error('Render error')
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await import('./index')

    expect(consoleError).toHaveBeenCalled()
    expect(document.body.innerHTML).toBe('<pre># Hello</pre>')
    expect(document.getElementById('md-reader-root')).toBeNull()
  })

  it('does nothing if no markdown detected', async () => {
    document.body.innerHTML = '<div>Not markdown</div>'
    
    await import('./index')

    expect(document.getElementById('md-reader-root')).toBeNull()
  })
  it('does nothing if autoFormatMd is false', async () => {
    document.body.innerHTML = '<pre># Hello</pre>'; Object.defineProperty(window, 'location', { value: { pathname: '/test.md', href: 'file:///test.md', protocol: 'file:' }, writable: true });
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ autoFormatMd: false })
    
    await import('./index')

    expect(document.getElementById('md-reader-root')).toBeNull()
  })

  it('alwaysOpenApp: caches { text, ts } then messages worker; no location.replace', async () => {
    const replaceMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { pathname: '/test.md', href: 'file:///test.md', protocol: 'file:', replace: replaceMock },
      writable: true,
      configurable: true,
    })
    document.body.innerHTML = '<pre># My Markdown Content</pre>'

    const localSetMock = vi.fn().mockResolvedValue(undefined)
    ;(chrome.storage as any).local = { set: localSetMock }
    const sendMessage = vi.fn()
    ;(chrome.runtime as any).sendMessage = sendMessage
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ alwaysOpenApp: true })

    await import('./index')

    expect(localSetMock).toHaveBeenCalledTimes(1)
    expect(localSetMock.mock.calls[0]![0]['file_content_file:///test.md']).toEqual({
      text: '# My Markdown Content',
      ts: expect.any(Number),
    })
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'openApp', fileUrl: 'file:///test.md' }))
    expect(replaceMock).not.toHaveBeenCalled()
    expect(document.getElementById('md-reader-root')).toBeNull()
  })

  it('mounts floating widget by default when alwaysOpenApp is not set', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/test.md', href: 'file:///test.md', protocol: 'file:' },
      writable: true,
      configurable: true,
    })
    document.body.innerHTML = '<pre># Default Markdown Content</pre>'
    
    const localSetMock = vi.fn().mockResolvedValue(undefined)
    ;(chrome.storage as any).local = { set: localSetMock }
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({})

    await import('./index')

    expect(document.getElementById('md-reader-root')).not.toBeNull()
    expect(localSetMock).not.toHaveBeenCalled()
  })
})
