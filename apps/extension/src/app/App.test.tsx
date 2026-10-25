import 'fake-indexeddb/auto'
import React from 'react'
import { render, screen, act, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { App } from './App'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as core from '@md-reader/core'
import * as ui from '@md-reader/ui'
import * as deckMod from '@md-reader/ui/deck'
import * as docxMod from '@md-reader/core/docx'
import type { ReaderSettings } from '@md-reader/ui'
import { WordCountBar, CelebrationConfetti, SettingsModal, EditorView } from '@md-reader/ui'
import { DEFAULT_SERVER_URL } from '../shared/collab'
import * as fsSystem from './fs/file-system'


const saveOverride = vi.hoisted(() => ({ state: null as any, canSaveAs: false }))
const lastSession = vi.hoisted(() => ({ s: null as any }))
const docOverride = vi.hoisted(() => ({ syncStatus: null as any, shareDoc: false, external: false, accept: null as any, dismiss: null as any, awareness: null as any }))
vi.mock('./hooks/useFileSave', async (orig) => {
  const actual: any = await orig()
  return { ...actual, useFileSave: (...a: any[]) => {
    const r = actual.useFileSave(...a)
    return saveOverride.state ? { ...r, saveState: saveOverride.state } : r
  } }
})
const useSessionCalls: any[] = []
vi.mock('./hooks/useDocSession', async (orig) => {
  const actual: any = await orig()
  return { ...actual, useDocSession: (...a: any[]) => {
    useSessionCalls.push(a[0])
    const r0 = actual.useDocSession(...a)
    lastSession.s = r0
    const r1 = docOverride.shareDoc ? { ...r0, docId: 'd-share', hasContent: true, content: '# Hi' } : r0
    const r2 = docOverride.syncStatus ? { ...r1, syncStatus: docOverride.syncStatus } : r1
    const r = docOverride.awareness ? { ...r2, awareness: docOverride.awareness } : r2
    return docOverride.external
      ? { ...r, externalChange: { remoteText: 'x', remoteHash: 'h' }, acceptExternal: docOverride.accept, dismissExternal: docOverride.dismiss }
      : r
  } }
})

vi.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: vi.fn().mockImplementation(function() {
      return {
        destroy: vi.fn(),
        once: vi.fn(),
      }
    }),
  }
})

const touchSpy = vi.hoisted(() => vi.fn(async (..._a: any[]) => {}))
vi.mock('./doc-registry', () => {
  const recs = new Map<string, any>()
  return {
    migrateLegacyRegistry: async () => 0,
    docQuery: async (id: string) => '?d=doc-' + id,
    resolveDocParam: async () => null,
    docParam: (r: any) => 'doc-' + r.docId,
    findByOrigin: async (o: string) => recs.get(o) ?? null,
    getRecord: async () => null,
    createRecord: async (i: any) => { const r = { docId: 'd-' + recs.size, lastOpenedAt: 0, hasHandle: false, persistenceName: 'p', ...i }; recs.set(i.originPath, r); return r },
    findOrCreateByOrigin: async (i: any) => { const e = recs.get(i.originPath); if (e) return e; const r = { docId: 'd-' + recs.size, lastOpenedAt: 0, hasHandle: false, persistenceName: 'p', ...i }; recs.set(i.originPath, r); return r },
    touchRecord: touchSpy,
    listRecent: async () => [],
    storeHandle: async () => {},
    getHandle: async () => null,
    getDirHandle: async () => null,
    storeDirHandle: async () => {},
    writeDocText: async () => 'written',
    storeBase: async () => {},
    getBase: async () => null,
  }
})

class MockBroadcastChannel {
  name: string
  static instances: MockBroadcastChannel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {}
  postMessage = vi.fn((data: any) => {
    for (const inst of MockBroadcastChannel.instances) {
      if (inst !== this && inst.name === this.name) {
        const event = new MessageEvent('message', { data })
        inst.onmessage?.(event)
        inst.listeners['message']?.forEach(fn => fn(event))
      }
    }
  })
  close = vi.fn(() => {
    const idx = MockBroadcastChannel.instances.indexOf(this)
    if (idx !== -1) MockBroadcastChannel.instances.splice(idx, 1)
  })

  constructor(name: string) {
    this.name = name
    MockBroadcastChannel.instances.push(this)
  }

  addEventListener(event: string, fn: (event: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }

  removeEventListener(event: string, fn: (event: MessageEvent) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn)
    }
  }
}

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
    delete (window as any).location
    window.location = new URL('http://localhost/') as any
  })

  beforeEach(() => {
    delete (window as any).location
    window.location = new URL('http://localhost/') as any
    if (!Range.prototype.getClientRects) {
      Range.prototype.getClientRects = () => [] as any
    }
    if (!Range.prototype.getBoundingClientRect) {
      Range.prototype.getBoundingClientRect = () => ({
        x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, toJSON: () => {}
      }) as any
    }
    vi.clearAllMocks();
    MockBroadcastChannel.instances = []
    Object.defineProperty(window, 'BroadcastChannel', {
      value: MockBroadcastChannel,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      value: MockBroadcastChannel,
      writable: true,
      configurable: true,
    });
    
    // Mock chrome storage
    (window as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ recentFiles: [] }),
          set: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({ theme: 'dark' }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as any

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  it('shows a visible, dismissible error when export fails', async () => {
    vi.spyOn(docxMod, 'mdastToDocx').mockRejectedValue(new Error('boom'))
    await act(async () => { render(<App />) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Xuất file' })) })
    await act(async () => { fireEvent.click(screen.getByText('Word (.docx)')) })
    expect((await screen.findByRole('alert')).textContent).toContain('boom')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDefined()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Đóng' })) })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  describe('notices', () => {
    afterEach(() => { saveOverride.state = null; docOverride.external = false })

    it('needs-permission: no banner, toolbar carries the prompt', async () => {
      saveOverride.state = { kind: 'needs-permission', fileName: 'a.md' }
      await act(async () => { render(<App />) })
      expect(document.querySelector('.error-banner')).toBeNull()
      expect(screen.getByText('Cần cấp quyền ghi')).toBeDefined()
      expect(screen.getAllByText('Cấp quyền').length).toBe(1)
    })

    it('externalChange: new copy, both buttons call handlers, no inline styles', async () => {
      docOverride.external = true
      docOverride.accept = vi.fn(); docOverride.dismiss = vi.fn()
      await act(async () => { render(<App />) })
      expect(screen.getByText(/Tài liệu gốc đã thay đổi từ lần mở trước/)).toBeDefined()
      const banner = document.querySelector('.error-banner.notice') as HTMLElement
      expect(banner).not.toBeNull()
      expect(banner.getAttribute('role')).toBe('status')
      expect(banner.querySelectorAll('[style]').length).toBe(0)
      expect(banner.hasAttribute('style')).toBe(false)
      fireEvent.click(screen.getByText('Tải bản mới'))
      fireEvent.click(screen.getByText('Giữ bản của tôi'))
      expect(docOverride.accept).toHaveBeenCalled()
      expect(docOverride.dismiss).toHaveBeenCalled()
    })

    it('save error: message, Thử lại and Lưu thành file khác…', async () => {
      saveOverride.state = { kind: 'error', message: 'disk full', canSaveAs: true }
      await act(async () => { render(<App />) })
      const banner = document.querySelector('.error-banner.notice') as HTMLElement
      expect(banner.getAttribute('role')).toBe('alert')
      expect(banner.textContent).toContain('Không lưu được: disk full')
      expect(banner.querySelectorAll('[style]').length).toBe(0)
      expect(Array.from(banner.querySelectorAll('button')).map(b => b.textContent)).toEqual(['Thử lại', 'Lưu thành file khác…'])
    })

    it('save error without canSaveAs hides Lưu thành file khác…', async () => {
      saveOverride.state = { kind: 'error', message: 'x', canSaveAs: false }
      await act(async () => { render(<App />) })
      expect(screen.queryByText('Lưu thành file khác…')).toBeNull()
    })
  })

  it('renders ExportModal and triggers export logic for pdf, html, and docx', async () => {
    vi.useFakeTimers()
    const printSpy = vi.spyOn(ui, 'printDocument').mockImplementation(() => {})
    const printSlidesSpy = vi.spyOn(ui, 'printSlides').mockImplementation(() => { expect(document.querySelector('.deck-print-container')).not.toBeNull() })
    const htmlSpy = vi.spyOn(core, 'exportToHtml').mockResolvedValue('<html><body>Exported</body></html>')
    const docxSpy = vi.spyOn(docxMod, 'mdastToDocx').mockResolvedValue(new Blob(['docx-content']))
    let lastDownloaded = ''
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      lastDownloaded = this.download
    })

    await act(async () => {
      render(<App />)
    })

    const exportBtn = screen.getByRole('button', { name: 'Xuất file' })
    expect(exportBtn).toBeDefined()

    // 1. Trigger PDF export
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    const pdfOption = screen.getByText('PDF để in')
    await act(async () => {
      fireEvent.click(pdfOption)
    })
    expect(printSpy).toHaveBeenCalled()

    // 2. Trigger HTML export
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    const htmlOption = screen.getByText('Trang web (.html)')
    await act(async () => {
      fireEvent.click(htmlOption)
    })
    expect(htmlSpy).toHaveBeenCalledWith(expect.objectContaining({
      cssContent: expect.stringContaining('68ch'),
      title: 'document',
    }))
    expect(clickSpy).toHaveBeenCalled()
    expect(lastDownloaded).toBe('document.html')
    expect(window.URL.createObjectURL).toHaveBeenCalled()
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1)

    // 3. Trigger DOCX export
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    const docxOption = screen.getByText('Word (.docx)')
    await act(async () => {
      fireEvent.click(docxOption)
    })
    expect(docxSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'document',
    }))
    expect(lastDownloaded).toBe('document.docx')
    expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(2)

    // 4. A document without slides does not offer the slides PDF
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    expect(screen.queryByText('PDF trình chiếu')).toBeNull()
    expect(document.querySelector('.deck-print-container')).toBeNull()

    vi.useRealTimers()
  })

  it('offers slides PDF for a doc with breaks, calls printSlides with deck container, and skips slide detection while closed', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# A\n\nx\n---\n\n# B\n\ny'),
    } as any)
    const printSlidesSpy = vi.spyOn(ui, 'printSlides').mockImplementation(() => { expect(document.querySelector('.deck-print-container')).not.toBeNull() })
    const splitSpy = vi.spyOn(core, 'splitIntoSlides')

    await act(async () => { render(<App />) })
    expect(splitSpy).not.toHaveBeenCalled()

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Xuất file' })) })
    expect(splitSpy).toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByText('PDF trình chiếu')) })
    expect(printSlidesSpy).toHaveBeenCalled()
  })

  it('renders placeholder with loaded theme and yjs doc', async () => {
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
    expect(placeholder.textContent).toContain('Mở một tài liệu Markdown')
    expect(within(placeholder).getByRole('button', { name: /Mở file…/ })).not.toBeNull()
    
    // no ?doc / ?file -> no persistence is opened
    expect(IndexeddbPersistence).not.toHaveBeenCalled()
    expect((window as any).chrome.storage.sync.get).toHaveBeenCalledWith(null)
  })
  
  it('falls back to system theme when storage throws', async () => {
    (window as any).chrome.storage.sync.get = vi.fn().mockRejectedValue(new Error('no permission'))
    
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
    // open settings modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }))
    })
    const sys = screen.getByRole('radio', { name: /Theo hệ thống/ })
    expect(sys.getAttribute('aria-checked') === 'true' || (sys as HTMLInputElement).checked).toBe(true)
  })

  it('handles IndexeddbPersistence throwing', async () => {
    vi.mocked(IndexeddbPersistence).mockImplementationOnce(function() {
      throw new Error('idb error')
    } as any)
    
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
  })

  it('narrow screens: ToC is a dialog drawer closed by Esc, focus returns to toggle', async () => {
    const orig = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    })) as any
    try {
      delete (window as any).location
      window.location = new URL('http://localhost/?file=test.md') as any
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('# One\n\n## Two\n\ntext'),
      } as any)
      await act(async () => { render(<App />) })
      expect(screen.queryByRole('dialog', { name: 'Mục lục' })).toBeNull()
      const toggle = screen.getByRole('button', { name: 'Mục lục' })
      await act(async () => { fireEvent.click(toggle) })
      expect(screen.getByRole('dialog', { name: 'Mục lục' })).toBeDefined()
      await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })
      expect(screen.queryByRole('dialog', { name: 'Mục lục' })).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mục lục' }))
    } finally {
      window.matchMedia = orig
    }
  })

  describe('ToC rail/drawer state separation', () => {
    function mockMq(initial: boolean) {
      let matches = initial
      const ls = new Set<() => void>()
      const orig = window.matchMedia
      window.matchMedia = ((q: string) => ({
        get matches() { return matches }, media: q,
        addEventListener: (_: string, l: () => void) => { ls.add(l) },
        removeEventListener: (_: string, l: () => void) => { ls.delete(l) },
        addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
      })) as any
      return {
        set: (m: boolean) => { matches = m; ls.forEach(l => l()) },
        restore: () => { window.matchMedia = orig },
      }
    }
    async function load() {
      delete (window as any).location
      window.location = new URL('http://localhost/?file=test.md') as any
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('# One\n\n## Two\n\ntext'),
      } as any)
      await act(async () => { render(<App />) })
    }

    it('narrow -> open drawer -> widen: rail visible, drawer gone', async () => {
      const mq = mockMq(true)
      try {
        await load()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mục lục' })) })
        expect(screen.getByRole('dialog', { name: 'Mục lục' })).toBeDefined()
        await act(async () => { mq.set(false) })
        expect(screen.queryByRole('dialog', { name: 'Mục lục' })).toBeNull()
        expect(document.querySelector('.sidebar-toc')).not.toBeNull()
      } finally { mq.restore() }
    })

    it('narrow load does not hide the rail after widening', async () => {
      const mq = mockMq(true)
      try {
        await load()
        expect(document.querySelector('.sidebar-toc')).toBeNull()
        await act(async () => { mq.set(false) })
        expect(document.querySelector('.sidebar-toc')).not.toBeNull()
      } finally { mq.restore() }
    })

    it('Tab from the last drawer link wraps to the first', async () => {
      const mq = mockMq(true)
      try {
        await load()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mục lục' })) })
        const links = Array.from(screen.getByRole('dialog', { name: 'Mục lục' }).querySelectorAll<HTMLElement>('a[href], button'))
        expect(links.length).toBeGreaterThan(1)
        links[links.length - 1]!.focus()
        await act(async () => { fireEvent.keyDown(document, { key: 'Tab' }) })
        expect(document.activeElement).toBe(links[0])
      } finally { mq.restore() }
    })
  })

  it('renders ReadingProgress and .a4-document-container when content is loaded', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=test.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Hello World\n\nContent here'),
    } as any)

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })

    const { container } = renderResult
    expect(screen.getByRole('progressbar')).toBeDefined()
    expect(container.querySelector('.a4-document-container')).not.toBeNull()
    expect(container.querySelector('.a4-document-container .md-viewer')).not.toBeNull()
  })

  it('renders TopToolbar, handles fontScale changes, and toggles reading mode', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Guide\n\n## Section 1\n\nContent'),
    } as any)

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })

    const { container } = renderResult

    // TopToolbar should render the document title
    expect(screen.getByText('guide')).toBeDefined()

    // Default fontScale is md on container
    expect(container.querySelector('[data-font-scale="md"]')).not.toBeNull()

    // Sidebar ToC should be visible initially when tocOpen is true
    expect(container.querySelector('.sidebar-toc')).not.toBeNull()

    // Font scale increase: click "Tăng cỡ chữ"
    fireEvent.click(screen.getByRole('button', { name: 'Thêm' }))
    const incBtn = screen.getByTitle('Tăng cỡ chữ')
    await act(async () => {
      fireEvent.click(incBtn)
    })
    expect(container.querySelector('[data-font-scale="lg"]')).not.toBeNull()
    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith({ fontScale: 'lg' })

    // ToC toggle button: click "Mục lục" to close
    const tocBtn = screen.getByTitle('Mục lục')
    await act(async () => {
      fireEvent.click(tocBtn)
    })
    expect(container.querySelector('.sidebar-toc')).toBeNull()

    // Click "Mục lục" again to re-open
    await act(async () => {
      fireEvent.click(tocBtn)
    })
    expect(container.querySelector('.sidebar-toc')).not.toBeNull()

    // Reading mode button in TopToolbar
    const readingModeBtn = screen.getByRole('menuitem', { name: 'Chế độ đọc' })
    expect(readingModeBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(readingModeBtn)
    })

    // Container should now have reading-mode class
    expect(container.querySelector('.reading-mode')).not.toBeNull()

    // Floating exit reading mode button should appear
    const exitBtn = screen.getByText('Thoát chế độ đọc')
    expect(exitBtn).toBeDefined()
    expect(exitBtn.className).toContain('exit-reading-mode-btn')
    expect(exitBtn.className).toContain('md-no-print')

    // Sidebar ToC should be hidden in reading mode even though tocOpen is true
    expect(container.querySelector('.sidebar-toc')).toBeNull()

    // Click exit button
    await act(async () => {
      fireEvent.click(exitBtn)
    })

    // reading-mode class removed and sidebar-toc restored
    expect(container.querySelector('.reading-mode')).toBeNull()
    expect(screen.queryByText('Thoát chế độ đọc')).toBeNull()
    expect(container.querySelector('.sidebar-toc')).not.toBeNull()
  })

  it('opens DocumentSearch via toolbar button and closes via Escape or close button', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Guide\n\nContent'),
    } as any)

    await act(async () => {
      render(<App />)
    })

    // Search input should not be visible initially
    expect(screen.queryByPlaceholderText('Tìm trong tài liệu')).toBeNull()

    // Click search button on TopToolbar
    const searchBtn = screen.getByTitle(/tìm kiếm/i)
    await act(async () => {
      fireEvent.click(searchBtn)
    })

    // DocumentSearch input should be rendered
    expect(screen.getByPlaceholderText('Tìm trong tài liệu')).toBeDefined()

    // Press Escape to close
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByPlaceholderText('Tìm trong tài liệu')).toBeNull()

    // Re-open via Cmd+F shortcut
    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', metaKey: true })
    })
    expect(screen.getByPlaceholderText('Tìm trong tài liệu')).toBeDefined()

    // Click close button to close
    const closeBtn = screen.getByTitle(/đóng/i)
    await act(async () => {
      fireEvent.click(closeBtn)
    })
    expect(screen.queryByPlaceholderText('Tìm trong tài liệu')).toBeNull()
  })

  it('loads fontFamily, shows options in SettingsModal, and selecting font family updates storage and data-font-family', async () => {
    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    // Initial data-font-family attribute is migrated to 'serif'
    expect(container.querySelector('[data-font-family="serif"]')).not.toBeNull()

    // Open settings modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }))
    })

    // Font family options should be shown (e.g., serif button or option)
    const monoOption = screen.getByRole('button', { name: 'Đơn cách (IBM Plex Mono)' })
    expect(monoOption).toBeDefined()

    await act(async () => {
      fireEvent.click(monoOption)
    })

    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({ fontFamily: 'mono' }))
    expect(container.querySelector('[data-font-family="mono"]')).not.toBeNull()
  })

  describe('settings v2', () => {
    const load = async (stored: any) => {
      ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue(stored)
      let r: any
      await act(async () => { r = render(<App />) })
      return r.container as HTMLElement
    }
    it('migrates sans to serif when settingsVersion is absent', async () => {
      const c = await load({ fontFamily: 'sans' })
      expect(c.querySelector('.app-container')!.getAttribute('data-font-family')).toBe('serif')
    })
    it('keeps sans when settingsVersion is 2', async () => {
      const c = await load({ fontFamily: 'sans', settingsVersion: 2 })
      expect(c.querySelector('.app-container')!.getAttribute('data-font-family')).toBe('sans')
    })
    it('defaults confetti off', async () => {
      const spy = vi.spyOn(ui, 'CelebrationConfetti').mockImplementation((p: any) => { return <div data-active={String(p.active)} /> })
      await load({ settingsVersion: 2 })
      Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true })
      Object.defineProperty(window, 'scrollY', { value: 1000, writable: true, configurable: true })
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1800, writable: true, configurable: true })
      await act(async () => { fireEvent.scroll(window) })
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1)
      expect(spy.mock.calls.every((c: any[]) => c[0].active === false)).toBe(true)
    })
    it('persists migration once so a later sans choice survives remount', async () => {
      const store: any = { fontFamily: 'sans' }
      const chromeMock = (window as any).chrome.storage
      chromeMock.sync.get = vi.fn(async () => ({ ...store }))
      chromeMock.sync.set = vi.fn(async (o: any) => { Object.assign(store, o) })
      let r: any
      await act(async () => { r = render(<App />) })
      expect(chromeMock.sync.set).toHaveBeenCalledWith(expect.objectContaining({ settingsVersion: 2, fontFamily: 'serif' }))
      expect(store.settingsVersion).toBe(2)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Không chân (IBM Plex Sans)' })) })
      expect(store.fontFamily).toBe('sans')
      r.unmount()
      let r2: any
      await act(async () => { r2 = render(<App />) })
      expect(r2.container.querySelector('.app-container')!.getAttribute('data-font-family')).toBe('sans')
    })
    it('writes nothing on load when stored v2', async () => {
      await load({ fontFamily: 'sans', settingsVersion: 2 })
      expect((window as any).chrome.storage.sync.set).not.toHaveBeenCalled()
      expect((window as any).chrome.storage.local.set).not.toHaveBeenCalled()
    })
    it('falls back to standard for junk contrast', async () => {
      await load({ contrast: 'neon', settingsVersion: 2 })
      expect(document.documentElement.getAttribute('data-contrast')).toBe('standard')
    })
    it('applies stored contrast high to html', async () => {
      await load({ contrast: 'high', settingsVersion: 2 })
      expect(document.documentElement.getAttribute('data-contrast')).toBe('high')
    })
  })

  it('loads fontFamily from chrome.storage if already stored', async () => {
    ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue({
      theme: 'dark',
      fontFamily: 'mono',
    })

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    expect(container.querySelector('[data-font-family="mono"]')).not.toBeNull()
  })

  it('triggers Present mode and opens Deck when clicking Present button', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Slide 1\n\nContent 1\n\n---\n\n# Slide 2\n\nContent 2'),
    } as any)

    const deckSpy = vi.spyOn(deckMod, 'Deck').mockImplementation(() => <div data-testid="mock-deck">Deck</div>)

    await act(async () => {
      render(<App />)
    })

    const presentBtn = screen.getByRole('button', { name: 'Trình chiếu' })
    expect(presentBtn).toBeDefined()
    expect(deckSpy).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(presentBtn)
    })

    expect(deckSpy.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        initialSlide: 0,
        slides: expect.any(Array),
        mode: 'dark',
      })
    )
  })

  it('triggers Present mode when pressing "p" key unless inside input or already presenting', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Slide 1\n\nContent 1\n\n---\n\n# Slide 2\n\nContent 2'),
    } as any)

    const deckSpy = vi.spyOn(deckMod, 'Deck').mockImplementation(() => <div data-testid="mock-deck">Deck</div>)

    await act(async () => {
      render(<App />)
    })

    // Pressing 'p' inside an input should NOT trigger present mode
    const input = document.createElement('input')
    document.body.appendChild(input)
    await act(async () => {
      fireEvent.keyDown(input, { key: 'p' })
    })
    expect(deckSpy).not.toHaveBeenCalled()
    document.body.removeChild(input)

    // Pressing 'p' on document should trigger present mode
    await act(async () => {
      fireEvent.keyDown(window, { key: 'p' })
    })
    expect(deckSpy).toHaveBeenCalledTimes(1)
  })

  it('navigates slides and synchronizes with BroadcastChannel', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    window.open = vi.fn()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Slide 1\n\nContent 1\n\n---\n\n# Slide 2\n\nContent 2\n\n---\n\n# Slide 3\n\nContent 3'),
    } as any)

    let capturedDeckProps: any = null
    const deckSpy = vi.spyOn(deckMod, 'Deck').mockImplementation((props: any) => {
      capturedDeckProps = props
      return <div data-testid="mock-deck">Mock Deck</div>
    })

    await act(async () => {
      render(<App />)
    })

    const presentBtn = screen.getByRole('button', { name: 'Trình chiếu' })
    await act(async () => {
      fireEvent.click(presentBtn)
    })

    expect(deckSpy).toHaveBeenCalled()
    expect(capturedDeckProps).not.toBeNull()

    const channelInstance = MockBroadcastChannel.instances.find(c => c.name === 'md-reader-slides-sync')
    expect(channelInstance).toBeDefined()

    // Trigger slide change from Deck
    await act(async () => {
      capturedDeckProps.onSlideChange(1)
    })

    expect(channelInstance?.postMessage).toHaveBeenCalledWith({ type: 'NAVIGATE', index: 1 })

    // Simulate incoming message from peer channel
    const peerChannel = new MockBroadcastChannel('md-reader-slides-sync')
    await act(async () => {
      peerChannel.postMessage({ type: 'NAVIGATE', index: 2 })
    })

    expect(capturedDeckProps.initialSlide).toBe(2)

    // Test opening speaker view
    await act(async () => {
      capturedDeckProps.onOpenSpeakerView()
    })
    await waitFor(() => expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('speaker=true'),
      'md-speaker',
      'width=1080,height=680'
    ))

    // Test closing deck
    await act(async () => {
      capturedDeckProps.onClose()
    })
    expect(screen.queryByTestId('mock-deck')).toBeNull()
  })

  it('renders SpeakerView directly when speaker query parameter is true', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?speaker=true&file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Slide 1\n\nContent 1'),
    } as any)

    let capturedSpeakerProps: any = null
    const speakerSpy = vi.spyOn(ui, 'SpeakerView').mockImplementation((props: any) => {
      capturedSpeakerProps = props
      return <div data-testid="mock-speaker-view">Mock Speaker View</div>
    })

    await act(async () => {
      render(<App />)
    })

    expect(speakerSpy).toHaveBeenCalled()
    expect(screen.getByTestId('mock-speaker-view')).toBeDefined()
    expect(screen.queryByTestId('app-placeholder')).toBeNull()
    expect(screen.queryByTitle('Mục lục')).toBeNull()

    const channelInstance = MockBroadcastChannel.instances.find(c => c.name === 'md-reader-slides-sync')
    expect(channelInstance).toBeDefined()

    // Navigating in speaker view posts to BroadcastChannel
    await act(async () => {
      capturedSpeakerProps.onSlideChange(1)
    })
    expect(channelInstance?.postMessage).toHaveBeenCalledWith({ type: 'NAVIGATE', index: 1 })
  })

  it('speaker route applies stored themeMode to data-theme', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?speaker=true&file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('# S') } as any)
    ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue({ mode: 'dark', settingsVersion: 2 })
    await act(async () => { render(<App />) })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('loads extended settings initially from chrome.storage.sync', async () => {
    ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue({
      showReadingProgress: false,
      showWordCount: false,
      autoHideWordCount: false,
      celebrationConfetti: false,
      slideBgColor: '#112233',
    })

    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Test Document\n\nSome text content'),
    } as any)

    const wordCountSpy = vi.spyOn(ui, 'WordCountBar')

    await act(async () => {
      render(<App />)
    })

    expect((window as any).chrome.storage.sync.get).toHaveBeenCalled()
    // showReadingProgress is false -> ReadingProgress should NOT be rendered
    expect(screen.queryByRole('progressbar')).toBeNull()

    // WordCountBar receives loaded settings
    expect(wordCountSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('# Test Document'),
        visible: false,
        autoHide: false,
      }),
      undefined
    )
  })

  it('updates settings and persists to chrome.storage.sync.set', async () => {
    let capturedModalProps: any = null
    vi.spyOn(ui, 'SettingsModal').mockImplementation((props: any) => {
      capturedModalProps = props
      return <div data-testid="mock-settings-modal">SettingsModal</div>
    })

    await act(async () => {
      render(<App />)
    })

    expect(capturedModalProps).not.toBeNull()
    expect(capturedModalProps.settings).toBeDefined()

    await act(async () => {
      capturedModalProps.onSettingChange('showWordCount', false)
    })

    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith({ showWordCount: false })
  })

  it('passes settings properly to WordCountBar, CelebrationConfetti, and Deck', async () => {
    vi.useFakeTimers()
    delete (window as any).location
    window.location = new URL('http://localhost/?file=deck-test.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Slide 1\n\nContent'),
    } as any)

    let capturedWordCountProps: any = null
    vi.spyOn(ui, 'WordCountBar').mockImplementation((props: any) => {
      capturedWordCountProps = props
      return <div data-testid="mock-word-count-bar" />
    })

    let capturedConfettiProps: any = null
    vi.spyOn(ui, 'CelebrationConfetti').mockImplementation((props: any) => {
      capturedConfettiProps = props
      return <div data-testid="mock-confetti" />
    })

    let capturedDeckProps: any = null
    vi.spyOn(deckMod, 'Deck').mockImplementation((props: any) => {
      capturedDeckProps = props
      return <div data-testid="mock-deck" />
    })

    ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue({ theme: 'dark', celebrationConfetti: true, settingsVersion: 2 })
    await act(async () => {
      render(<App />)
    })

    // WordCountBar received markdown text and default visible / autoHide
    expect(capturedWordCountProps).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('# Slide 1'),
        visible: true,
        autoHide: true,
      })
    )

    // CelebrationConfetti is initially not active
    expect(capturedConfettiProps).toEqual(
      expect.objectContaining({
        active: false,
        onComplete: expect.any(Function),
      })
    )

    // Scroll to bottom triggers confetti
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 1000, writable: true, configurable: true })
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1800, writable: true, configurable: true })

    await act(async () => {
      fireEvent.scroll(window)
    })

    expect(capturedConfettiProps.active).toBe(true)

    // Completing confetti resets active
    await act(async () => {
      capturedConfettiProps.onComplete()
    })
    expect(capturedConfettiProps.active).toBe(false)

    // Deck receives presentationSettings
    const presentBtn = screen.getByRole('button', { name: 'Trình chiếu' })
    await act(async () => {
      fireEvent.click(presentBtn)
    })

    expect(capturedDeckProps.presentationSettings).toEqual(
      expect.objectContaining({
        slideBgColor: undefined,
        slideTextColor: undefined,
        slideHeadingColor: undefined,
        slideAccentColor: undefined,
        slideFont: undefined,
        slideBgImage: undefined,
        slideImageOpacity: undefined,
      })
    )

    vi.useRealTimers()
  })

  it('loads fileUrl directly from chrome.storage.local cache and updates alwaysOpenApp', async () => {
    delete (window as any).location
    ;(window as any).location = new URL('chrome-extension://mock-id/app.html?file=file%3A%2F%2F%2Ftest.md')

    const cachedKey = 'file_content_file:///test.md'
    const removeMock = vi.fn().mockResolvedValue(undefined)
    ;(window as any).chrome.storage.local.get = vi.fn().mockResolvedValue({
      [cachedKey]: '# Cached Content from Extension',
    })
    ;(window as any).chrome.storage.local.remove = removeMock

    let capturedSettingsModalProps: any = null
    vi.spyOn(ui, 'SettingsModal').mockImplementation((props: any) => {
      capturedSettingsModalProps = props
      return <div data-testid="settings-modal-mock" />
    })

    await act(async () => {
      render(<App />)
    })

    expect(capturedSettingsModalProps.settings).toEqual(
      expect.objectContaining({
        alwaysOpenApp: false,
      })
    )

    // Simulate changing alwaysOpenApp
    await act(async () => {
      capturedSettingsModalProps.onSettingChange('alwaysOpenApp', true)
    })

    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith({
      alwaysOpenApp: true,
    })
    expect(removeMock).toHaveBeenCalledWith(cachedKey)
  })

  it('opens Mindmap modal via toolbar or shortcut and clicking node scrolls to heading', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Introduction\n\nIntro text\n\n# Section 1\n\nSection 1 text'),
    } as any)

    await act(async () => {
      render(<App />)
    })

    // Mindmap modal should not be rendered initially
    expect(screen.queryByRole('dialog')).toBeNull()

    // 1. Open via Toolbar button
    const mindmapBtn = screen.getByRole('button', { name: 'Sơ đồ' })
    await act(async () => {
      fireEvent.click(mindmapBtn)
    })

    const modal = screen.getByRole('dialog')
    expect(modal).toBeDefined()
    expect(modal.querySelector('.mindmap-svg')).not.toBeNull()

    // 2. Click node to navigate
    const introHeading = document.getElementById('user-content-introduction') || document.createElement('h1')
    introHeading.id = 'user-content-introduction'
    introHeading.scrollIntoView = vi.fn()
    document.body.appendChild(introHeading)

    const introNode = Array.from(modal.querySelectorAll('.mindmap-node-text')).find(
      (el) => el.textContent === 'Introduction'
    )!
    expect(introNode).toBeDefined()

    await act(async () => {
      fireEvent.click(introNode)
    })

    expect(introHeading.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
    // Modal should be closed after node click
    expect(screen.queryByRole('dialog')).toBeNull()

    // 3. Toggle via Cmd+M shortcut
    await act(async () => {
      fireEvent.keyDown(window, { key: 'm', metaKey: true })
    })
    expect(screen.getByRole('dialog')).toBeDefined()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'm', metaKey: true })
    })
    expect(screen.queryByRole('dialog')).toBeNull()

    document.body.removeChild(introHeading)
  })

  it('switching viewMode toggles between reading and live edit', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Title\n\nContent'),
    } as any)

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    // Initial viewMode is reading
    expect(container.querySelector('.a4-document-container')).not.toBeNull()
    expect(container.querySelector('.cm-editor')).toBeNull()

    // Switch to editor mode
    const editBtn = screen.getByTitle('Sửa trên trang')
    await act(async () => {
      fireEvent.click(editBtn)
    })
    expect(container.querySelector('.cm-editor')).not.toBeNull()
    expect(container.querySelector('.md-formatting-toolbar')).not.toBeNull()

    // only two modes remain: no split / source segments
    expect(screen.queryByTitle('Chế độ Chia đôi')).toBeNull()
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Đọc', 'Sửa'])
    expect(container.querySelector('.cm-live')).not.toBeNull()
    expect(touchSpy).toHaveBeenCalledWith(expect.any(String), { viewMode: 'live' })

    // Switch back to reading mode
    const readBtn = screen.getByTitle('Chế độ Đọc')
    await act(async () => {
      fireEvent.click(readBtn)
    })
    expect(container.querySelector('.a4-document-container')).not.toBeNull()
    expect(container.querySelector('.cm-editor')).toBeNull()
  })

  it('editing text updates isDirty indicator', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Initial Content'),
    } as any)

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    // Initially not dirty
    expect(container.querySelector('.dirty-indicator')).toBeNull()

    // Switch to editor mode
    await act(async () => {
      fireEvent.click(screen.getByTitle('Sửa trên trang'))
    })

    // Edit text in editor
    const cmContent = container.querySelector('.cm-content')
    expect(cmContent).not.toBeNull()
    await act(async () => {
      fireEvent.input(cmContent!, { target: { textContent: '# Initial Content Modified' } })
    })

    // isDirty indicator should be displayed
    expect(container.querySelector('.dirty-indicator')).not.toBeNull()
  })

  it('Cmd+S shortcut triggers save and clears dirty status', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Initial Content'),
    } as any)

    const mockHandle = {
      name: 'guide.md',
      getFile: vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('# Initial Content'),
      }),
    } as any
    const saveFileAsSpy = vi.spyOn(fsSystem, 'saveFileAs').mockResolvedValue({ handle: mockHandle, file: new File([], 'guide.md') })
    vi.spyOn(fsSystem, 'saveToHandle').mockResolvedValue(100)

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    // Switch to editor and make dirty
    await act(async () => {
      fireEvent.click(screen.getByTitle('Sửa trên trang'))
    })
    const cmContent = container.querySelector('.cm-content')
    await act(async () => {
      fireEvent.input(cmContent!, { target: { textContent: '# New Text' } })
    })
    expect(container.querySelector('.dirty-indicator')).not.toBeNull()

    // Press Cmd+S
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true })
    })

    expect(saveFileAsSpy).toHaveBeenCalled()
    expect(container.querySelector('.dirty-indicator')).toBeNull()
  })

  it('conflict modal triggers when disk hash differs', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Initial Content'),
    } as any)

    const mockHandle = {
      name: 'guide.md',
      getFile: vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('# Different Disk Content'),
      }),
    } as any
    vi.spyOn(fsSystem, 'saveFileAs').mockResolvedValue({ handle: mockHandle, file: new File([], 'guide.md') })
    const saveToHandleSpy = vi.spyOn(fsSystem, 'saveToHandle').mockResolvedValue(100)

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
      for (let i = 0; i < 20; i++) await Promise.resolve()
    })
    const { container } = renderResult

    // Switch to editor
    await act(async () => {
      fireEvent.click(screen.getByTitle('Sửa trên trang'))
    })
    // Save once to establish activeHandle
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      for (let i = 0; i < 20; i++) await Promise.resolve()
    })

    // Now edit again to make it dirty
    const cmEditor = container.querySelector('.cm-editor') as HTMLElement
    expect(cmEditor).not.toBeNull()
    const view = EditorView.findFromDOM(cmEditor)
    expect(view).not.toBeNull()
    await act(async () => {
      view!.dispatch({
        changes: { from: 0, to: view!.state.doc.length, insert: '# Local Changes' },
      })
      for (let i = 0; i < 20; i++) await Promise.resolve()
    })

    // Now disk has different content and trigger save again via Cmd+S
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true })
    })

    // ConflictModal should be open
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    })

    // User chooses to keep local
    const keepLocalBtn = screen.getByText(/giữ bản của tôi|keep local/i)
    await act(async () => {
      fireEvent.click(keepLocalBtn)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Should save to handle and modal closes
    expect(saveToHandleSpy).toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('.dirty-indicator')).toBeNull()
  })

  it('debounced auto-save triggers saveToHandle 2000ms after editing when activeHandle is set', async () => {
    vi.useFakeTimers()
    try {
      delete (window as any).location
      window.location = new URL('http://localhost/?file=guide.md') as any
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('# Initial Content'),
      } as any)

      let savedDiskText = '# Initial Content'
      const mockHandle = {
        name: 'guide.md',
        getFile: vi.fn().mockImplementation(async () => ({
          text: async () => savedDiskText,
        })),
      } as any
      vi.spyOn(fsSystem, 'saveFileAs').mockResolvedValue({ handle: mockHandle, file: new File([], 'guide.md') })
      const saveToHandleSpy = vi.spyOn(fsSystem, 'saveToHandle').mockImplementation(async (_handle, text) => {
        savedDiskText = text
        return 100
      })

      let renderResult: any
      await act(async () => {
        renderResult = render(<App />)
        for (let i = 0; i < 20; i++) await Promise.resolve()
      })
      const { container } = renderResult

      // Switch to editor mode
      await act(async () => {
        fireEvent.click(screen.getByTitle('Sửa trên trang'))
      })

      // Establish activeHandle by saving once via Cmd+S
      await act(async () => {
        fireEvent.keyDown(window, { key: 's', metaKey: true })
        for (let i = 0; i < 20; i++) await Promise.resolve()
      })
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(saveToHandleSpy).toHaveBeenCalledTimes(1)
      saveToHandleSpy.mockClear()

      // User types new content into editor
      const cmEditor = container.querySelector('.cm-editor') as HTMLElement
      expect(cmEditor).not.toBeNull()
      const view = EditorView.findFromDOM(cmEditor)
      expect(view).not.toBeNull()

      await act(async () => {
        view!.dispatch({
          changes: { from: 0, to: view!.state.doc.length, insert: '# Auto Saved Text' },
        })
      })

      // Dirty indicator is active
      expect(container.querySelector('.dirty-indicator')).not.toBeNull()

      // Before 2000ms, saveToHandle should not have triggered
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(saveToHandleSpy).not.toHaveBeenCalled()

      // Advance past 2000ms to fire debounced auto-save (content debounce of 120ms restarts the timer; act() flushes effects only at its boundary, so allow a full extra window)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(saveToHandleSpy).toHaveBeenCalledTimes(1)
      expect(saveToHandleSpy).toHaveBeenCalledWith(mockHandle, expect.stringContaining('# Auto Saved Text'))
      expect(container.querySelector('.dirty-indicator')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('concurrency guard prevents duplicate saves and manual save clears autoSave timer', async () => {
    vi.useFakeTimers()
    try {
      delete (window as any).location
      window.location = new URL('http://localhost/?file=guide.md') as any
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('# Initial Content'),
      } as any)

      let savedDiskText = '# Initial Content'
      let resolveSaveFileAs: ((val: any) => void) | null = null
      const mockHandle = {
        name: 'guide.md',
        getFile: vi.fn().mockImplementation(async () => ({
          text: async () => savedDiskText,
        })),
      } as any
      const saveFileAsSpy = vi.spyOn(fsSystem, 'saveFileAs').mockImplementation(() => {
        return new Promise((resolve) => {
          resolveSaveFileAs = resolve
        })
      })
      const saveToHandleSpy = vi.spyOn(fsSystem, 'saveToHandle').mockImplementation(async (_h, text) => {
        savedDiskText = text
        return 100
      })

      let renderResult: any
      await act(async () => {
        renderResult = render(<App />)
        for (let i = 0; i < 20; i++) await Promise.resolve()
      })
      const { container } = renderResult

      // Switch to editor mode
      await act(async () => {
        fireEvent.click(screen.getByTitle('Sửa trên trang'))
      })

      // Trigger first save
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      expect(saveFileAsSpy).toHaveBeenCalledTimes(1)

      // Concurrent save attempted while first is in-flight -> ignored by concurrency guard
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      expect(saveFileAsSpy).toHaveBeenCalledTimes(1)

      // Resolve in-flight saveFileAs
      await act(async () => {
        resolveSaveFileAs?.({ handle: mockHandle, file: new File([], 'guide.md') })
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(saveToHandleSpy).toHaveBeenCalledTimes(1)

      // Active handle is now set. Type new content using editor view
      const cmEditor = container.querySelector('.cm-editor') as HTMLElement
      expect(cmEditor).not.toBeNull()
      const view = EditorView.findFromDOM(cmEditor)
      expect(view).not.toBeNull()

      await act(async () => {
        view!.dispatch({
          changes: { from: 0, to: view!.state.doc.length, insert: '# Edit for manual save' },
        })
      })

      // Manual save runs and clears debounced auto-save timer
      await act(async () => {
        fireEvent.keyDown(window, { key: 's', metaKey: true })
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(saveToHandleSpy).toHaveBeenCalledTimes(2)

      // Fast forward past autoSave debounce duration, no extra auto-save call occurs
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
      })
      expect(saveToHandleSpy).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not overwrite edits typed during async conflict check or save, and preserves isDirty if unsaved edits remain', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('# Initial Content'),
    } as any)

    let resolveGetFile: ((file: any) => void) | null = null
    let savedDiskText = '# Initial Content'
    const mockFile = {
      text: vi.fn().mockImplementation(async () => savedDiskText),
    }
    let isGetFileBlocked = false
    const mockHandle = {
      name: 'guide.md',
      getFile: vi.fn().mockImplementation(async () => {
        if (isGetFileBlocked) {
          return new Promise((resolve) => {
            resolveGetFile = resolve
          })
        }
        return mockFile
      }),
    } as any
    vi.spyOn(fsSystem, 'saveFileAs').mockResolvedValue({ handle: mockHandle, file: new File([], 'guide.md') })
    const saveToHandleSpy = vi.spyOn(fsSystem, 'saveToHandle').mockImplementation(async (_h, text) => {
      savedDiskText = text
      return 100
    })

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    // Switch to editor mode
    await act(async () => {
      fireEvent.click(screen.getByTitle('Sửa trên trang'))
    })

    // Save once to establish activeHandle
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      await new Promise((r) => setTimeout(r, 50))
    })
    saveToHandleSpy.mockClear()

    const cmEditor = container.querySelector('.cm-editor') as HTMLElement
    expect(cmEditor).not.toBeNull()
    const view = EditorView.findFromDOM(cmEditor)
    expect(view).not.toBeNull()

    // Now block next getFile call during conflict check
    isGetFileBlocked = true
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    await new Promise((r) => setTimeout(r, 20))

    // While getFile is pending, user types new characters into editor
    await act(async () => {
      view!.dispatch({
        changes: { from: 0, to: view!.state.doc.length, insert: '# Initial Content + User Edit While Saving' },
      })
    })

    // Now resolve getFile
    isGetFileBlocked = false
    await act(async () => {
      resolveGetFile?.(mockFile)
      await new Promise((r) => setTimeout(r, 50))
    })

    // executeSave should save the fresh content without overwriting it with stale snapshot
    expect(saveToHandleSpy).toHaveBeenCalledTimes(1)
    expect(saveToHandleSpy).toHaveBeenCalledWith(
      mockHandle,
      expect.stringContaining('User Edit While Saving')
    )
    expect(view!.state.doc.toString()).toContain('User Edit While Saving')
  })

  it('formatting toolbar action applies markdown format to CodeMirror selection and preserves selection', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('Hello World'),
    } as any)

    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    // Switch to editor mode
    await act(async () => {
      fireEvent.click(screen.getByTitle('Sửa trên trang'))
    })

    // Retrieve EditorView from DOM
    const cmEditor = container.querySelector('.cm-editor') as HTMLElement
    expect(cmEditor).not.toBeNull()
    const view = EditorView.findFromDOM(cmEditor)
    expect(view).not.toBeNull()

    // Select 'World' (indices 6 to 11)
    view!.dispatch({
      selection: { anchor: 6, head: 11 },
    })
    expect(view!.state.selection.main.from).toBe(6)
    expect(view!.state.selection.main.to).toBe(11)

    // Find Bold button in FormattingToolbar and click it
    const boldBtn = screen.getByTitle('Đậm (⌘B)')
    expect(boldBtn).not.toBeNull()
    await act(async () => {
      fireEvent.click(boldBtn)
    })

    // The text should now be 'Hello **World**'
    expect(view!.state.doc.toString()).toBe('Hello **World**')
    // Selection should encompass 'World' inside **...** (indices 8 to 13)
    expect(view!.state.selection.main.from).toBe(8)
    expect(view!.state.selection.main.to).toBe(13)
  })

  it('Chia sẻ mở ShareModal, bật chia sẻ rồi hiện form Tạo link', async () => {
    docOverride.shareDoc = true
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ roomId: 'r1', ownerToken: 'tok' }) })
    vi.stubGlobal('fetch', fetchMock)
    try {
      await act(async () => { render(<App />) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ' })) })
      expect(screen.getByRole('dialog', { name: 'Chia sẻ' })).toBeDefined()
      await act(async () => { fireEvent.click(screen.getByText('Bật chia sẻ')) })
      expect(await screen.findByRole('button', { name: 'Tạo link' })).toBeDefined()
      const last = useSessionCalls[useSessionCalls.length - 1]
      expect(last.room.roomId).toBe('r1')
      expect(last.room.ownerToken).toBe('tok')
    } finally {
      docOverride.shareDoc = false
      vi.unstubAllGlobals()
    }
  })

  describe('collab settings', () => {
    const enableShare = async (stored: any) => {
      docOverride.shareDoc = true
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ roomId: 'r1', ownerToken: 'tok' }) })
      vi.stubGlobal('fetch', fetchMock)
      ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue({ settingsVersion: 2, ...stored })
      await act(async () => { render(<App />) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ' })) })
      await act(async () => { fireEvent.click(screen.getByText('Bật chia sẻ')) })
      return fetchMock
    }
    afterEach(() => { docOverride.shareDoc = false; docOverride.syncStatus = null; docOverride.awareness = null; vi.unstubAllGlobals() })
    it('dùng serverUrl từ Cài đặt', async () => {
      const f = await enableShare({ serverUrl: 'https://own.example' })
      expect(f.mock.calls[0]![0]).toBe('https://own.example/api/rooms')
    })
    it('serverUrl không hợp lệ rơi về mặc định', async () => {
      const f = await enableShare({ serverUrl: 'http://bad.example' })
      expect(f.mock.calls[0]![0]).toBe(DEFAULT_SERVER_URL + '/api/rooms')
    })
    it('displayName được cắt khoảng trắng', async () => {
      ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue({ settingsVersion: 2, displayName: '  Lan ' })
      await act(async () => { render(<App />) })
      expect(useSessionCalls[useSessionCalls.length - 1].displayName).toBe('Lan')
    })
    it('toolbar hiện trạng thái đồng bộ', async () => {
      docOverride.syncStatus = 'online'
      await act(async () => { render(<App />) })
      expect(screen.getByRole('status').textContent).toContain('Đã đồng bộ')
    })
    it('hiện presence khi đã bind và awareness đổi; không bind thì không có', async () => {
      const handlers = new Set<() => void>()
      const states = new Map<number, any>([[1, { user: { name: 'Hao', color: 'var(--peer-1)', colorLight: 'x' } }]])
      docOverride.awareness = {
        clientID: 1, getStates: () => states,
        on: (_e: string, h: () => void) => { handlers.add(h) }, off: (_e: string, h: () => void) => { handlers.delete(h) },
      }
      docOverride.syncStatus = 'online'
      await act(async () => { render(<App />) })
      await act(async () => {
        states.set(2, { user: { name: 'Lan', color: 'var(--peer-2)', colorLight: 'y' } })
        handlers.forEach((h) => h())
      })
      expect(document.querySelectorAll('.presence-avatar').length).toBe(2)
    })
    it('không bind thì không có presence-bar', async () => {
      await act(async () => { render(<App />) })
      expect(document.querySelector('.presence-bar')).toBeNull()
    })
  })
  describe('Người viết (8f2.2)', () => {
    const loadDoc = async () => {
      delete (window as any).location
      window.location = new URL('http://localhost/?file=guide.md') as any
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('# Title\n\nContent') } as any)
      await act(async () => { render(<App />) })
    }
    const findAction = (name: string) => screen.queryByTitle(name) ?? screen.queryByLabelText(name) ?? screen.queryByText(name)
    it('reading mode không có nút Người viết', async () => {
      await loadDoc()
      expect(findAction('Hiện người viết')).toBeNull()
    })
    it('editor mode có nút, bật hiện .cm-blame-mark, tắt thì mất', async () => {
      await loadDoc()
      await act(async () => { fireEvent.click(screen.getByTitle('Sửa trên trang')) })
      let btn = findAction('Hiện người viết')
      if (!btn) { const more = screen.queryByLabelText('Thêm') ?? screen.queryByTitle('Thêm'); if (more) { await act(async () => { fireEvent.click(more) }); btn = findAction('Hiện người viết') } }
      expect(btn).not.toBeNull()
      await act(async () => { fireEvent.click(btn!) })
      expect(document.querySelectorAll('.cm-blame-mark').length).toBeGreaterThan(0)
      let off = findAction('Ẩn người viết')
      if (!off) { const more = screen.queryByLabelText('Thêm') ?? screen.queryByTitle('Thêm'); if (more) { await act(async () => { fireEvent.click(more) }); off = findAction('Ẩn người viết') } }
      expect(off).not.toBeNull()
      await act(async () => { fireEvent.click(off!) })
      expect(document.querySelectorAll('.cm-blame-mark').length).toBe(0)
    })
  })
  describe('Lịch sử (8g2.2)', () => {
    const loadDoc = async () => {
      delete (window as any).location
      window.location = new URL('http://localhost/?file=guide.md') as any
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('# Cũ\n\nBản đầu') } as any)
      await act(async () => { render(<App />) })
      await waitFor(() => expect(lastSession.s.checkpoints).toBeTruthy())
    }
    const seed = async () => {
      const s = lastSession.s
      await act(async () => {
        s.checkpoints.flush('save', 'Bạn', { force: true })
        core.applyTextChange(s.doc.getText('source'), '# Mới\n\nBản sau')
        s.checkpoints.flush('save', 'Bạn', { force: true })
      })
      await waitFor(() => expect(document.body.textContent).toContain('Bản sau'))
    }
    const openPanel = async () => {
      await act(async () => { fireEvent.click(screen.getByTitle('Lịch sử')) })
    }
    it('bấm Lịch sử mở panel với các mốc', async () => {
      await loadDoc(); await seed(); await openPanel()
      expect(screen.getByRole('complementary', { name: 'Lịch sử' })).toBeTruthy()
      expect(screen.getAllByRole('option').length).toBeGreaterThanOrEqual(2)
    })
    it('Xem mốc cũ hiện banner và Viewer render bản cũ; Thoát xem trở lại', async () => {
      await loadDoc(); await seed(); await openPanel()
      const rows = screen.getAllByRole('option')
      const row = rows[rows.length - 1]!
      await act(async () => { fireEvent.click(within(row).getByText('Xem')) })
      expect(screen.getByText(/Đây là bản chỉ đọc/)).toBeTruthy()
      expect(document.body.textContent).toContain('Bản đầu')
      expect(document.body.textContent).not.toContain('Bản sau')
      await act(async () => { fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Thoát xem' })) })
      expect(screen.queryByText(/Đây là bản chỉ đọc/)).toBeNull()
      expect(document.body.textContent).toContain('Bản sau')
    })
    it('(a) Xem/Thoát xem không đổi doc, history, dirty', async () => {
      await loadDoc(); await seed(); await openPanel()
      const d = lastSession.s.doc
      const src = d.getText('source').toString()
      const len = core.listHistory(d).length
      const dirtyBefore = document.querySelector('.dirty-indicator') !== null
      const rows = screen.getAllByRole('option')
      await act(async () => { fireEvent.click(within(rows[rows.length - 1]!).getByText('Xem')) })
      expect(document.querySelector('.dirty-indicator') !== null).toBe(dirtyBefore)
      await act(async () => { fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Thoát xem' })) })
      expect(d.getText('source').toString()).toBe(src)
      expect(core.listHistory(d).length).toBe(len)
      expect(document.querySelector('.dirty-indicator') !== null).toBe(dirtyBefore)
    })
    it('(b) chế độ editor: Xem hiện banner + bản cũ, Thoát xem trả editor', async () => {
      await loadDoc(); await seed()
      await act(async () => { fireEvent.click(screen.getByTitle('Sửa trên trang')) })
      await waitFor(() => expect(document.querySelector('.editor-mode-container')).not.toBeNull())
      await openPanel()
      const rows = screen.getAllByRole('option')
      await act(async () => { fireEvent.click(within(rows[rows.length - 1]!).getByText('Xem')) })
      expect(screen.getByText(/Đây là bản chỉ đọc/)).toBeTruthy()
      expect(document.body.textContent).toContain('Bản đầu')
      await act(async () => { fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Thoát xem' })) })
      expect(screen.queryByText(/Đây là bản chỉ đọc/)).toBeNull()
      await waitFor(() => expect(document.querySelector('.editor-mode-container')).not.toBeNull())
    })
    it('(d) editor: bản cũ nằm trong history-preview-scroll cùng banner; toolbar ẩn khi xem', async () => {
      await loadDoc(); await seed()
      await act(async () => { fireEvent.click(screen.getByTitle('Sửa trên trang')) })
      await waitFor(() => expect(document.querySelector('.editor-mode-container')).not.toBeNull())
      expect(screen.queryByRole('toolbar', { name: 'Định dạng' })).not.toBeNull()
      await openPanel()
      const rows = screen.getAllByRole('option')
      await act(async () => { fireEvent.click(within(rows[rows.length - 1]!).getByText('Xem')) })
      const wrap = document.querySelector('.history-preview-scroll') as HTMLElement
      expect(wrap).not.toBeNull()
      expect(wrap.textContent).toContain('Bản đầu')
      expect(wrap.querySelector('.history-preview-banner')).not.toBeNull()
      expect(screen.queryByRole('toolbar', { name: 'Định dạng' })).toBeNull()
      await act(async () => { fireEvent.click(within(wrap as HTMLElement).getByRole('button', { name: 'Thoát xem' })) })
      await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Định dạng' })).not.toBeNull())
    })
    it('(c) tên actor độc hại chỉ là text', async () => {
      await loadDoc(); await seed()
      const d = lastSession.s.doc
      const hostile = '<img src=x onerror=alert(1)>'
      await act(async () => { d.getMap('meta').set('actors', { [String(d.clientID)]: hostile }) })
      await openPanel()
      const panel = document.querySelector('.history-panel')!
      expect(panel.querySelector('img')).toBeNull()
      expect(panel.textContent).toContain(hostile)
    })
    it('Khôi phục có xác nhận đổi text, lịch sử tăng đúng 1, không trùng auto', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      await loadDoc(); await seed(); await openPanel()
      const before = core.listHistory(lastSession.s.doc).length
      const rows = screen.getAllByRole('option')
      const row = rows[rows.length - 1]!
      await act(async () => { fireEvent.click(within(row).getByText('Khôi phục')) })
      await act(async () => { fireEvent.click(within(row).getAllByText('Khôi phục')[0]!) })
      expect(lastSession.s.doc.getText('source').toString()).toContain('Bản đầu')
      await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
      expect(core.listHistory(lastSession.s.doc).length).toBe(before + 1)
    })
  })
})
