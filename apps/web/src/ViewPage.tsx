import { useEffect, useMemo, useRef, useState } from 'react'
import type * as Y from 'yjs'
import type { ResolveTokenResponse } from '@md-reader/core'
import { onMathLoaded } from '@md-reader/core/plugins'
import { CommentLayer, CommentsPanel, Viewer, useComments, useLocale, useT } from '@md-reader/ui'
import { bindRoom, type SyncStatus } from './collab'
import { PageHeader, firstH1 } from './EditPage'
import { readName, writeName } from './name'
import { renderShareHtml } from './share-client'
import { NoticeStack, useNotices } from './Notice'

export function ViewPage(props: {
  token: string
  info: ResolveTokenResponse
  doc: Y.Doc
  serverUrl?: string
  bind?: typeof bindRoom
  mermaid?: boolean
  rejected: boolean
  onRejected: () => void
}): React.JSX.Element {
  const { token, info, doc, serverUrl, bind, mermaid = true, rejected, onRejected } = props
  const t = useT()
  const locale = useLocale()
  const { items, push, dismiss } = useNotices()
  const [name, setName] = useState<string>(() => readName())
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState<HTMLElement | null>(null)
  const [view, setView] = useState(() => {
    const src = doc.getText('source').toString()
    return { html: renderShareHtml(src, locale, { sourcePositions: true }), source: src }
  })
  const [mathRev, setMathRev] = useState(0)

  const nameRef = useRef(name)
  nameRef.current = name
  const tRef = useRef(t)
  tRef.current = t
  const onRejectedRef = useRef(onRejected)
  onRejectedRef.current = onRejected

  useEffect(() => {
    setStatus('connecting')
    let fired = false
    let conn: ReturnType<typeof bindRoom> | null = null
    conn = (bind ?? bindRoom)(doc, {
      serverUrl: serverUrl ?? location.origin,
      roomId: info.roomId,
      token,
      name: nameRef.current || tRef.current('web.guest'),
      onReject: () => {
        if (fired) return
        fired = true
        conn?.destroy()
        onRejectedRef.current()
      },
    })
    const off = conn.status$(setStatus)
    const c0 = conn
    return () => {
      off()
      c0.destroy()
    }
  }, [doc, token, info.roomId, serverUrl, bind])

  useEffect(() => onMathLoaded(() => setMathRev((n) => n + 1)), [])

  useEffect(() => {
    const yText = doc.getText('source')
    const render = () => {
      const src = yText.toString()
      setView({ html: renderShareHtml(src, locale, { sourcePositions: true }), source: src })
    }
    render()
    let timer: ReturnType<typeof setTimeout> | null = null
    const onChange = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(render, 120)
    }
    yText.observe(onChange)
    return () => {
      if (timer) clearTimeout(timer)
      yText.unobserve(onChange)
    }
  }, [doc, locale, mathRev])

  const c = useComments(doc, name || t('web.guest'), { canModerate: false, canResolveAll: false, matchActorName: false })
  const locked = status === 'full' || status === 'revoked' || rejected
  const source = view.source
  const title = useMemo(() => info.title ?? firstH1(source, t), [info.title, source, t])

  const actions = (
    <button
      type="button"
      className="web-comments-toggle"
      disabled={locked}
      title={rejected ? t('web.commentsRejected') : locked ? t('web.commentsFull') : undefined}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      {`${t('comments.title')} (${c.openCount})`}
    </button>
  )

  return (
    <>
      <PageHeader title={title} status={t('web.statusOnline')} actions={actions} />
      <div className="web-sheet" ref={setSheet}>
        <Viewer html={view.html} isAppPage mermaid={mermaid} />
      </div>
      <CommentLayer
        container={sheet}
        source={source}
        threads={c.threads}
        activeId={c.activeId}
        enabled={!locked}
        askName={!name}
        onSelect={(id) => { c.setActive(id); setOpen(true) }}
        onCreate={(range, body, author) => {
          if (author) {
            writeName(author)
            setName(author)
          }
          const id = c.create(range, body, author)
          if (id === null) push('error', t('web.commentRangeChanged'))
          else setOpen(true)
        }}
      />
      {open && (
        <aside className="web-comments-drawer">
          <CommentsPanel
            threads={c.threads}
            me={c.me}
            activeId={c.activeId}
            onSelect={c.setActive}
            onReply={rejected ? () => {} : c.reply}
            onResolve={rejected ? () => {} : c.resolve}
            onDelete={c.remove}
            onClose={() => setOpen(false)}
          />
        </aside>
      )}
      {items.length > 0 && <NoticeStack items={items} onDismiss={dismiss} />}
    </>
  )
}
