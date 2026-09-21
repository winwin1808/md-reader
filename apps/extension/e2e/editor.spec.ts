import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor, fireEvent, act, cleanup } from '@testing-library/react'
import { EditorView } from '@md-reader/ui'
import * as fsSystem from '../src/app/fs/file-system'

if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () => [{
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => {}
  }] as any
}
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => {}
  } as any)
}

vi.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: class {
      once(event: string, cb: () => void) {
        if (event === 'synced') cb()
      }
      on() {}
      destroy() {}
    }
  }
})

globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined)
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    }
  },
  runtime: {
    getURL: vi.fn((path: string) => path),
    sendMessage: vi.fn()
  }
} as any

globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: async () => '# Phase 5 Architecture\n\nInitial content with sample word here.'
})

import { App } from '../src/app/App'

describe('Phase 5 E2E Integration Smoke Test: Editor, Split View, Formatting, and Conflict Resolution', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    delete (window as any).location
    window.location = new URL('http://localhost/') as any
  })

  it('exercises full user journey: view mode switching, toolbar formatting, synchronized typing, Cmd+S save, and conflict resolution modal', async () => {
    delete (window as any).location
    window.location = new URL('http://localhost/?file=guide.md') as any

    let savedDiskText = '# Phase 5 Architecture\n\nInitial content with sample word here.'
    let isConflictSimulated = false

    const mockHandle = {
      name: 'guide.md',
      getFile: vi.fn().mockImplementation(async () => ({
        text: async () => (isConflictSimulated ? '# External Conflicting Changes on Disk' : savedDiskText)
      }))
    } as any

    const saveFileAsSpy = vi.spyOn(fsSystem, 'saveFileAs').mockResolvedValue({
      handle: mockHandle,
      file: new File([], 'guide.md')
    })
    const saveToHandleSpy = vi.spyOn(fsSystem, 'saveToHandle').mockImplementation(async (_h, text) => {
      savedDiskText = text
      return 100
    })

    const { container } = render(React.createElement(App))

    // 1. Initial State: App renders in Reading mode
    await waitFor(() => {
      expect(container.querySelector('.a4-document-container')).toBeTruthy()
    })
    expect(container.querySelector('.cm-editor')).toBeNull()
    expect(container.textContent).toContain('Phase 5 Architecture')

    // 2. Switch to Editor mode
    const editorModeBtn = screenByTitle(container, 'Chế độ Soạn thảo')
    expect(editorModeBtn).toBeTruthy()
    fireEvent.click(editorModeBtn!)

    await waitFor(() => {
      expect(container.querySelector('.cm-editor')).toBeTruthy()
    })
    expect(container.querySelector('.a4-document-container')).toBeNull()

    // 3. Switch to Split View mode
    const splitModeBtn = screenByTitle(container, 'Chế độ Chia đôi')
    expect(splitModeBtn).toBeTruthy()
    fireEvent.click(splitModeBtn!)

    await waitFor(() => {
      expect(container.querySelector('.split-view-container')).toBeTruthy()
      expect(container.querySelector('.cm-editor')).toBeTruthy()
      expect(container.querySelector('.a4-document-container')).toBeTruthy()
    })

    // 4. Formatting Toolbar interaction: Select text and click Bold
    const editorEl = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editorEl)!
    expect(view).toBeTruthy()

    const docStr = view.state.doc.toString()
    const idx = docStr.indexOf('sample')
    expect(idx).toBeGreaterThan(-1)

    view.dispatch({
      selection: { anchor: idx, head: idx + 'sample'.length }
    })

    const boldBtn = screenByTitle(container, 'Bold')
    expect(boldBtn).toBeTruthy()
    fireEvent.click(boldBtn!)

    expect(view.state.doc.toString()).toContain('**sample**')

    // Verify CodeMirror selection preservation inside **...**
    expect(view.state.selection.main.from).toBe(idx + 2)
    expect(view.state.selection.main.to).toBe(idx + 2 + 'sample'.length)

    await waitFor(() => {
      const strong = container.querySelector('.a4-document-container strong')
      expect(strong?.textContent).toBe('sample')
    })

    // 5. Live synchronized editing: Dispatch new H2 heading and paragraph
    view.dispatch({
      changes: {
        from: view.state.doc.length,
        to: view.state.doc.length,
        insert: '\n\n## Realtime Section\nLive updated preview content.'
      }
    })

    await waitFor(() => {
      const h2 = container.querySelector('.a4-document-container h2')
      expect(h2?.textContent).toBe('Realtime Section')
      expect(container.querySelector('.dirty-indicator')).toBeTruthy()
    })

    // 6. Save via Cmd+S keyboard shortcut
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveFileAsSpy).toHaveBeenCalled()
    expect(saveToHandleSpy).toHaveBeenCalledTimes(1)
    expect(saveToHandleSpy).toHaveBeenCalledWith(mockHandle, expect.stringContaining('Realtime Section'))
    expect(container.querySelector('.dirty-indicator')).toBeNull()

    // 7. Conflict detection and resolution
    // User types another edit so document becomes dirty
    view.dispatch({
      changes: {
        from: view.state.doc.length,
        to: view.state.doc.length,
        insert: '\n\nMore local edits.'
      }
    })

    await waitFor(() => {
      expect(container.querySelector('.dirty-indicator')).toBeTruthy()
    })

    // Simulate external disk change with different hash
    isConflictSimulated = true

    // Trigger save via Cmd+S
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // ConflictModal should open
    let conflictModal: HTMLElement | null = null
    await waitFor(() => {
      conflictModal = document.querySelector('[role="dialog"]')
      expect(conflictModal).toBeTruthy()
      expect(conflictModal?.textContent).toMatch(/xung đột/i)
    })

    // Click "Giữ bản sửa của tôi" to resolve conflict by force overwrite (using .conflict-btn-keep)
    const keepLocalBtn = conflictModal!.querySelector('button.conflict-btn-keep') as HTMLButtonElement
    expect(keepLocalBtn).toBeTruthy()

    await act(async () => {
      fireEvent.click(keepLocalBtn)
      for (let i = 0; i < 20; i++) await Promise.resolve()
    })

    // Modal closes, file is saved with latest local edits, and dirty indicator cleared
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(saveToHandleSpy).toHaveBeenCalledTimes(2)
    await waitFor(() => {
      expect(container.querySelector('.dirty-indicator')).toBeNull()
    })

    // 8. Switch back to Reading mode
    const readingModeBtn = screenByTitle(container, 'Chế độ Đọc')
    expect(readingModeBtn).toBeTruthy()
    fireEvent.click(readingModeBtn!)

    await waitFor(() => {
      expect(container.querySelector('.a4-document-container')).toBeTruthy()
      expect(container.querySelector('.cm-editor')).toBeNull()
    })
    expect(container.textContent).toContain('Realtime Section')
  })
})

function screenByTitle(container: HTMLElement, title: string): HTMLElement | null {
  return (
    container.querySelector(`button[title="${title}"]`) ||
    document.querySelector(`button[title="${title}"]`) ||
    container.querySelector(`[aria-label="${title}"]`) ||
    document.querySelector(`[aria-label="${title}"]`)
  )
}
