import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const flags = vi.hoisted(() => ({ real: false, roots: [] as any[] }))
vi.mock('react-dom/client', async (orig) => {
  const actual: any = await orig()
  return {
    ...actual,
    createRoot: vi.fn((el: any) => {
      if (!flags.real) return { render: vi.fn() }
      const r = actual.createRoot(el)
      flags.roots.push(r)
      return r
    }),
  }
})
vi.mock('./ContentApp', async (orig) => {
  const actual: any = await orig()
  return { ...actual, ContentApp: (props: any) => (flags.real ? actual.ContentApp(props) : null) }
})

describe('Content script entry point', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['vi-VN'])
    flags.real = false
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
    for (const r of flags.roots.splice(0)) r.unmount()
    document.getElementById('md-reader-root')?.remove()
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
    
    expect(root!.shadowRoot!.querySelector('link')).toBeNull()
    expect(root!.shadowRoot!.querySelectorAll('style').length).toBe(1)

    const { createRoot } = await import('react-dom/client')
    const target = vi.mocked(createRoot).mock.calls[0]![0] as HTMLElement
    expect(target).not.toBe(root!.shadowRoot)
    expect(target.tagName).toBe('DIV')
    expect(target.parentNode).toBe(root!.shadowRoot)
    expect(root!.shadowRoot!.querySelector('style')!.parentNode).toBe(root!.shadowRoot)
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
    const sendMessage = vi.fn((_m: any, cb?: any) => cb?.({ success: true }))
    ;(chrome.runtime as any).sendMessage = sendMessage
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ alwaysOpenApp: true })

    await import('./index')

    expect(localSetMock).toHaveBeenCalledTimes(1)
    expect(localSetMock.mock.calls[0]![0]['file_content_file:///test.md']).toEqual({
      text: '# My Markdown Content',
      ts: expect.any(Number),
    })
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'openApp', fileUrl: 'file:///test.md' }), expect.any(Function))
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

  it('alwaysOpenApp + sendMessage rejects: key removed and failure text rendered', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/test.md', href: 'file:///test.md', protocol: 'file:' },
      writable: true,
      configurable: true,
    })
    document.body.innerHTML = '<pre># X</pre>'
    const remove = vi.fn().mockResolvedValue(undefined)
    ;(chrome.storage as any).local = { set: vi.fn().mockResolvedValue(undefined), remove }
    ;(chrome.runtime as any).sendMessage = vi.fn(() => Promise.reject(new Error('x')))
    vi.mocked(chrome.storage.sync.get as any).mockResolvedValueOnce({ alwaysOpenApp: true })
    const renders: any[] = []
    const { createRoot } = await import('react-dom/client')
    vi.mocked(createRoot).mockImplementationOnce((() => ({ render: (el: any) => renders.push(el) })) as any)

    await import('./index')
    await vi.waitFor(() => expect(renders.length).toBe(1))

    expect(remove).toHaveBeenCalledWith('file_content_file:///test.md')
    const { FAIL_TEXT } = await import('./ContentApp')
    expect(renders[0].props.children.props.initialError).toBe(FAIL_TEXT)
    expect(document.getElementById('md-reader-root')).not.toBeNull()
  })

  describe('reader mode hide/restore', () => {
    const mdLocation = () =>
      Object.defineProperty(window, 'location', {
        value: { pathname: '/test.md', href: 'file:///test.md', protocol: 'file:' },
        writable: true,
        configurable: true,
      })
    const answer = (ok: boolean, delay = 0, html = '<h1 id="user-content-t">T</h1><p>body</p>') => {
      ;(chrome.runtime as any).sendMessage = vi.fn((_m: any, cb?: any) => {
        setTimeout(() => cb?.(ok ? { ok: true, html, title: 'T' } : { ok: false }), delay)
      })
    }

    it('(a) pre is hidden while reading and gets its previous inline style back', async () => {
      mdLocation()
      answer(true)
      document.body.innerHTML = '<pre style="display: block">x</pre>'
      const pre = document.querySelector('pre')!
      let raw: any
      const { createRoot } = await import('react-dom/client')
      vi.mocked(createRoot).mockImplementationOnce((() => ({ render: (el: any) => (raw = el) })) as any)
      await import('./index')
      await vi.waitFor(() => expect(raw).toBeDefined())
      expect(pre.style.display).toBe('none')
      const onShowRaw = raw.props.children.props.onShowRaw
      onShowRaw(true)
      expect(pre.getAttribute('style')).toBe('display: block;')
      expect(document.getElementById('md-reader-root')!.getAttribute('data-mode')).toBe('raw')
      onShowRaw(false)
      expect(pre.style.display).toBe('none')
    })

    it('(b) body children are hidden except the root, then restored', async () => {
      mdLocation()
      answer(true)
      document.body.innerHTML = '<div id="a"># one</div><p id="b">two</p>'
      const { createRoot } = await import('react-dom/client')
      let raw: any
      vi.mocked(createRoot).mockImplementationOnce((() => ({ render: (el: any) => (raw = el) })) as any)
      await import('./index')
      await vi.waitFor(() => expect(raw).toBeDefined())
      const kids = Array.from(document.body.children) as HTMLElement[]
      const rootEl = document.getElementById('md-reader-root')!
      for (const k of kids) expect(k.style.display).toBe(k === rootEl ? '' : 'none')
      raw.props.children.props.onShowRaw(true)
      for (const k of kids) expect(k.style.display).toBe('')
    })

    it('(c) render error shows the source again and removes the root', async () => {
      mdLocation()
      answer(true)
      document.body.innerHTML = '<pre>x</pre>'
      const { createRoot } = await import('react-dom/client')
      vi.mocked(createRoot).mockImplementationOnce(() => {
        throw new Error('boom')
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await import('./index')
      await vi.waitFor(() => expect(createRoot).toHaveBeenCalled())
      expect(document.querySelector('pre')!.style.display).toBe('')
      expect(document.getElementById('md-reader-root')).toBeNull()
    })

    it('(d) two concurrent runs mount exactly one root', async () => {
      mdLocation()
      answer(true, 50)
      document.body.innerHTML = '<pre>x</pre>'
      await import('./index')
      vi.resetModules()
      await import('./index')
      await new Promise((r) => setTimeout(r, 200))
      expect(document.querySelectorAll('#md-reader-root').length).toBe(1)
    })

    it('(e) worker ok:false keeps the tab UI and the source visible', async () => {
      mdLocation()
      answer(false)
      document.body.innerHTML = '<pre>x</pre>'
      await import('./index')
      await vi.waitFor(() => expect(document.getElementById('md-reader-root')).not.toBeNull())
      const rootEl = document.getElementById('md-reader-root')!
      expect(rootEl.hasAttribute('data-mode')).toBe(false)
      expect(document.querySelector('pre')!.style.display).toBe('')
    })

    it('in-document links scroll to ids inside the shadow root', async () => {
      mdLocation()
      flags.real = true
      answer(true, 0, '<p><a href="#user-content-x">go</a> <a href="#nope">no</a></p><h2 id="user-content-x">X</h2>')
      document.body.innerHTML = '<pre>x</pre>'
      const scroll = vi.fn()
      ;(Element.prototype as any).scrollIntoView = scroll
      const replace = vi.spyOn(history, 'replaceState')
      await import('./index')
      const shadow = () => document.getElementById('md-reader-root')!.shadowRoot!
      await vi.waitFor(() => expect(shadow().querySelector('article a')).not.toBeNull())
      const a = shadow().querySelector('article a') as HTMLAnchorElement
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
      a.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(true)
      expect(scroll).toHaveBeenCalledWith({ block: 'start' })
      expect(replace).toHaveBeenCalled()
    })
  })
})
