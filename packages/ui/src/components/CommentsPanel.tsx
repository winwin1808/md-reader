import { useState } from 'react'
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
    </article>
  )

  return (
    <aside className="comments-panel" aria-label={t('comments.title')}>
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
      <div className="comments-panel__body">
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
