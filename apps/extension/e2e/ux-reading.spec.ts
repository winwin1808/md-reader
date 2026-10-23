import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '../src/app/App'
import { createRecord, writeDocText } from '../src/app/doc-registry'


async function openDroppedDoc(title: string, text: string): Promise<void> {
  const rec = await createRecord({ title, originKind: 'drop', originPath: null })
  await writeDocText(rec, text, 'replace')
  window.history.replaceState(null, '', '/?doc=' + rec.docId)
}

describe('E2E integration test for A4 layout, toolbar, search, code copy, ToC, and font family', () => {
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
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('verifies A4 layout, toolbar, reading mode, search, code copy, ToC collapse, and font family', async () => {

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull()
    })

    const fileContent = `# Main Guide

## Section One

### Subsection Alpha

\`\`\`js
const greeting = "Hello World";
\`\`\`

| Column A | Column B |
|---|---|
| Data 1 | Data 2 |

- [x] Completed task
- [ ] Pending task`

    const file = new File([fileContent], 'ux-doc.md', { type: 'text/markdown' })
    file.text = async () => fileContent

    await openDroppedDoc(file.name, fileContent)
    render(React.createElement(App))

    // 1. Wait for document to render.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Main Guide' })).toBeDefined()
    })

    // 2. Check .a4-document-container is in the DOM, and ReadingProgress (role="progressbar") is rendered.
    const a4Container = document.querySelector('.a4-document-container')
    expect(a4Container).not.toBeNull()

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeDefined()

    // 3. TopToolbar:
    // Find button "Tăng cỡ chữ" (or button with title/aria-label "Tăng cỡ chữ"), click it. Verify container element has attribute data-font-scale="lg".
    const zoomInBtn = screen.getByRole('button', { name: /tăng cỡ chữ/i })
    fireEvent.click(zoomInBtn)
    expect(document.querySelector('[data-font-scale="lg"]')).not.toBeNull()

    // Find button "Giảm cỡ chữ", click it twice. Verify attribute data-font-scale="sm".
    const zoomOutBtn = screen.getByRole('button', { name: /giảm cỡ chữ/i })
    fireEvent.click(zoomOutBtn)
    fireEvent.click(zoomOutBtn)
    expect(document.querySelector('[data-font-scale="sm"]')).not.toBeNull()

    // 4. Reading Mode:
    // Click button with title "Chế độ tập trung". Verify container has class reading-mode and button "Thoát đọc tập trung ✕" appears.
    const readingModeBtn = screen.getByRole('button', { name: /chế độ tập trung/i })
    fireEvent.click(readingModeBtn)
    expect(document.querySelector('.reading-mode')).not.toBeNull()
    const exitReadingBtn = screen.getByRole('button', { name: /thoát đọc tập trung ✕/i })
    expect(exitReadingBtn).toBeDefined()

    // Click "Thoát đọc tập trung ✕". Verify reading-mode class is removed.
    fireEvent.click(exitReadingBtn)
    expect(document.querySelector('.reading-mode')).toBeNull()

    // 5. In-document Search:
    // Click search button with title="Tìm kiếm (Cmd+F)" or fireEvent keydown metaKey: true, key: 'f'.
    const searchBtn = screen.getByRole('button', { name: /tìm kiếm/i })
    fireEvent.click(searchBtn)

    // Verify input with placeholder="Tìm trong tài liệu..." appears.
    const searchInput = screen.getByPlaceholderText('Tìm trong tài liệu...')
    expect(searchInput).toBeDefined()

    // Fire change on input to "Hello", verify mark.md-search-highlight is in DOM and match counter shows "1 / 1".
    fireEvent.change(searchInput, { target: { value: 'Hello' } })
    await waitFor(() => {
      expect(document.querySelector('mark.md-search-highlight')).not.toBeNull()
      expect(screen.getByText('1 / 1')).toBeDefined()
    })

    // Click close button (title="Đóng (Esc)") or press Escape. Verify marks are removed and search input disappears.
    const closeSearchBtn = screen.getByRole('button', { name: /đóng/i })
    fireEvent.click(closeSearchBtn)
    expect(document.querySelector('mark.md-search-highlight')).toBeNull()
    expect(screen.queryByPlaceholderText('Tìm trong tài liệu...')).toBeNull()

    // 6. Code Copy:
    // Find copy button with class .code-copy-btn or text "Copy".
    const copyBtn = document.querySelector('.code-copy-btn') as HTMLButtonElement
    expect(copyBtn).not.toBeNull()

    // Click it, await microtasks / waitFor, verify navigator.clipboard.writeText was called with 'const greeting = "Hello World";', and button text is "Copied ✓".
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('const greeting = "Hello World";')
      )
      expect(copyBtn.textContent).toContain('Copied ✓')
    })

    // 7. ToC Collapse:
    // Find .toc-collapse-btn in ToC for "Section One".
    const collapseBtn = document.querySelector('.toc-collapse-btn') as HTMLButtonElement
    expect(collapseBtn).not.toBeNull()

    // Click it, verify "Subsection Alpha" link is collapsed/hidden.
    fireEvent.click(collapseBtn)
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Subsection Alpha' })).toBeNull()
    })

    // Click it again, verify it expands back.
    fireEvent.click(collapseBtn)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Subsection Alpha' })).toBeDefined()
    })

    // 8. SettingsModal Font Family:
    // Open Settings button (title="Settings" / "Cài đặt").
    const settingsBtn = screen.getByRole('button', { name: /settings|cài đặt/i })
    fireEvent.click(settingsBtn)

    // Click font option "Serif". Verify data-font-family="serif" is set on container.
    const serifOption = screen.getByRole('button', { name: 'Serif' })
    fireEvent.click(serifOption)
    expect(document.querySelector('[data-font-family="serif"]')).not.toBeNull()
  })
})
