import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { CommentThread, CommentReply } from '@md-reader/core'
import { useT, type TFunction } from '../i18n'

export interface CommentsPanelProps {
  threads: CommentThread[]
  me: { clientIds: number[]; canModerate: boolean; canResolveAll: boolean }
  activeId: string | null
  onSelect(id: string): void
  onReply(threadId: string, body: string): void
  onResolve(threadId: string, resolved: boolean): void
  onDelete(id: string): void
  onClose(): void
  now?: () => number
}

function relTime(ts: number, now: number, t: TFunction): string {
  const diff = Math.max(0, now - ts)
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('comments.justNow')
  if (min < 60) return t('comments.minutesAgo', { n: min })
  if (min < 1440) return t('comments.hoursAgo', { n: Math.floor(min / 60) })
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

function ReplyBox({ onSend, t }: { onSend(body: string): void; t: TFunction }): JSX.Element {
  const [value, setValue] = useState('')
  const send = () => {
    if (!value.trim()) return
    onSend(value)
    setValue('')
  }
  return (
    <div className="comment-thread__replybox" onClick={(e) => e.stopPropagation()}>
      <textarea
        aria-label={t('comments.reply')}
        placeholder={t('comments.replyPlaceholder')}
        maxLength={4000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
          } else if (e.key === 'Escape' && value !== '') {
            e.preventDefault()
            e.stopPropagation()
            setValue('')
          }
        }}
      />
      <button type="button" onClick={send}>{t('comments.send')}</button>
    </div>
  )
}

export function CommentsPanel(props: CommentsPanelProps): JSX.Element {
  const t = useT()
  const { threads, me, activeId, onSelect, onResolve, onDelete, onClose } = props
  const now = (props.now ?? Date.now)()
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const mine = (id: number) => me.clientIds.includes(id)
  const openN = threads.filter((x) => !x.resolved).length
  const doneN = threads.length - openN
  const filtered = threads.filter((x) => x.resolved === (tab === 'resolved'))
  const main = filtered.filter((x) => x.range !== null)
  const orphans = filtered.filter((x) => x.range === null)

  const order = [...main, ...orphans]
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!activeId) return
    const el = bodyRef.current?.querySelector(`.comment-thread[data-id="${CSS.escape(activeId)}"]`) as HTMLElement | null
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [activeId])
  const onBodyKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (order.length === 0) return
    e.preventDefault()
    const i = order.findIndex((x) => x.id === activeId)
    const next = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(order.length - 1, i + 1)) : (i < 0 ? 0 : Math.max(0, i - 1))
    const target = order[next]
    if (target && target.id !== activeId) onSelect(target.id)
  }

  const renderReply = (r: CommentReply) => (
    <div className="comment-thread__reply" key={r.id} data-id={r.id}>
      <strong>{r.author}</strong> <small>{relTime(r.ts, now, t)}</small>
      <div className="comment-thread__text">{r.body}</div>
      {(me.canModerate || mine(r.clientId)) && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(r.id) }}>{t('comments.delete')}</button>
      )}
    </div>
  )

  const renderThread = (th: CommentThread) => (
    <article
      className="comment-thread"
      key={th.id}
      data-id={th.id}
      aria-current={activeId === th.id || undefined}
      onClick={() => onSelect(th.id)}
    >
      {!th.deleted && <blockquote className="comment-thread__quote">{th.quote}</blockquote>}
      <div>
        <strong>{th.author}</strong> <small>{relTime(th.ts, now, t)}</small>
      </div>
      <div className="comment-thread__text">{th.deleted ? t('comments.deleted') : th.body}</div>
      <div className="comment-thread__actions">
        {(me.canResolveAll || mine(th.clientId)) && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onResolve(th.id, !th.resolved) }}>
            {th.resolved ? t('comments.reopen') : t('comments.resolve')}
          </button>
        )}
        {!th.deleted && (me.canModerate || mine(th.clientId)) && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(th.id) }}>{t('comments.delete')}</button>
        )}
      </div>
      {th.replies.map(renderReply)}
      {activeId === th.id && <ReplyBox t={t} onSend={(b) => props.onReply(th.id, b)} />}
    </article>
  )

  return (
    <aside
      className="comments-panel"
      aria-label={t('comments.title')}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <header className="comments-panel__head">
        <h2>{t('comments.title')}</h2>
        <button type="button" aria-label={t('comments.close')} onClick={onClose}>×</button>
        <div role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'open'} onClick={() => setTab('open')}>
            {t('comments.open', { n: openN })}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'resolved'} onClick={() => setTab('resolved')}>
            {t('comments.resolved', { n: doneN })}
          </button>
        </div>
      </header>
      <div className="comments-panel__body" ref={bodyRef} tabIndex={0} onKeyDown={onBodyKey}>
        {main.length === 0 && orphans.length === 0 && <p className="comments-panel__empty">{t('comments.empty')}</p>}
        {main.map(renderThread)}
        {orphans.length > 0 && (
          <section className="comments-orphans">
            <h3>{t('comments.orphans')}</h3>
            {orphans.map(renderThread)}
          </section>
        )}
      </div>
    </aside>
  )
}
