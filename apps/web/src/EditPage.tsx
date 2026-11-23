import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { API_PATHS, computeTextChanges, trackLocalActor, type ResolveTokenResponse, type UploadAssetResponse } from '@md-reader/core'
import { CommentComposer, CommentLayer, CommentsPanel, useComments, FormattingToolbar, PresenceBar, usePeers, Viewer, applyFormat, Logo, useResolvedTheme, useT, useLocale, createT } from '@md-reader/ui'
import type { TFunction } from '@md-reader/ui'
import type { EditorCommentsConfig, EditorView, FormatAction } from '@md-reader/ui'
import { bindRoom, type SyncStatus } from './collab'
import { renderShareHtml } from './share-client'
import { readName, writeName } from './name'
import { NoticeStack, useNotices } from './Notice'

export async function uploadImage(serverUrl: string, room: string, token: string, file: File, t: TFunction = createT('vi')): Promise<UploadAssetResponse> {
  let res: Response
  try {
    res = await fetch(serverUrl.replace(/\/+$/, '') + API_PATHS.assets(room), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': file.type },
      body: file,
    })
  } catch {
    throw new Error(t('web.errUpload'))
  }
  if (res.status === 413) {
    let code = ''
    try { code = ((await res.json()) as { error?: string }).error ?? '' } catch { /* ignore */ }
    throw new Error(code === 'quota' ? t('web.errQuota') : t('web.errTooBig'))
  }
  if (!res.ok) throw new Error(t('web.errUpload'))
  return (await res.json()) as UploadAssetResponse
}

const Editor = lazy(() => import('@md-reader/ui/editor').then((m) => ({ default: m.Editor })))

export function firstH1(text: string, t: TFunction = createT('vi')): string {
  const m = /^#[ \t]+(.+?)[ \t#]*$/m.exec(text.replace(/^---\n[\s\S]*?\n---\n/, ''))
  return m?.[1]?.trim() || t('web.sharedDoc')
}

export function PageHeader(props: {
  title: string
  status?: string
  presence?: React.ReactNode
  toggle?: { value: 'edit' | 'view'; onChange: (v: 'edit' | 'view') => void }
  actions?: React.ReactNode
}): React.JSX.Element {
  const t = useT()
  return (
    <header className="web-header">
      <div className="web-header-brand">
        <Logo size={24} />
        <span className="web-header-title">{props.title}</span>
      </div>
      <div className="web-header-side">
        {props.status && <span role="status" className="web-status">{props.status}</span>}
        {props.presence}
        {props.toggle && (
          <div role="radiogroup" aria-label={t('web.mode')} className="web-toggle">
            {(['edit', 'view'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={props.toggle!.value === v}
                title={v === 'edit' ? t('web.editInPage') : t('web.view')}
                className={props.toggle!.value === v ? 'is-active' : ''}
                onClick={() => props.toggle!.onChange(v)}
              >
                {v === 'edit' ? t('web.edit') : t('web.view')}
              </button>
            ))}
          </div>
        )}
        {props.actions}
      </div>
    </header>
  )
}

export interface EditPageProps {
  token: string
  info: ResolveTokenResponse
  serverUrl?: string
  bind?: typeof bindRoom
}

const STATUS_KEY = {
  off: 'web.statusOffline',
  connecting: 'web.statusConnecting',
  online: 'web.statusOnline',
  offline: 'web.statusOffline',
  revoked: 'web.statusRevoked',
  full: 'web.statusFull',
} as const satisfies Record<SyncStatus, string>

export function EditPage(props: EditPageProps): React.JSX.Element {
  const t = useT()
  const [name, setName] = useState<string>(() => readName())
  const [draft, setDraft] = useState('')

  if (!name) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const v = draft.trim()
      if (!v) return
      writeName(v)
      setName(v)
    }
    return (
      <div className="web-notice">
        <form onSubmit={submit} className="web-card">
          <label>
            {t('web.yourName')}
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} required />
          </label>
          <p className="web-hint">{t('web.nameHint')}</p>
          <button type="submit">{t('web.startEditing')}</button>
        </form>
      </div>
    )
  }
  return <EditSession {...props} name={name} />
}

function EditSession(props: EditPageProps & { name: string }): React.JSX.Element {
  const { token, info, serverUrl, bind, name } = props
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [wasOnline, setWasOnline] = useState(false)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<{ html: string; source: string }>({ html: '', source: '' })
  const html = view.html
  const [, setTick] = useState(0)
  const [mode, setMode] = useState<'edit' | 'view'>('edit')
  const resolved = useResolvedTheme()
  const { items: notices, push, dismiss } = useNotices()
  const t = useT()
  const locale = useLocale()
  const editorViewRef = useRef<EditorView | null>(null)

  const [retry, setRetry] = useState(0)
  const [session, setSession] = useState<{
    doc: Y.Doc
    yText: Y.Text
    undo: Y.UndoManager
    conn: ReturnType<typeof bindRoom>
  } | null>(null)

  const peers = usePeers(session?.conn.awareness)

  useEffect(() => {
    setStatus('connecting')
    setWasOnline(false)
    setFailed(false)
    setView({ html: '', source: '' })
    const doc = new Y.Doc({ gc: false })
    const yText = doc.getText('source')
    const undo = new Y.UndoManager(yText)
    const stopActor = trackLocalActor(doc, () => name)
    const conn = (bind ?? bindRoom)(doc, {
      serverUrl: serverUrl ?? location.origin,
      roomId: info.roomId,
      token,
      name,
    })
    let everOnline = false
    const off = conn.status$((s) => {
      setStatus(s)
      if (s === 'online') {
        everOnline = true
        setWasOnline(true)
      } else if (s === 'offline' && !everOnline) {
        setFailed(true)
      }
    })
    let timer: ReturnType<typeof setTimeout> | null = null
    const onChange = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { const src = yText.toString(); setView({ html: renderShareHtml(src, locale, { sourcePositions: true }), source: src }) }, 120)
    }
    const onStack = () => setTick((n) => n + 1)
    yText.observe(onChange)
    undo.on('stack-item-added', onStack)
    undo.on('stack-item-popped', onStack)
    { const src = yText.toString(); setView({ html: renderShareHtml(src, locale, { sourcePositions: true }), source: src }) }
    setSession({ doc, yText, undo, conn })
    return () => {
      if (timer) clearTimeout(timer)
      yText.unobserve(onChange)
      undo.off('stack-item-added', onStack)
      undo.off('stack-item-popped', onStack)
      off()
      conn.destroy()
      undo.destroy()
      stopActor()
      doc.destroy()
      setSession(null)
    }
  }, [bind, serverUrl, info.roomId, token, name, retry])

  const onAction = useCallback(
    (action: FormatAction) => {
      const view = editorViewRef.current
      if (!view || !session) return
      const { from, to } = view.state.selection.main
      const current = session.yText.toString()
      const r = applyFormat(current, from, to, action, t)
      view.dispatch({
        changes: computeTextChanges(current, r.newText).map((c) => ({
          from: c.index,
          to: c.index + c.deleteCount,
          insert: c.insert,
        })),
        selection: { anchor: r.newSelectionStart, head: r.newSelectionEnd },
        userEvent: 'input.format',
        scrollIntoView: true,
      })
      view.focus()
    },
    [session],
  )

  const c = useComments(session?.doc ?? null, name, { canModerate: false, canResolveAll: true, matchActorName: false })
  const [open, setOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<{ from: number; to: number } | null>(null)
  const [sheet, setSheet] = useState<HTMLElement | null>(null)
  const sheetRef = useCallback((el: HTMLDivElement | null) => setSheet(el), [])
  const locked = status === 'revoked' || status === 'full'

  useEffect(() => { setPendingRange(null) }, [mode, locked])

  const openThread = (id: string) => {
    c.setActive(id)
    setOpen(true)
    const view = editorViewRef.current
    const th = c.threads.find((x) => x.id === id)
    if (mode === 'edit' && view && th?.range) {
      const len = view.state.doc.length
      const from = Math.min(th.range.from, len)
      const to = Math.min(th.range.to, len)
      view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true })
    }
  }
  const openThreadRef = useRef(openThread)
  openThreadRef.current = openThread

  const editorComments = useMemo<EditorCommentsConfig>(
    () => ({
      threads: c.threads,
      activeId: c.activeId,
      onCreate: (range) => setPendingRange(range),
      onSelect: (id) => openThreadRef.current(id),
    }),
    [c.threads, c.activeId],
  )

  if (failed && !wasOnline) {
    return (
      <div className="web-notice">
        <p role="alert">{t('web.roomFailed')}</p>
        <button type="button" onClick={() => setRetry((n) => n + 1)}>{t('web.retry')}</button>
      </div>
    )
  }
  if (!wasOnline || !session) return <div className="web-notice"><p role="status">{t('web.loadingDoc')}</p></div>

  const actions = (
    <button
      type="button"
      className="web-comments-toggle"
      disabled={locked}
      title={locked ? t('web.commentsFull') : undefined}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      {`${t('comments.title')} (${c.openCount})`}
    </button>
  )

  return (
    <div className="web-page">
      <PageHeader
        title={info.title ?? firstH1(session.yText.toString(), t)}
        status={t(STATUS_KEY[status])}
        presence={<PresenceBar peers={peers} />}
        toggle={locked ? undefined : { value: mode, onChange: setMode }}
        actions={actions}
      />
      {locked && (
        <p role="alert" className="web-banner">{t(STATUS_KEY[status])}</p>
      )}
      {mode === 'edit' && !locked ? (
        <>
          <FormattingToolbar
            onAction={onAction}
            canUndo={session.undo.undoStack.length > 0}
            canRedo={session.undo.redoStack.length > 0}
            onUndo={() => session.undo.undo()}
            onRedo={() => session.undo.redo()}
          />
          <div className="web-sheet web-sheet-edit" style={{ position: 'relative' }}>
            <Suspense fallback={<div aria-busy="true" />}>
              <Editor
                variant="live"
                live={{ theme: () => (resolved === 'dark' ? 'dark' : 'default') }}
                yText={session.yText}
                undoManager={session.undo}
                awareness={session.conn.awareness}
                editorViewRef={editorViewRef}
                saveImage={async (file) => ({ src: (await uploadImage(serverUrl ?? location.origin, info.roomId, token, file, t)).url })}
                onImageMessage={(m) => push('error', m)}
                comments={editorComments}
              />
            </Suspense>
            {pendingRange && (
              <div className="web-comment-composer">
                <CommentComposer
                  askName={false}
                  onCancel={() => setPendingRange(null)}
                  onSubmit={(body) => {
                    const id = c.create(pendingRange, body)
                    if (id === null) push('error', t('web.commentRangeChanged'))
                    else {
                      setPendingRange(null)
                      setOpen(true)
                    }
                  }}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="web-sheet" ref={sheetRef}>
            <Viewer html={html} isAppPage={false} />
          </div>
          <CommentLayer
            container={sheet}
            source={view.source}
            threads={c.threads}
            activeId={c.activeId}
            enabled={!locked}
            askName={false}
            onSelect={openThread}
            onCreate={(range, body) => {
              const id = c.create(range, body)
              if (id === null) push('error', t('web.commentRangeChanged'))
              else setOpen(true)
            }}
          />
        </>
      )}
      {open && (
        <aside className="web-comments-drawer">
          <CommentsPanel
            threads={c.threads}
            me={c.me}
            activeId={c.activeId}
            onSelect={openThread}
            onReply={c.reply}
            onResolve={c.resolve}
            onDelete={c.remove}
            onClose={() => setOpen(false)}
          />
        </aside>
      )}
      {notices.length > 0 && <NoticeStack items={notices} onDismiss={dismiss} />}
    </div>
  )
}
