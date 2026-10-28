import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ContentApp } from './ContentApp'
import { requestPageRender } from './render'
import React from 'react'

const FAIL = 'Không mở được MD Reader. Thử bấm biểu tượng MD Reader trên thanh công cụ.'

afterEach(() => {
  cleanup()
  // 16f: anchor-click tests move the hash; later tests build storage keys from location.href
  history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

let removeMock: any

function setupChrome(sendMessage: any, get?: any) {
  const setMock = vi.fn().mockResolvedValue(undefined)
  removeMock = vi.fn().mockResolvedValue(undefined)
  globalThis.chrome = {
    runtime: { getURL: vi.fn((p) => `chrome-extension://123/${p}`), sendMessage },
    storage: { local: { set: setMock, remove: removeMock, get: get ?? vi.fn().mockResolvedValue({}) } },
  } as any
  return setMock
}

describe('ContentApp', () => {
  it('click open caches { text, ts } once and messages the worker', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const send = vi.fn((_m: any, cb: any) => cb?.({ success: true }))
    const setMock = setupChrome(send)

    render(<ContentApp markdown="# Test" />)
    fireEvent.click(await screen.findByRole('button', { name: /Đọc trong MD Reader/i }))

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(setMock).toHaveBeenCalledTimes(1)
    const arg = setMock.mock.calls[0]![0]
    expect(arg['file_content_http://localhost:3000/']).toEqual({ text: '# Test', ts: expect.any(Number) })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toMatchObject({ action: 'openApp', fileUrl: 'http://localhost:3000/' })
    expect(openSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(FAIL)).toBeNull()
    openSpy.mockRestore()
  })

  it('shows honest failure text and never calls window.open when worker fails', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    setupChrome(vi.fn((_m: any, cb: any) => cb?.({ success: false })))

    render(<ContentApp markdown="# Test" />)
    fireEvent.click(await screen.findByRole('button', { name: /Đọc trong MD Reader/i }))

    expect(await screen.findByText(FAIL)).toBeTruthy()
    expect(removeMock).toHaveBeenCalledWith('file_content_http://localhost:3000/')
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('renders tab; Ẩn writes collapsed=true and shows strip', async () => {
    const setMock = setupChrome(vi.fn())
    render(<ContentApp markdown="# T" />)
    expect(await screen.findByRole('button', { name: /Đọc trong MD Reader/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn' }))
    expect(setMock).toHaveBeenCalledWith({ 'mdr.widget.collapsed': true })
    expect(screen.queryByRole('button', { name: /Đọc trong MD Reader/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Mở MD Reader/ })).toBeTruthy()
  })

  it('stored true on mount collapses', async () => {
    setupChrome(vi.fn(), vi.fn().mockResolvedValue({ 'mdr.widget.collapsed': true }))
    render(<ContentApp markdown="# T" />)
    expect(await screen.findByRole('button', { name: /Mở MD Reader/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Đọc trong MD Reader/ })).toBeNull()
  })

  it('renders nothing until stored state resolves', async () => {
    let resolve!: (v: any) => void
    setupChrome(vi.fn(), vi.fn(() => new Promise((r) => (resolve = r))))
    const { container } = render(<ContentApp markdown="# T" />)
    expect(container.innerHTML).toBe('')
    resolve({ 'mdr.widget.collapsed': true })
    expect(await screen.findByRole('button', { name: /Mở MD Reader/ })).toBeTruthy()
  })

  it('storage error stays expanded', async () => {
    setupChrome(vi.fn(), vi.fn().mockRejectedValue(new Error('x')))
    render(<ContentApp markdown="# T" />)
    expect(await screen.findByRole('button', { name: /Đọc trong MD Reader/ })).toBeTruthy()
  })

  describe('reader mode', () => {
    const R = { html: '<h1>Hi</h1><p>x</p>', title: 'Hi' }

    it('shows article and bar', async () => {
      setupChrome(vi.fn())
      const { container } = render(<ContentApp markdown="# Hi" render={R} />)
      expect(await screen.findByRole('button', { name: /Đọc trong MD Reader/ })).toBeTruthy()
      expect(container.querySelector('article.doc h1')?.textContent).toBe('Hi')
      expect(container.querySelector('header.bar')?.textContent).toContain('Hi')
      expect(screen.getByRole('button', { name: 'Xem bản thô' })).toBeTruthy()
    })

    it('toggles raw view', async () => {
      setupChrome(vi.fn())
      const onShowRaw = vi.fn()
      render(<ContentApp markdown="# Hi" render={R} onShowRaw={onShowRaw} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Xem bản thô' }))
      expect(onShowRaw).toHaveBeenLastCalledWith(true)
      fireEvent.click(screen.getByRole('button', { name: 'Xem bản đọc' }))
      expect(onShowRaw).toHaveBeenLastCalledWith(false)
      expect(screen.getByRole('button', { name: 'Xem bản thô' })).toBeTruthy()
    })

    describe('anchor clicks', () => {
      const A = { html: '<a id="l1" href="#sec">go</a><a id="l2" href="#">top</a><a id="l3" href="#missing">m</a><h2 id="sec">S</h2>', title: 'T' }
      const setup = () => {
        setupChrome(vi.fn())
        const { container } = render(<ContentApp markdown="# T" render={A} />)
        const target = container.querySelector('#sec') as HTMLElement
        target.scrollIntoView = vi.fn()
        return { container, target }
      }
      const click = (el: Element, init: MouseEventInit = {}) => {
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
        el.dispatchEvent(ev)
        return ev
      }

      it('plain click scrolls and prevents default', async () => {
        const { container, target } = setup()
        const ev = click(container.querySelector('#l1')!)
        expect(target.scrollIntoView).toHaveBeenCalled()
        expect(ev.defaultPrevented).toBe(true)
      })
      it('ctrl-click is not prevented', async () => {
        const { container, target } = setup()
        const ev = click(container.querySelector('#l1')!, { ctrlKey: true })
        expect(ev.defaultPrevented).toBe(false)
        expect(target.scrollIntoView).not.toHaveBeenCalled()
      })
      it("'#' is not prevented", async () => {
        const { container } = setup()
        expect(click(container.querySelector('#l2')!).defaultPrevented).toBe(false)
      })
      it("'#missing' is not prevented", async () => {
        const { container } = setup()
        expect(click(container.querySelector('#l3')!).defaultPrevented).toBe(false)
      })
    })

    it('open button sends openApp', async () => {
      const send = vi.fn((_m: any, cb: any) => cb?.({ success: true }))
      setupChrome(send)
      render(<ContentApp markdown="# Hi" render={R} />)
      fireEvent.click(await screen.findByRole('button', { name: /Đọc trong MD Reader/ }))
      await waitFor(() => expect(send).toHaveBeenCalled())
      expect(send.mock.calls[0]![0]).toMatchObject({ action: 'openApp' })
    })
  })

  describe('requestPageRender', () => {
    it('ok -> PageRender', async () => {
      setupChrome(vi.fn((_m: any, cb: any) => cb?.({ ok: true, html: '<p>a</p>', title: 'T' })))
      expect(await requestPageRender('a')).toEqual({ html: '<p>a</p>', title: 'T' })
    })
    it('ok:false -> null', async () => {
      setupChrome(vi.fn((_m: any, cb: any) => cb?.({ ok: false, error: 'x' })))
      expect(await requestPageRender('a')).toBeNull()
    })
    it('no answer -> null after timeout', async () => {
      vi.useFakeTimers()
      try {
        setupChrome(vi.fn())
        const p = requestPageRender('a', 100)
        await vi.advanceTimersByTimeAsync(150)
        expect(await p).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
