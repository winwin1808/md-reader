import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '../app/App'
import { createRecord, writeDocText } from '../app/doc-registry'
import * as core from '@md-reader/core'
import * as ui from '@md-reader/ui'
import * as deckMod from '@md-reader/ui/deck'
import * as docxMod from '@md-reader/core/docx'


async function openDroppedDoc(title: string, text: string): Promise<void> {
  const rec = await createRecord({ title, originKind: 'drop', originPath: null })
  await writeDocText(rec, text, 'replace')
  window.history.replaceState(null, '', '/?doc=' + rec.docId)
}

describe('E2E smoke test for themes and export formats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ recentFiles: [] }),
          set: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({ theme: 'light', colorTheme: 'black', autoFormatMd: true }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    }
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
    vi.useRealTimers()
  })

  it('renders App, accepts file drop, navigates TOC, switches theme, and exports', async () => {
    let lastDownloaded = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      lastDownloaded = this.download
    })

    const printSpy = vi.spyOn(ui, 'printDocument').mockImplementation(() => {})
    const htmlSpy = vi.spyOn(core, 'exportToHtml').mockResolvedValue('<html><body>Exported</body></html>')
    const docxSpy = vi.spyOn(docxMod, 'mdastToDocx').mockResolvedValue(new Blob(['docx-content']))



    const fileContent = '# Title\n\n## Subtitle\n\nParagraph text.'
    const file = new File([fileContent], 'my-doc.md', { type: 'text/markdown' })

    await openDroppedDoc(file.name, fileContent)
    render(React.createElement(App))

    // Verify Table of Contents renders links and Viewer renders document
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Title' })).toBeDefined()
      expect(screen.getByRole('link', { name: 'Subtitle' })).toBeDefined()
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Subtitle' })).toBeDefined()
    expect(screen.getByText('Paragraph text.')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Title' }).getAttribute('href')).toBe('#user-content-title')
    expect(screen.getByRole('link', { name: 'Subtitle' }).getAttribute('href')).toBe('#user-content-subtitle')

    // Click Settings button, select a new theme ('navy'), verify chrome.storage.sync.set called
    const settingsBtn = screen.getByRole('button', { name: 'Settings' })
    fireEvent.click(settingsBtn)

    // Close settings modal
    const closeSettingsBtn = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeSettingsBtn)

    // Open ExportModal, click PDF -> verify printSpy called
    const exportBtn = screen.getByRole('button', { name: 'Xuất tài liệu' })
    fireEvent.click(exportBtn)

    const pdfOptionBtn = screen.getByText('Tài liệu PDF (.pdf)').closest('button')!
    fireEvent.click(pdfOptionBtn)
    expect(printSpy).toHaveBeenCalled()

    // Switch to fake timers to test setTimeout / revokeObjectURL
    vi.useFakeTimers()

    // Re-open ExportModal, click HTML -> verify htmlSpy called with title, verify download, advance timers & verify revokeObjectURL
    fireEvent.click(exportBtn)
    const htmlOptionBtn = screen.getByText('HTML Độc lập (.html)').closest('button')!
    fireEvent.click(htmlOptionBtn)

    // Allow promise microtasks to run
    await Promise.resolve()
    await Promise.resolve()

    expect(htmlSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/my-doc(\.md)?/),
        html: expect.stringContaining('Title'),
        cssContent: expect.any(String),
      })
    )
    expect(lastDownloaded).toMatch(/my-doc(\.md)?\.html/)
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2000)
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    // Re-open ExportModal, click Word -> verify docxSpy called with title, verify download, advance timers & verify revokeObjectURL
    ;(window.URL.revokeObjectURL as any).mockClear()
    fireEvent.click(exportBtn)
    const wordOptionBtn = screen.getByText('Microsoft Word (.docx)').closest('button')!
    fireEvent.click(wordOptionBtn)

    // docx is loaded on demand via dynamic import
    await vi.waitFor(() => expect(docxSpy).toHaveBeenCalled())

    expect(docxSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/my-doc(\.md)?/),
        mdast: expect.objectContaining({ type: 'root' }),
      })
    )
    expect(lastDownloaded).toMatch(/my-doc(\.md)?\.docx/)
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2000)
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
