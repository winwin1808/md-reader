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

  it('prevents circular scroll loops when syncing', () => {
    const onSyncScroll = vi.fn()
    const rafCallbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
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
    editorPane.scrollTop = 750
    fireEvent.scroll(editorPane)

    expect(onSyncScroll).toHaveBeenCalledTimes(1)

    // While isSyncing is active, programmatic scroll on previewPane should not trigger sync back
    fireEvent.scroll(previewPane)
    expect(onSyncScroll).toHaveBeenCalledTimes(1)

    // Run raf callbacks to reset isSyncing
    while (rafCallbacks.length > 0) {
      const cb = rafCallbacks.shift()
      cb?.(performance.now())
    }
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

    const readingBtn = screen.getByRole('button', { name: /Chế độ Đọc/i })
    const editorBtn = screen.getByRole('button', { name: /Chế độ Soạn thảo/i })
    const splitBtn = screen.getByRole('button', { name: /Chế độ Chia đôi/i })

    expect(readingBtn.classList.contains('active')).toBe(true)
    expect(editorBtn.classList.contains('active')).toBe(false)
    expect(splitBtn.classList.contains('active')).toBe(false)

    fireEvent.click(editorBtn)
    expect(onViewModeChange).toHaveBeenCalledWith('editor')

    fireEvent.click(splitBtn)
    expect(onViewModeChange).toHaveBeenCalledWith('split')
  })
})
