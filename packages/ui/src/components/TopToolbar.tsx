import React, { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { PresenceBar, type Peer } from './PresenceBar'
import type { ViewMode } from './SplitViewContainer'
import '../theme/toolbar.css'

export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

export type SaveStatus =
  | { kind: 'none' } | { kind: 'dirty' } | { kind: 'saving' } | { kind: 'saved'; at: number }
  | { kind: 'error'; message?: string; onRetry(): void } | { kind: 'needs-permission'; onGrant(): void }

export type SyncStatus = 'off' | 'connecting' | 'online' | 'offline'

export interface ToolbarAction { id: string; label: string; icon: IconName; onSelect(): void }

export interface TopToolbarProps {
  presence?: Peer[]
  title: string
  tocOpen: boolean
  onToggleToc: () => void
  fontScale: FontScale
  onFontScaleChange: (scale: FontScale) => void
  isReadingMode: boolean
  onToggleReadingMode: () => void
  onOpenSearch?: () => void
  onPresent?: () => void
  onOpenMindmap?: () => void
  onShare?: () => void
  actions?: ToolbarAction[]
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  saveStatus?: SaveStatus
  onSave?: () => void
  syncStatus?: SyncStatus
}

const FONT_SCALES: FontScale[] = ['sm', 'md', 'lg', 'xl']

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  sm: '85%',
  md: '100%',
  lg: '115%',
  xl: '130%',
}

const VIEW_OPTIONS: { mode: ViewMode; label: string; title: string }[] = [
  { mode: 'reading', label: 'Đọc', title: 'Chế độ Đọc' },
  { mode: 'live', label: 'Sửa', title: 'Sửa trên trang' },
]

const NARROW_QUERY = '(max-width: 720px)'

function useNarrow(): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY).matches : false)
  const [narrow, setNarrow] = useState<boolean>(get)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(mql.matches)
    onChange()
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])
  return narrow
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function StatusView({ status }: { status: SaveStatus }): React.JSX.Element {
  let content: React.ReactNode = null
  let title: string | undefined
  switch (status.kind) {
    case 'dirty':
      content = 'Chưa lưu'
      break
    case 'saving':
      content = 'Đang lưu…'
      break
    case 'saved': {
      const d = new Date(status.at)
      content = `Đã lưu ${pad(d.getHours())}:${pad(d.getMinutes())}`
      break
    }
    case 'error':
      title = status.message
      content = (
        <>
          <span>Không lưu được</span>
          <button type="button" className="tb-text-btn" onClick={status.onRetry}>Thử lại</button>
        </>
      )
      break
    case 'needs-permission':
      content = (
        <>
          <span>Cần cấp quyền ghi</span>
          <button type="button" className="tb-text-btn" onClick={status.onGrant}>Cấp quyền</button>
        </>
      )
      break
    default:
      break
  }
  return (
    <span
      className={`tb-status${status.kind === 'dirty' ? ' dirty-indicator' : ''}`}
      data-kind={status.kind}
      aria-live="polite"
      title={title}
    >
      {content}
    </span>
  )
}

const SYNC_LABELS: Record<Exclude<SyncStatus, 'off'>, string> = {
  connecting: 'Đang kết nối',
  online: 'Đã đồng bộ',
  offline: 'Ngoại tuyến',
}

const CONNECTING_DELAY_MS = 1500

function useSmoothedSync(status: SyncStatus): SyncStatus {
  const [shown, setShown] = useState<SyncStatus>(status)
  const shownRef = useRef<SyncStatus>(status)
  useEffect(() => {
    const apply = (s: SyncStatus) => {
      shownRef.current = s
      setShown(s)
    }
    if (status === 'connecting' && shownRef.current === 'offline') {
      const t = setTimeout(() => apply('connecting'), CONNECTING_DELAY_MS)
      return () => clearTimeout(t)
    }
    apply(status)
    return undefined
  }, [status])
  return shown
}

function SyncStatusView({ status }: { status: SyncStatus }): React.JSX.Element | null {
  const shown = useSmoothedSync(status)
  if (shown === 'off') return null
  return (
    <span className="tb-status" data-kind={`sync-${shown}`} role="status" aria-live="polite">
      {SYNC_LABELS[shown]}
    </span>
  )
}

function IconBtn(props: { icon: IconName; label: string; title?: string; onClick?: () => void }): React.JSX.Element {
  return (
    <button type="button" className="tb-btn" aria-label={props.label} title={props.title ?? props.label} onClick={props.onClick}>
      <Icon name={props.icon} size={20} />
    </button>
  )
}

export function TopToolbar(props: TopToolbarProps): React.JSX.Element {
  const narrow = useNarrow()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const moreRef = useRef<HTMLButtonElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)
  const segRefs = useRef<(HTMLButtonElement | null)[]>([])
  const currentIndex = FONT_SCALES.indexOf(props.fontScale)
  const status = props.saveStatus ?? { kind: 'none' as const }

  const changeFont = (delta: number) => {
    const next = FONT_SCALES[currentIndex + delta]
    if (currentIndex >= 0 && next) props.onFontScaleChange(next)
  }

  useEffect(() => {
    if (!menuOpen) return
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
    first?.focus()
    const onDown = (e: MouseEvent) => {
      if (rightRef.current && !rightRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        moreRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  const onFocusOut = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && (menuRef.current?.contains(next) || moreRef.current === next)) return
    setMenuOpen(false)
  }

  const closeMenu = (restoreFocus: boolean) => {
    setMenuOpen(false)
    if (restoreFocus) moreRef.current?.focus()
  }

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
    const idx = items.indexOf(document.activeElement as HTMLElement)
    let target: HTMLElement | undefined
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu(true)
      return
    }
    if (e.key === 'ArrowDown') target = items[(idx + 1) % items.length]
    else if (e.key === 'ArrowUp') target = items[(idx - 1 + items.length) % items.length]
    else if (e.key === 'Home') target = items[0]
    else if (e.key === 'End') target = items[items.length - 1]
    else return
    e.preventDefault()
    target?.focus()
  }

  const select = (fn?: () => void) => () => {
    setMenuOpen(false)
    fn?.()
    moreRef.current?.focus()
  }

  const onSegKeyDown = (e: React.KeyboardEvent, i: number) => {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % VIEW_OPTIONS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length
    if (next < 0) return
    e.preventDefault()
    const opt = VIEW_OPTIONS[next]
    if (!opt) return
    props.onViewModeChange?.(opt.mode)
    segRefs.current[next]?.focus()
  }

  const actions = props.actions ?? []
  const overflowItems: { id: string; label: string; icon: IconName; onSelect: () => void }[] = []
  if (narrow) {
    if (props.onOpenSearch) overflowItems.push({ id: 'search', label: 'Tìm', icon: 'search', onSelect: props.onOpenSearch })
    if (props.onPresent) overflowItems.push({ id: 'present', label: 'Trình chiếu', icon: 'present', onSelect: props.onPresent })
    if (props.onOpenMindmap) overflowItems.push({ id: 'mindmap', label: 'Sơ đồ', icon: 'mindmap', onSelect: props.onOpenMindmap })
    if (props.onShare) overflowItems.push({ id: 'share', label: 'Chia sẻ', icon: 'share', onSelect: props.onShare })
    for (const a of actions) overflowItems.push(a)
    if (props.onSave) overflowItems.push({ id: 'save', label: 'Lưu', icon: 'save', onSelect: props.onSave })
  }

  const hasView = props.viewMode !== undefined || props.onViewModeChange !== undefined

  return (
    <header className="top-toolbar md-no-print">
      <div className="tb-left">
        <button type="button" className="tb-btn" title="Mục lục" aria-label="Mục lục" aria-pressed={props.tocOpen} onClick={props.onToggleToc}>
          <Icon name="toc" size={20} />
        </button>
        <Logo size={20} />
        <span className="tb-title">{props.title || 'Untitled'}</span>
        <StatusView status={status} />
        {props.presence !== undefined && props.presence.length > 0 && <PresenceBar peers={props.presence} />}
        <SyncStatusView status={props.syncStatus ?? 'off'} />
      </div>

      {hasView && (
        <div className="tb-mid">
          <div className="tb-seg view-mode-group" role="radiogroup" aria-label="Chế độ xem">
            {VIEW_OPTIONS.map((opt, i) => {
              const checked = props.viewMode === opt.mode
              return (
                <button
                  key={opt.mode}
                  ref={(el) => { segRefs.current[i] = el }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked || (props.viewMode === undefined && i === 0) ? 0 : -1}
                  className={`tb-seg-btn${checked ? ' active' : ''}`}
                  title={opt.title}
                  onClick={() => props.onViewModeChange?.(opt.mode)}
                  onKeyDown={(e) => onSegKeyDown(e, i)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="tb-right" ref={rightRef}>
        {!narrow && (
          <>
            {props.onOpenSearch && <IconBtn icon="search" label="Tìm" title="Tìm kiếm (Cmd+F)" onClick={props.onOpenSearch} />}
            {props.onPresent && <IconBtn icon="present" label="Trình chiếu" title="Trình chiếu (P)" onClick={props.onPresent} />}
            {props.onOpenMindmap && <IconBtn icon="mindmap" label="Sơ đồ" title="Sơ đồ (Cmd+M)" onClick={props.onOpenMindmap} />}
            {props.onShare && <IconBtn icon="share" label="Chia sẻ" onClick={props.onShare} />}
            {actions.map((a) => (
              <IconBtn key={a.id} icon={a.icon} label={a.label} onClick={a.onSelect} />
            ))}
            {props.onSave && <IconBtn icon="save" label="Lưu" title="Lưu (Cmd+S)" onClick={props.onSave} />}
          </>
        )}
        <button
          ref={moreRef}
          type="button"
          className="tb-btn"
          aria-label="Thêm"
          title="Thêm"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          onBlur={menuOpen ? onFocusOut : undefined}
        >
          <Icon name="more" size={20} />
        </button>
        {menuOpen && (
          <div ref={menuRef} className="tb-menu" role="menu" aria-label="Thêm" onKeyDown={onMenuKeyDown} onBlur={onFocusOut}>
            {overflowItems.map((it) => (
              <button key={it.id} type="button" role="menuitem" className="tb-menu-item" onClick={select(it.onSelect)}>
                <Icon name={it.icon} size={20} />
                <span>{it.label}</span>
              </button>
            ))}
            <div className="tb-menu-row">
              <span className="tb-menu-label">Cỡ chữ</span>
              <button
                type="button"
                role="menuitem"
                className="tb-btn"
                title="Giảm cỡ chữ"
                aria-label="Giảm cỡ chữ"
                disabled={props.fontScale === 'sm'}
                onClick={() => changeFont(-1)}
              >
                <Icon name="font-smaller" size={20} />
              </button>
              <span className="tb-scale">{FONT_SCALE_LABELS[props.fontScale] || '100%'}</span>
              <button
                type="button"
                role="menuitem"
                className="tb-btn"
                title="Tăng cỡ chữ"
                aria-label="Tăng cỡ chữ"
                disabled={props.fontScale === 'xl'}
                onClick={() => changeFont(1)}
              >
                <Icon name="font-larger" size={20} />
              </button>
            </div>
            <button type="button" role="menuitem" className="tb-menu-item" onClick={select(props.onToggleReadingMode)}>
              <Icon name="book" size={20} />
              <span>Chế độ đọc</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
