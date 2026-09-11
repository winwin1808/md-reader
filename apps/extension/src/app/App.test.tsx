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
    IndexeddbPersistence: vi.fn().mockImplementation(() => {
      return {
        destroy: vi.fn(),
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
      cssContent: '',
      title: 'document',
    }))
    expect(clickSpy).toHaveBeenCalled()
    expect(lastDownloaded).toBe('document.html')
    expect(window.URL.createObjectURL).toHaveBeenCalled()
    expect(window.URL.revokeObjectURL).toHaveBeenCalled()

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
    expect((window as any).chrome.storage.sync.get).toHaveBeenCalledWith(['theme', 'colorTheme', 'autoFormatMd'])
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
})
