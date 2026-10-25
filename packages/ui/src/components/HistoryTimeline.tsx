import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, JSX } from 'react'
import type { HistoryEntry } from '@md-reader/core'
import { createT, useLocale, useT, type TFunction } from '../i18n'

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

export function historyLabel(label: string, t: TFunction = createT('vi')): string {
  if (label === 'save') return t('history.save')
  if (label === 'auto') return t('history.auto')
  if (label === 'import') return t('history.import')
  // stored data prefix (written in Vietnamese), displayed per locale
  if (label.startsWith('Khôi phục: ')) return t('history.restored', { label: historyLabel(label.slice('Khôi phục: '.length), t) })
  return label
}

export function HistoryTimeline(props: HistoryTimelineProps): JSX.Element {
  const t = useT()
  const locale = useLocale()
  const fmt = useMemo(() => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }), [locale])
  const { entries, actors, previewId, onPreview, onRestore, onClose } = props
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const sorted = useMemo(() => [...entries].sort((a, b) => b.ts - a.ts), [entries])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const row = (document.activeElement as HTMLElement | null)?.closest('[role="option"]') as HTMLElement | null
    const idx = row ? items.indexOf(row) : -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.max(0, Math.min(items.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))
      items[next]?.focus()
    } else if (e.key === 'Enter') {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return
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

  useEffect(() => {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    const target = listRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ?? items?.[0] ?? closeRef.current
    target?.focus()
  }, [])

  return (
    <aside className="history-panel" aria-label={t('history.title')} onKeyDown={onKeyDown}>
      <header className="history-panel__head">
        <h2>{t('history.title')}</h2>
        <button type="button" ref={closeRef} aria-label={t('history.closeLabel')} onClick={onClose}>×</button>
      </header>
      {sorted.length === 0 ? (
        <p>{t('history.empty')}</p>
      ) : (
        <ul role="listbox" aria-label={t('history.list')} ref={listRef}>
          {sorted.map((en) => {
            const others = Array.from(
              new Set(
                en.clientIds
                  .map((c) => actors[String(c)])
                  .filter((n): n is string => !!n && n !== en.actor),
              ),
            )
            const noSnap = !en.snapshot
            const title = noSnap ? t('history.noSnapshot') : undefined
            const previewing = en.id === previewId
            return (
              <li key={en.id} role="option" aria-selected={previewing} tabIndex={0} className="history-row">
                <div>{historyLabel(en.label, t)}</div>
                <div>{fmt.format(new Date(en.ts))}</div>
                <div>{t('history.by', { actor: en.actor })}</div>
                {others.length > 0 && <div>{t('history.with', { names: others.join(', ') })}</div>}
                {confirmId === en.id ? (
                  <div>
                    <span>{t('history.restoreQ')}</span>
                    <button type="button" onClick={() => { setConfirmId(null); onRestore(en.id) }}>{t('history.restore')}</button>
                    <button type="button" onClick={() => setConfirmId(null)}>{t('history.cancel')}</button>
                  </div>
                ) : (
                  <div>
                    <button type="button" disabled={noSnap} title={title}
                      onClick={() => onPreview(previewing ? null : en.id)}>
                      {previewing ? t('history.exitPreview') : t('history.preview')}
                    </button>
                    <button type="button" disabled={noSnap} title={title} onClick={() => setConfirmId(en.id)}>
                      {t('history.restore')}
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
