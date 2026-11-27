import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, JSX } from 'react'
import type { HistoryEntry } from '@md-reader/core'
import { createT, useLocale, useT, localeTag, type TFunction } from '../i18n'

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

const PAGE = 50

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
  const fmt = useMemo(() => new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' }), [locale])
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(localeTag(locale), { hour: '2-digit', minute: '2-digit' }), [locale])
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(localeTag(locale), { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }), [locale])
  const { entries, actors, previewId, onPreview, onRestore, onClose, now = Date.now } = props
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const sorted = useMemo(() => [...entries].sort((a, b) => b.ts - a.ts), [entries])
  const [limit, setLimit] = useState(PAGE)
  const visible = sorted.slice(0, limit)
  const openerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null,
  )

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
    return () => {
      const o = openerRef.current
      if (o && o !== document.body && o.isConnected) o.focus()
    }
  }, [])

  const dayKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
  const today = new Date(now())
  const todayKey = dayKey(today.getTime())
  const yesterdayKey = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime())
  const dayLabel = (ts: number) => {
    const k = dayKey(ts)
    if (k === todayKey) return t('history.today')
    if (k === yesterdayKey) return t('history.yesterday')
    return dayFmt.format(new Date(ts))
  }
  const kindOf = (label: string) =>
    label.startsWith('Khôi phục: ') ? 'restore' : label === 'save' || label === 'auto' || label === 'import' ? label : 'other'

  return (
    <aside className="history-panel" aria-label={t('history.title')} onKeyDown={onKeyDown}>
      <header className="history-panel__head">
        <h2>{t('history.title')}</h2>
        {sorted.length > 0 && <span className="history-panel__count">{t('history.count', { n: sorted.length })}</span>}
        <button type="button" className="history-panel__close" ref={closeRef} aria-label={t('history.closeLabel')} onClick={onClose}>×</button>
      </header>
      <div className="history-panel__body">
      {sorted.length === 0 ? (
        <p className="history-empty">{t('history.empty')}</p>
      ) : (
        <ul role="listbox" aria-label={t('history.list')} ref={listRef} className="history-list">
          {visible.map((en, i) => {
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
            const prev = visible[i - 1]
            const newDay = !prev || dayKey(prev.ts) !== dayKey(en.ts)
            const kind = kindOf(en.label)
            return (
              <Fragment key={en.id}>
                {newDay && <li role="presentation" className="history-day">{dayLabel(en.ts)}</li>}
                <li role="option" aria-selected={previewing} tabIndex={0}
                  className={`history-row history-row--${kind}${noSnap ? ' history-row--nosnap' : ''}`}
                  title={title}
                  onClick={(e) => {
                    if (noSnap || (e.target as HTMLElement).closest('button')) return
                    onPreview(previewing ? null : en.id)
                  }}>
                  <span className="history-row__dot" aria-hidden="true" />
                  <div className="history-row__main">
                    <div className="history-row__top">
                      <span className="history-row__label">{historyLabel(en.label, t)}</span>
                      <time className="history-row__time" dateTime={new Date(en.ts).toISOString()} title={fmt.format(new Date(en.ts))}>
                        {timeFmt.format(new Date(en.ts))}
                      </time>
                    </div>
                    <div className="history-row__meta">
                      <span>{t('history.by', { actor: en.actor })}</span>
                      {others.length > 0 && <span> · {t('history.with', { names: others.join(', ') })}</span>}
                    </div>
                    {confirmId === en.id ? (
                      <div className="history-row__confirm">
                        <span>{t('history.restoreQ')}</span>
                        <div className="history-row__actions">
                          <button type="button" className="history-btn history-btn--primary" onClick={() => { setConfirmId(null); onRestore(en.id) }}>{t('history.restore')}</button>
                          <button type="button" className="history-btn" onClick={() => setConfirmId(null)}>{t('history.cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="history-row__actions">
                        <button type="button" className="history-btn" disabled={noSnap} title={title} aria-pressed={previewing}
                          onClick={() => onPreview(previewing ? null : en.id)}>
                          {previewing ? t('history.exitPreview') : t('history.preview')}
                        </button>
                        <button type="button" className="history-btn" disabled={noSnap} title={title} onClick={() => setConfirmId(en.id)}>
                          {t('history.restore')}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              </Fragment>
            )
          })}
        </ul>
      )}
      {sorted.length > limit && (
        <button type="button" className="history-more history-btn" onClick={() => setLimit((n) => n + PAGE)}>
          {t('history.more')}
        </button>
      )}
      </div>
    </aside>
  )
}
