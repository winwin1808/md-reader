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
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `mock-url/${path}`)
      }
    } as any
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).chrome
  })

  it('detects markdown in pre and mounts shadow dom', async () => {
    document.body.innerHTML = '<pre># Hello</pre>'; Object.defineProperty(window, 'location', { value: { pathname: '/test.md', protocol: 'file:' }, writable: true });
    
    await import('./index')

    const root = document.getElementById('md-reader-root')
    expect(root).not.toBeNull()
    expect(root!.shadowRoot).not.toBeNull()
    
    const link = root!.shadowRoot!.querySelector('link[rel="stylesheet"]')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('mock-url/app.css')
  })

  it('restores body on render error', async () => {
    document.body.innerHTML = '<pre># Hello</pre>'; Object.defineProperty(window, 'location', { value: { pathname: '/test.md', protocol: 'file:' }, writable: true });
    
    const { createRoot } = await import('react-dom/client')
    vi.mocked(createRoot).mockImplementation(() => {
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
})
