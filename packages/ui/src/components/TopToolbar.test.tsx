import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TopToolbar, type FontScale } from './TopToolbar'

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Thêm' }))
}

describe('TopToolbar', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    title: 'Document Title',
    tocOpen: false,
    onToggleToc: vi.fn(),
    fontScale: 'md' as FontScale,
    onFontScaleChange: vi.fn(),
    isReadingMode: false,
    onToggleReadingMode: vi.fn(),
    onOpenSearch: vi.fn(),
  }

  it('renders header container with toolbar class and no inline layout styles', () => {
    const { container } = render(<TopToolbar {...defaultProps} />)
    const header = container.querySelector('header')
    expect(header?.classList.contains('top-toolbar')).toBe(true)
    expect(header?.classList.contains('md-no-print')).toBe(true)
    expect(header?.getAttribute('style')).toBeNull()
  })

  it('renders title and fallback when title is empty', () => {
    const { rerender } = render(<TopToolbar {...defaultProps} title="My Notes" />)
    expect(screen.getByText('My Notes')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} title="" />)
    expect(screen.getByText('Untitled')).toBeTruthy()
  })

  it('triggers onToggleToc when ToC button is clicked', () => {
    const onToggleToc = vi.fn()
    render(<TopToolbar {...defaultProps} onToggleToc={onToggleToc} />)

    const tocBtn = screen.getByRole('button', { name: 'Mục lục' })
    fireEvent.click(tocBtn)
    expect(onToggleToc).toHaveBeenCalledTimes(1)
  })

  it('displays correct percentage for font scales', () => {
    const { rerender } = render(<TopToolbar {...defaultProps} fontScale="sm" />)
    openMenu()
    expect(screen.getByText('85%')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} fontScale="md" />)
    expect(screen.getByText('100%')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} fontScale="lg" />)
    expect(screen.getByText('115%')).toBeTruthy()

    rerender(<TopToolbar {...defaultProps} fontScale="xl" />)
    expect(screen.getByText('130%')).toBeTruthy()
  })

  it('handles font scale decrease and disabled state at sm', () => {
    const onFontScaleChange = vi.fn()
    const { rerender } = render(
      <TopToolbar {...defaultProps} fontScale="md" onFontScaleChange={onFontScaleChange} />
    )

    openMenu()
    const decreaseBtn = screen.getByTitle('Giảm cỡ chữ') as HTMLButtonElement
    expect(decreaseBtn.disabled).toBe(false)
    fireEvent.click(decreaseBtn)
    expect(onFontScaleChange).toHaveBeenCalledWith('sm')

    rerender(
      <TopToolbar {...defaultProps} fontScale="sm" onFontScaleChange={onFontScaleChange} />
    )
    expect(decreaseBtn.disabled).toBe(true)
  })

  it('handles font scale increase and disabled state at xl', () => {
    const onFontScaleChange = vi.fn()
    const { rerender } = render(
      <TopToolbar {...defaultProps} fontScale="lg" onFontScaleChange={onFontScaleChange} />
    )

    openMenu()
    const increaseBtn = screen.getByTitle('Tăng cỡ chữ') as HTMLButtonElement
    expect(increaseBtn.disabled).toBe(false)
    fireEvent.click(increaseBtn)
    expect(onFontScaleChange).toHaveBeenCalledWith('xl')

    rerender(
      <TopToolbar {...defaultProps} fontScale="xl" onFontScaleChange={onFontScaleChange} />
    )
    expect(increaseBtn.disabled).toBe(true)
  })

  it('triggers onOpenSearch when search button is clicked', () => {
    const onOpenSearch = vi.fn()
    render(<TopToolbar {...defaultProps} onOpenSearch={onOpenSearch} />)

    const searchBtn = screen.getByRole('button', { name: 'Tìm' })
    fireEvent.click(searchBtn)
    expect(onOpenSearch).toHaveBeenCalledTimes(1)
  })

  it('triggers onToggleReadingMode when reading mode button is clicked', () => {
    const onToggleReadingMode = vi.fn()
    render(<TopToolbar {...defaultProps} onToggleReadingMode={onToggleReadingMode} />)

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chế độ đọc' }))
    expect(onToggleReadingMode).toHaveBeenCalledTimes(1)
  })

  it('renders and triggers onPresent when present button is clicked', () => {
    const onPresent = vi.fn()
    const { rerender } = render(<TopToolbar {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Trình chiếu' })).toBeNull()

    rerender(<TopToolbar {...defaultProps} onPresent={onPresent} />)
    const presentBtn = screen.getByRole('button', { name: 'Trình chiếu' })
    fireEvent.click(presentBtn)
    expect(onPresent).toHaveBeenCalledTimes(1)
  })

  it('renders and triggers onOpenMindmap when mindmap button is clicked', () => {
    const onOpenMindmap = vi.fn()
    const { rerender } = render(<TopToolbar {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Sơ đồ' })).toBeNull()

    rerender(<TopToolbar {...defaultProps} onOpenMindmap={onOpenMindmap} />)
    const mindmapBtn = screen.getByRole('button', { name: 'Sơ đồ' })
    fireEvent.click(mindmapBtn)
    expect(onOpenMindmap).toHaveBeenCalledTimes(1)
  })

  it('shows AI-edited label when dirty with ai', () => {
    const { rerender } = render(<TopToolbar {...defaultProps} saveStatus={{ kind: 'dirty', ai: true }} />)
    const el = document.querySelector('.tb-status.dirty-indicator') as HTMLElement
    expect(el.textContent).toBe('AI đã sửa — chưa lưu')
    expect(el.getAttribute('title')).toBe('Bấm Lưu (⌘S) để ghi thay đổi của AI ra file.')
    rerender(<TopToolbar {...defaultProps} saveStatus={{ kind: 'dirty' }} />)
    expect(screen.getByText('Chưa lưu')).toBeTruthy()
  })

  it('renders each SaveStatus text', () => {
    const at = new Date(2026, 0, 5, 14, 2).getTime()
    const { rerender } = render(<TopToolbar {...defaultProps} saveStatus={{ kind: 'none' }} />)
    expect(document.querySelector('.tb-status')?.textContent).toBe('')
    rerender(<TopToolbar {...defaultProps} saveStatus={{ kind: 'dirty' }} />)
    expect(screen.getByText('Chưa lưu')).toBeTruthy()
    rerender(<TopToolbar {...defaultProps} saveStatus={{ kind: 'saving' }} />)
    expect(screen.getByText('Đang lưu…')).toBeTruthy()
    rerender(<TopToolbar {...defaultProps} saveStatus={{ kind: 'saved', at }} />)
    expect(screen.getByText('Đã lưu 14:02')).toBeTruthy()
    rerender(<TopToolbar {...defaultProps} saveStatus={{ kind: 'error', message: 'boom', onRetry: vi.fn() }} />)
    expect(screen.getByText('Không lưu được')).toBeTruthy()
    expect(document.querySelector('.tb-status')?.getAttribute('title')).toBe('boom')
    expect(document.querySelector('.tb-status')?.getAttribute('aria-live')).toBe('polite')
    rerender(<TopToolbar {...defaultProps} saveStatus={{ kind: 'needs-permission', onGrant: vi.fn() }} />)
    expect(screen.getByText('Cần cấp quyền ghi')).toBeTruthy()
  })

  it('calls onRetry and onGrant from the status buttons', () => {
    const onRetry = vi.fn()
    const onGrant = vi.fn()
    const { rerender } = render(<TopToolbar {...defaultProps} saveStatus={{ kind: 'error', onRetry }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender(<TopToolbar {...defaultProps} saveStatus={{ kind: 'needs-permission', onGrant }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cấp quyền' }))
    expect(onGrant).toHaveBeenCalledTimes(1)
  })

  it('view switch is a radiogroup and arrow keys change mode', () => {
    const onViewModeChange = vi.fn()
    render(<TopToolbar {...defaultProps} viewMode="reading" onViewModeChange={onViewModeChange} />)
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['Đọc', 'Sửa'])
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(radios[0]!, { key: 'ArrowRight' })
    expect(onViewModeChange).toHaveBeenLastCalledWith('live')
    fireEvent.keyDown(radios[0]!, { key: 'ArrowLeft' })
    expect(onViewModeChange).toHaveBeenLastCalledWith('live')
  })

  it('renders actions as bar buttons and Lưu when onSave given', () => {
    const onSelect = vi.fn()
    const onSave = vi.fn()
    render(<TopToolbar {...defaultProps} onSave={onSave} actions={[{ id: 'open', label: 'Mở file…', icon: 'open-file', onSelect }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở file…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  describe('narrow viewport', () => {
    afterEach(() => {
      delete (window as any).matchMedia
    })
    it('moves search/present/mindmap/actions/save into the menu', () => {
      ;(window as any).matchMedia = (q: string) => ({
        matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      })
      const onSelect = vi.fn()
      const onOpenSearch = vi.fn()
      render(
        <TopToolbar
          {...defaultProps}
          onOpenSearch={onOpenSearch}
          onPresent={vi.fn()}
          onOpenMindmap={vi.fn()}
          onSave={vi.fn()}
          actions={[{ id: 'open', label: 'Mở file…', icon: 'open-file', onSelect }]}
        />
      )
      for (const n of ['Tìm', 'Trình chiếu', 'Sơ đồ', 'Mở file…', 'Lưu']) {
        expect(screen.queryByRole('button', { name: n })).toBeNull()
      }
      openMenu()
      for (const n of ['Tìm', 'Trình chiếu', 'Sơ đồ', 'Mở file…', 'Lưu']) {
        expect(screen.getByRole('menuitem', { name: n })).toBeTruthy()
      }
      fireEvent.click(screen.getByRole('menuitem', { name: 'Tìm' }))
      expect(onOpenSearch).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  it('Esc closes the menu and returns focus to Thêm', () => {
    render(<TopToolbar {...defaultProps} />)
    openMenu()
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Thêm' }))
  })

  it('menu arrow keys move focus', () => {
    render(<TopToolbar {...defaultProps} />)
    openMenu()
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('font scale controls in the menu call onFontScaleChange', () => {
    const onFontScaleChange = vi.fn()
    render(<TopToolbar {...defaultProps} fontScale="md" onFontScaleChange={onFontScaleChange} />)
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tăng cỡ chữ' }))
    expect(onFontScaleChange).toHaveBeenLastCalledWith('lg')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Giảm cỡ chữ' }))
    expect(onFontScaleChange).toHaveBeenLastCalledWith('sm')
  })

  it('omits the share button without onShare', () => {
    render(<TopToolbar {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Chia sẻ' })).toBeNull()
  })

  it('renders a share button that calls onShare', () => {
    const onShare = vi.fn()
    render(<TopToolbar {...defaultProps} onShare={onShare} />)
    const btn = screen.getByRole('button', { name: 'Chia sẻ' })
    expect(btn.getAttribute('title')).toBe('Chia sẻ')
    fireEvent.click(btn)
    expect(onShare).toHaveBeenCalledTimes(1)
  })
})

import { act } from '@testing-library/react'
import type { SyncStatus } from './TopToolbar'

describe('TopToolbar sync status', () => {
  const base = {
    title: 'T', tocOpen: false, onToggleToc: vi.fn(), fontScale: 'md' as FontScale,
    onFontScaleChange: vi.fn(), isReadingMode: false, onToggleReadingMode: vi.fn(),
  }
  const mk = (s?: SyncStatus) => <TopToolbar {...base} syncStatus={s} />
  const labels = ['Đang kết nối', 'Đã đồng bộ', 'Ngoại tuyến']

  afterEach(() => { cleanup(); vi.useRealTimers() })

  it.each([
    ['revoked', 'Đã ngắt — link bị thu hồi hoặc tài liệu chia sẻ đã bị xoá'],
    ['full', 'Ngừng đồng bộ — tài liệu vượt giới hạn dung lượng'],
  ] as const)('shows %s label immediately', (s, label) => {
    render(mk(s))
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('renders nothing without syncStatus or when off', () => {
    const { rerender } = render(mk())
    for (const l of labels) expect(screen.queryByText(l)).toBeNull()
    rerender(mk('off'))
    for (const l of labels) expect(screen.queryByText(l)).toBeNull()
  })

  it.each([['connecting', 'Đang kết nối'], ['online', 'Đã đồng bộ'], ['offline', 'Ngoại tuyến']] as const)(
    'renders %s label with role=status', (s, label) => {
      render(mk(s))
      const el = screen.getByText(label)
      expect(el.getAttribute('role')).toBe('status')
      expect(el.getAttribute('aria-live')).toBe('polite')
    })

  it('keeps Ngoại tuyến until connecting lasts 1500ms', () => {
    vi.useFakeTimers()
    const { rerender } = render(mk('offline'))
    rerender(mk('connecting'))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByText('Ngoại tuyến')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.queryByText('Đang kết nối')).not.toBeNull()
    expect(screen.queryByText('Ngoại tuyến')).toBeNull()
  })

  it('never shows connecting on quick offline -> connecting -> offline', () => {
    vi.useFakeTimers()
    const { rerender } = render(mk('offline'))
    rerender(mk('connecting'))
    act(() => { vi.advanceTimersByTime(800) })
    rerender(mk('offline'))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText('Đang kết nối')).toBeNull()
    expect(screen.queryByText('Ngoại tuyến')).not.toBeNull()
  })

  it('offline -> online shows immediately', () => {
    vi.useFakeTimers()
    const { rerender } = render(mk('offline'))
    rerender(mk('online'))
    expect(screen.queryByText('Đã đồng bộ')).not.toBeNull()
  })

  it('renders presence bar before sync status when peers present', () => {
    const peers = [
      { clientId: 1, name: 'An', color: 'var(--peer-1)', isSelf: true },
      { clientId: 2, name: 'Binh', color: 'var(--peer-2)', isSelf: false },
    ]
    const { container } = render(<TopToolbar {...base} presence={peers} syncStatus="online" />)
    const bar = container.querySelector('.presence-bar')
    expect(bar).not.toBeNull()
    expect(bar!.querySelectorAll('.presence-avatar').length).toBe(2)
    const next = bar!.nextElementSibling
    expect(next).not.toBeNull()
    expect(next!.classList.contains('presence-bar')).toBe(false)
  })

  it('renders no presence bar without peers', () => {
    const a = render(<TopToolbar {...base} />)
    expect(a.container.querySelector('.presence-bar')).toBeNull()
    const b = render(<TopToolbar {...base} presence={[]} />)
    expect(b.container.querySelector('.presence-bar')).toBeNull()
  })
})
