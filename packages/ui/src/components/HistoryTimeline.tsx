import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, JSX } from 'react'
import type { HistoryEntry } from '@md-reader/core'

export interface HistoryTimelineProps {
  entries: HistoryEntry[]
  actors: Record<string, string>
  previewId: string | null
  previewText: string | null
  onPreview(id: string | null): void
  onRestore(id: string): void
  onClose(): void
  now?: () => number
}

export function historyLabel(label: string): string {
  if (label === 'save') return 'Đã lưu'
  if (label === 'auto') return 'Tự động lưu mốc'
  if (label === 'import') return 'Nhập'
  return label
}

const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export function HistoryTimeline(props: HistoryTimelineProps): JSX.Element {
  const { entries, actors, previewId, onPreview, onRestore, onClose } = props
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const sorted = useMemo(() => [...entries].sort((a, b) => b.ts - a.ts), [entries])

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const idx = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.max(0, Math.min(items.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))
      items[next]?.focus()
    } else if (e.key === 'Enter') {
      const entry = sorted[idx]
      if (entry && entry.snapshot) {
        e.preventDefault()
        onPreview(entry.id)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (previewId) onPreview(null)
      else onClose()
    }
  }

  return (
    <aside className="history-panel" aria-label="Lịch sử">
      <header className="history-panel__head">
        <h2>Lịch sử</h2>
        <button type="button" aria-label="Đóng lịch sử" onClick={onClose}>×</button>
      </header>
      {sorted.length === 0 ? (
        <p>Chưa có mốc nào.</p>
      ) : (
        <ul role="listbox" aria-label="Các mốc" ref={listRef} onKeyDown={onKeyDown}>
          {sorted.map((en) => {
            const others = Array.from(
              new Set(
                en.clientIds
                  .map((c) => actors[String(c)])
                  .filter((n): n is string => !!n && n !== en.actor),
              ),
            )
            const noSnap = !en.snapshot
            const title = noSnap ? 'Mốc này không có ảnh chụp' : undefined
            const previewing = en.id === previewId
            return (
              <li key={en.id} role="option" aria-selected={previewing} tabIndex={0} className="history-row">
                <div>{historyLabel(en.label)}</div>
                <div>{fmt.format(new Date(en.ts))}</div>
                <div>bởi {en.actor}</div>
                {others.length > 0 && <div>cùng {others.join(', ')}</div>}
                {confirmId === en.id ? (
                  <div>
                    <span>Khôi phục về mốc này?</span>
                    <button type="button" onClick={() => { setConfirmId(null); onRestore(en.id) }}>Khôi phục</button>
                    <button type="button" onClick={() => setConfirmId(null)}>Huỷ</button>
                  </div>
                ) : (
                  <div>
                    <button type="button" disabled={noSnap} title={title}
                      onClick={() => onPreview(previewing ? null : en.id)}>
                      {previewing ? 'Thoát xem' : 'Xem'}
                    </button>
                    <button type="button" disabled={noSnap} title={title} onClick={() => setConfirmId(en.id)}>
                      Khôi phục
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
