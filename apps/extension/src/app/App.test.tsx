import React from 'react'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { App } from './App'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as core from '@md-reader/core'
import * as ui from '@md-reader/ui'

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

describe('App', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks();
    
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

  it('renders ExportModal and triggers export logic for pdf, html, and docx', async () => {
    vi.useFakeTimers()
    const printSpy = vi.spyOn(ui, 'printDocument').mockImplementation(() => {})
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
    expect((window as any).chrome.storage.sync.get).toHaveBeenCalledWith(['theme', 'colorTheme', 'autoFormatMd', 'fontScale'])
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
    
    // The black button should be selected since fallback is black
    const blackBtn = screen.getByRole('button', { name: 'Select black theme' })
    expect(blackBtn.style.border).toContain('2px solid rgb(59, 130, 246)')
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
})
