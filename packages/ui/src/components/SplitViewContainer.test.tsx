import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SplitViewContainer } from './SplitViewContainer'
import { TopToolbar } from './TopToolbar'

describe('SplitViewContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders preview only when mode is reading', () => {
    render(
      <SplitViewContainer
        mode="reading"
        editor={<div data-testid="editor-content">Editor Area</div>}
        preview={<div data-testid="preview-content">Preview Area</div>}
      />
    )

    expect(screen.getByTestId('preview-content')).toBeTruthy()
    expect(screen.queryByTestId('editor-content')).toBeNull()
    expect(screen.getByTestId('split-view-container').classList.contains('mode-reading')).toBe(true)
  })

  it('renders editor only when mode is editor', () => {
    render(
      <SplitViewContainer
        mode="editor"
        editor={<div data-testid="editor-content">Editor Area</div>}
        preview={<div data-testid="preview-content">Preview Area</div>}
      />
    )

    expect(screen.getByTestId('editor-content')).toBeTruthy()
    expect(screen.queryByTestId('preview-content')).toBeNull()
    expect(screen.getByTestId('split-view-container').classList.contains('mode-editor')).toBe(true)
  })

  it('renders both editor and preview panes when mode is split', () => {
    render(
      <SplitViewContainer
        mode="split"
        editor={<div data-testid="editor-content">Editor Area</div>}
        preview={<div data-testid="preview-content">Preview Area</div>}
      />
    )

    expect(screen.getByTestId('editor-content')).toBeTruthy()
    expect(screen.getByTestId('preview-content')).toBeTruthy()
    expect(screen.getByTestId('split-view-container').classList.contains('mode-split')).toBe(true)
    expect(screen.getByTestId('split-view-editor-pane')).toBeTruthy()
    expect(screen.getByTestId('split-view-preview-pane')).toBeTruthy()
  })

  it('syncs scroll from editor to preview when editor is scrolled', () => {
    const onSyncScroll = vi.fn()
    let rafCallback: FrameRequestCallback | null = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })

    render(
      <SplitViewContainer
        mode="split"
        editor={<div style={{ height: 2000 }}>Editor Content</div>}
        preview={<div style={{ height: 3000 }}>Preview Content</div>}
        onSyncScroll={onSyncScroll}
      />
    )

    const editorPane = screen.getByTestId('split-view-editor-pane')
    const previewPane = screen.getByTestId('split-view-preview-pane')

    Object.defineProperty(editorPane, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(editorPane, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(previewPane, 'scrollHeight', { configurable: true, value: 3500 })
    Object.defineProperty(previewPane, 'clientHeight', { configurable: true, value: 500 })

    fireEvent.mouseEnter(editorPane)

    // Editor max scroll = 1500, preview max scroll = 3000
    // Scroll editor to 750 (ratio = 0.5)
    editorPane.scrollTop = 750
    fireEvent.scroll(editorPane)

    expect(onSyncScroll).toHaveBeenCalledWith('editor', 0.5)
    if (rafCallback) {
      ;(rafCallback as FrameRequestCallback)(performance.now())
    }
    expect(previewPane.scrollTop).toBe(1500)
  })

  it('syncs scroll from preview to editor when preview is scrolled', () => {
    const onSyncScroll = vi.fn()
    let rafCallback: FrameRequestCallback | null = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })

    render(
      <SplitViewContainer
        mode="split"
        editor={<div style={{ height: 2000 }}>Editor Content</div>}
        preview={<div style={{ height: 3000 }}>Preview Content</div>}
        onSyncScroll={onSyncScroll}
      />
    )

    const editorPane = screen.getByTestId('split-view-editor-pane')
    const previewPane = screen.getByTestId('split-view-preview-pane')

    Object.defineProperty(editorPane, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(editorPane, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(previewPane, 'scrollHeight', { configurable: true, value: 3500 })
    Object.defineProperty(previewPane, 'clientHeight', { configurable: true, value: 500 })

    fireEvent.mouseEnter(previewPane)

    // Preview max scroll = 3000. Scroll preview to 600 (ratio = 0.2)
    previewPane.scrollTop = 600
    fireEvent.scroll(previewPane)

    expect(onSyncScroll).toHaveBeenCalledWith('preview', 0.2)
    if (rafCallback) {
      ;(rafCallback as FrameRequestCallback)(performance.now())
    }
    expect(editorPane.scrollTop).toBe(300)
  })

  it('does not drop rapid successive scroll events and updates target to final scroll ratio', () => {
    const onSyncScroll = vi.fn()
    const rafCallbacks = new Map<number, FrameRequestCallback>()
    let nextRafId = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++
      rafCallbacks.set(id, cb)
      return id
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id)
    })

    render(
      <SplitViewContainer
        mode="split"
        editor={<div style={{ height: 2000 }}>Editor Content</div>}
        preview={<div style={{ height: 3000 }}>Preview Content</div>}
        onSyncScroll={onSyncScroll}
      />
    )

    const editorPane = screen.getByTestId('split-view-editor-pane')
    const previewPane = screen.getByTestId('split-view-preview-pane')

    Object.defineProperty(editorPane, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(editorPane, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(previewPane, 'scrollHeight', { configurable: true, value: 3500 })
    Object.defineProperty(previewPane, 'clientHeight', { configurable: true, value: 500 })

    fireEvent.mouseEnter(editorPane)

    // Editor max scroll = 1500, preview max scroll = 3000
    // Scroll 1: scrollTop = 300 (ratio = 0.2)
    editorPane.scrollTop = 300
    fireEvent.scroll(editorPane)

    // Scroll 2 (rapidly before rAF fires): scrollTop = 750 (ratio = 0.5)
    editorPane.scrollTop = 750
    fireEvent.scroll(editorPane)

    // Scroll 3 (rapidly before rAF fires): scrollTop = 1200 (ratio = 0.8)
    editorPane.scrollTop = 1200
    fireEvent.scroll(editorPane)

    // Verify all rapid scroll events were captured, not dropped
    expect(onSyncScroll).toHaveBeenCalledTimes(3)
    expect(onSyncScroll).toHaveBeenLastCalledWith('editor', 0.8)

    // Execute remaining scheduled animation frames
    Array.from(rafCallbacks.values()).forEach((cb) => cb(performance.now()))

    // Target pane should reach the final scroll ratio (0.8 * 3000 = 2400)
    expect(previewPane.scrollTop).toBe(2400)
  })

  it('prevents circular scroll loops when syncing without relying solely on mouseEnter blocking', () => {
    const onSyncScroll = vi.fn()
    const rafCallbacks = new Map<number, FrameRequestCallback>()
    let nextRafId = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++
      rafCallbacks.set(id, cb)
      return id
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id)
    })

    render(
      <SplitViewContainer
        mode="split"
        editor={<div style={{ height: 2000 }}>Editor Content</div>}
        preview={<div style={{ height: 3000 }}>Preview Content</div>}
        onSyncScroll={onSyncScroll}
      />
    )

    const editorPane = screen.getByTestId('split-view-editor-pane')
    const previewPane = screen.getByTestId('split-view-preview-pane')

    Object.defineProperty(editorPane, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(editorPane, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(previewPane, 'scrollHeight', { configurable: true, value: 3500 })
    Object.defineProperty(previewPane, 'clientHeight', { configurable: true, value: 500 })

    // Test without mouseEnter on editorPane - neither pane is hovered initially
    editorPane.scrollTop = 750
    fireEvent.scroll(editorPane)

    expect(onSyncScroll).toHaveBeenCalledTimes(1)
    expect(onSyncScroll).toHaveBeenCalledWith('editor', 0.5)

    // Execute rAF callback that updates previewPane.scrollTop
    const cbs = Array.from(rafCallbacks.values())
    cbs.forEach((cb) => cb(performance.now()))
    expect(previewPane.scrollTop).toBe(1500)

    // Now hover the previewPane and fire scroll (programmatic echo)
    // Even though previewPane is hovered (mouseEnter), programmatic target guard must prevent echo back to editor
    fireEvent.mouseEnter(previewPane)
    fireEvent.scroll(previewPane)
    expect(onSyncScroll).toHaveBeenCalledTimes(1)
  })

  it('maps the preview pane scrolled to 80% onto 80% of the editor pane, and ignores the echo', () => {
    const onSyncScroll = vi.fn()
    const rafCallbacks = new Map<number, FrameRequestCallback>()
    let nextRafId = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++
      rafCallbacks.set(id, cb)
      return id
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id)
    })

    render(
      <SplitViewContainer
        mode="split"
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
        onSyncScroll={onSyncScroll}
      />
    )
    const editorPane = screen.getByTestId('split-view-editor-pane')
    const previewPane = screen.getByTestId('split-view-preview-pane')
    Object.defineProperty(editorPane, 'scrollHeight', { configurable: true, value: 1500 })
    Object.defineProperty(editorPane, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(previewPane, 'scrollHeight', { configurable: true, value: 5500 })
    Object.defineProperty(previewPane, 'clientHeight', { configurable: true, value: 500 })

    fireEvent.mouseEnter(previewPane)
    previewPane.scrollTop = 4000
    fireEvent.scroll(previewPane)
    Array.from(rafCallbacks.values()).forEach((cb) => cb(performance.now()))
    expect(editorPane.scrollTop).toBeCloseTo(800, 0)

    fireEvent.mouseEnter(editorPane)
    fireEvent.scroll(editorPane)
    expect(onSyncScroll).toHaveBeenCalledTimes(1)
  })
})

describe('TopToolbar ViewMode buttons', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders view mode segmented buttons and calls onViewModeChange', () => {
    const onViewModeChange = vi.fn()
    render(
      <TopToolbar
        title="Test Doc"
        tocOpen={false}
        onToggleToc={vi.fn()}
        fontScale="md"
        onFontScaleChange={vi.fn()}
        isReadingMode={false}
        onToggleReadingMode={vi.fn()}
        viewMode="reading"
        onViewModeChange={onViewModeChange}
      />
    )

    const readingBtn = screen.getByRole('radio', { name: 'Đọc' })
    const editorBtn = screen.getByRole('radio', { name: 'Sửa' })

    expect(readingBtn.classList.contains('active')).toBe(true)
    expect(editorBtn.classList.contains('active')).toBe(false)

    fireEvent.click(editorBtn)
    expect(onViewModeChange).toHaveBeenCalledWith('live')
    expect(screen.queryByRole('radio', { name: 'Chia đôi' })).toBeNull()
  })
})
