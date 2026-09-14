import React from 'react'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { App } from './App'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as core from '@md-reader/core'
import * as ui from '@md-reader/ui'
import type { ReaderSettings } from '@md-reader/ui'
import { WordCountBar, CelebrationConfetti, SettingsModal } from '@md-reader/ui'

// Mock dependencies
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
  })

  beforeEach(() => {
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
          get: vi.fn().mockResolvedValue({ theme: 'dark', colorTheme: 'green' }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as any

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  it('renders ExportModal and triggers export logic for pdf, slide-pdf, html, and docx', async () => {
    vi.useFakeTimers()
    const printSpy = vi.spyOn(ui, 'printDocument').mockImplementation(() => {})
    const printSlidesSpy = vi.spyOn(ui, 'printSlides').mockImplementation(() => { expect(document.querySelector('.deck-print-container')).not.toBeNull() })
    const htmlSpy = vi.spyOn(core, 'exportToHtml').mockResolvedValue('<html><body>Exported</body></html>')
    const docxSpy = vi.spyOn(core, 'mdastToDocx').mockResolvedValue(new Blob(['docx-content']))
    let lastDownloaded = ''
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      lastDownloaded = this.download
    })

    await act(async () => {
      render(<App />)
    })

    const exportBtn = screen.getByTitle('Xuất tài liệu')
    expect(exportBtn).toBeDefined()

    // 1. Trigger PDF export
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    const pdfOption = screen.getByText('Tài liệu PDF (.pdf)')
    await act(async () => {
      fireEvent.click(pdfOption)
    })
    expect(printSpy).toHaveBeenCalled()

    // 2. Trigger HTML export
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    const htmlOption = screen.getByText('HTML Độc lập (.html)')
    await act(async () => {
      fireEvent.click(htmlOption)
    })
    expect(htmlSpy).toHaveBeenCalledWith(expect.objectContaining({
      cssContent: expect.stringContaining('740px'),
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
    const docxOption = screen.getByText('Microsoft Word (.docx)')
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

    // 4. Trigger Slide PDF export
    // Container should NOT be in DOM normally to save memory
    expect(document.querySelector('.deck-print-container')).toBeNull()
    
    await act(async () => {
      fireEvent.click(exportBtn)
    })
    const slidePdfOption = screen.getByText('Slide PDF (Khổ ngang)')
    await act(async () => {
      fireEvent.click(slidePdfOption)
    })
    
    expect(printSlidesSpy).toHaveBeenCalled()
    // It should be rendered now
    expect(document.querySelector('.deck-print-container')).not.toBeNull()
    
    // Wait for the timeout to remove it
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(document.querySelector('.deck-print-container')).toBeNull()

    vi.useRealTimers()
  })

  it('renders placeholder with loaded theme and yjs doc', async () => {
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
    expect(placeholder.textContent).toContain('MD Reader')
    
    // Check if IndexeddbPersistence is called
    expect(IndexeddbPersistence).toHaveBeenCalled()
    expect((window as any).chrome.storage.sync.get).toHaveBeenCalledWith(null)
  })
  
  it('loads colorTheme and renders ThemePicker', async () => {
    await act(async () => {
      render(<App />)
    })
    // open settings modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    })
    
    const navyBtn = screen.getByRole('button', { name: 'Select navy theme' })
    expect(navyBtn).toBeDefined()
    
    // the green one should be selected
    const greenBtn = screen.getByRole('button', { name: 'Select green theme' })
    expect(greenBtn.style.border).toContain('2px solid rgb(59, 130, 246)')
    
    // changing color theme
    await act(async () => {
      fireEvent.click(navyBtn)
    })
    
    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({ colorTheme: 'navy' }))
  })

  it('falls back to system theme and black colorTheme when storage throws', async () => {
    (window as any).chrome.storage.sync.get = vi.fn().mockRejectedValue(new Error('no permission'))
    
    await act(async () => {
      render(<App />)
    })

    const placeholder = screen.getByTestId('app-placeholder')
    expect(placeholder).not.toBeNull()
    // open settings modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    })
    
    expect(document.querySelector('[data-color-theme="black"]')).not.toBeNull()
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
    const readingModeBtn = screen.getByTitle('Chế độ tập trung')
    expect(readingModeBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(readingModeBtn)
    })

    // Container should now have reading-mode class
    expect(container.querySelector('.reading-mode')).not.toBeNull()

    // Floating exit reading mode button should appear
    const exitBtn = screen.getByText('Thoát đọc tập trung ✕')
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
    expect(screen.queryByText('Thoát đọc tập trung ✕')).toBeNull()
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
    expect(screen.queryByPlaceholderText('Tìm trong tài liệu...')).toBeNull()

    // Click search button on TopToolbar
    const searchBtn = screen.getByTitle(/tìm kiếm/i)
    await act(async () => {
      fireEvent.click(searchBtn)
    })

    // DocumentSearch input should be rendered
    expect(screen.getByPlaceholderText('Tìm trong tài liệu...')).toBeDefined()

    // Press Escape to close
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByPlaceholderText('Tìm trong tài liệu...')).toBeNull()

    // Re-open via Cmd+F shortcut
    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', metaKey: true })
    })
    expect(screen.getByPlaceholderText('Tìm trong tài liệu...')).toBeDefined()

    // Click close button to close
    const closeBtn = screen.getByTitle(/đóng/i)
    await act(async () => {
      fireEvent.click(closeBtn)
    })
    expect(screen.queryByPlaceholderText('Tìm trong tài liệu...')).toBeNull()
  })

  it('loads fontFamily, shows options in SettingsModal, and selecting font family updates storage and data-font-family', async () => {
    let renderResult: any
    await act(async () => {
      renderResult = render(<App />)
    })
    const { container } = renderResult

    // Initial data-font-family attribute should be 'sans'
    expect(container.querySelector('[data-font-family="sans"]')).not.toBeNull()

    // Open settings modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    })

    // Font family options should be shown (e.g., serif button or option)
    const serifOption = screen.getByRole('button', { name: 'Serif' })
    expect(serifOption).toBeDefined()

    // Select serif font family
    await act(async () => {
      fireEvent.click(serifOption)
    })

    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({ fontFamily: 'serif' }))
    expect(container.querySelector('[data-font-family="serif"]')).not.toBeNull()
  })

  it('loads fontFamily from chrome.storage if already stored', async () => {
    ;(window as any).chrome.storage.sync.get = vi.fn().mockResolvedValue({
      theme: 'dark',
      colorTheme: 'green',
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

    const deckSpy = vi.spyOn(ui, 'Deck').mockImplementation(() => <div data-testid="mock-deck">Deck</div>)

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
        colorTheme: 'green',
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

    const deckSpy = vi.spyOn(ui, 'Deck').mockImplementation(() => <div data-testid="mock-deck">Deck</div>)

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
    const deckSpy = vi.spyOn(ui, 'Deck').mockImplementation((props: any) => {
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
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('speaker=true'),
      'md-speaker',
      'width=1080,height=680'
    )

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
    vi.spyOn(ui, 'Deck').mockImplementation((props: any) => {
      capturedDeckProps = props
      return <div data-testid="mock-deck" />
    })

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
        alwaysOpenApp: true,
      })
    )

    // Simulate changing alwaysOpenApp
    await act(async () => {
      capturedSettingsModalProps.onSettingChange('alwaysOpenApp', false)
    })

    expect((window as any).chrome.storage.sync.set).toHaveBeenCalledWith({
      alwaysOpenApp: false,
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
    const mindmapBtn = screen.getByRole('button', { name: /mindmap/i })
    await act(async () => {
      fireEvent.click(mindmapBtn)
    })

    const modal = screen.getByRole('dialog')
    expect(modal).toBeDefined()
    expect(modal.querySelector('.mindmap-svg')).not.toBeNull()

    // 2. Click node to navigate
    const introHeading = document.getElementById('introduction') || document.createElement('h1')
    introHeading.id = 'introduction'
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
})
