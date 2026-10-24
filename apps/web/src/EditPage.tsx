import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { computeTextChanges, trackLocalActor, type ResolveTokenResponse } from '@md-reader/core'
import { FormattingToolbar, PresenceBar, usePeers, SplitViewContainer, Viewer, applyFormat } from '@md-reader/ui'
import type { EditorView, FormatAction } from '@md-reader/ui'
import { bindRoom, type SyncStatus } from './collab'
import { renderShareHtml } from './share-client'

const Editor = lazy(() => import('@md-reader/ui/editor').then((m) => ({ default: m.Editor })))

const NAME_KEY = 'mdr.displayName'

export interface EditPageProps {
  token: string
  info: ResolveTokenResponse
  serverUrl?: string
  bind?: typeof bindRoom
}

function readName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  off: 'Ngoại tuyến',
  connecting: 'Đang kết nối',
  online: 'Đã đồng bộ',
  offline: 'Ngoại tuyến',
}

export function EditPage(props: EditPageProps): React.JSX.Element {
  const [name, setName] = useState<string>(() => readName())
  const [draft, setDraft] = useState('')

  if (!name) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const v = draft.trim()
      if (!v) return
      try {
        localStorage.setItem(NAME_KEY, v)
      } catch {
        /* storage may be unavailable */
      }
      setName(v)
    }
    return (
      <form onSubmit={submit}>
        <label>
          Tên của bạn
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} required />
        </label>
        <button type="submit">Bắt đầu sửa</button>
      </form>
    )
  }
  return <EditSession {...props} name={name} />
}

function EditSession(props: EditPageProps & { name: string }): React.JSX.Element {
  const { token, info, serverUrl, bind, name } = props
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [wasOnline, setWasOnline] = useState(false)
  const [failed, setFailed] = useState(false)
  const [html, setHtml] = useState('')
  const [, setTick] = useState(0)
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
    setHtml('')
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
      timer = setTimeout(() => setHtml(renderShareHtml(yText.toString())), 120)
    }
    const onStack = () => setTick((n) => n + 1)
    yText.observe(onChange)
    undo.on('stack-item-added', onStack)
    undo.on('stack-item-popped', onStack)
    setHtml(renderShareHtml(yText.toString()))
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
      const r = applyFormat(current, from, to, action)
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

  if (failed && !wasOnline) {
    return (
      <div>
        <p role="alert">Không kết nối được phòng sửa. Link có thể đã bị thu hồi hoặc máy chủ không phản hồi.</p>
        <button type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
      </div>
    )
  }
  if (!wasOnline || !session) return <p role="status">Đang tải tài liệu…</p>

  return (
    <div>
      <p role="status">{STATUS_TEXT[status]}</p>
      <PresenceBar peers={peers} />
      <FormattingToolbar
        onAction={onAction}
        canUndo={session.undo.undoStack.length > 0}
        canRedo={session.undo.redoStack.length > 0}
        onUndo={() => session.undo.undo()}
        onRedo={() => session.undo.redo()}
      />
      <SplitViewContainer
        mode="split"
        editor={
          <Suspense fallback={<div aria-busy="true" />}>
            <Editor yText={session.yText} undoManager={session.undo} awareness={session.conn.awareness} editorViewRef={editorViewRef} />
          </Suspense>
        }
        preview={<Viewer html={html} isAppPage={false} />}
      />
    </div>
  )
}
