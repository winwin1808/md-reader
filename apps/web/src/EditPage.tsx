import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { API_PATHS, computeTextChanges, trackLocalActor, type ResolveTokenResponse, type UploadAssetResponse } from '@md-reader/core'
import { FormattingToolbar, PresenceBar, usePeers, Viewer, applyFormat, Logo, useResolvedTheme } from '@md-reader/ui'
import type { EditorView, FormatAction } from '@md-reader/ui'
import { bindRoom, type SyncStatus } from './collab'
import { renderShareHtml } from './share-client'

export async function uploadImage(serverUrl: string, room: string, token: string, file: File): Promise<UploadAssetResponse> {
  let res: Response
  try {
    res = await fetch(serverUrl.replace(/\/+$/, '') + API_PATHS.assets(room), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': file.type },
      body: file,
    })
  } catch {
    throw new Error('Không tải được ảnh lên máy chủ.')
  }
  if (res.status === 413) {
    let code = ''
    try { code = ((await res.json()) as { error?: string }).error ?? '' } catch { /* ignore */ }
    throw new Error(code === 'quota' ? 'Tài liệu đã dùng hết 50 MB ảnh.' : 'Ảnh quá 2 MB.')
  }
  if (!res.ok) throw new Error('Không tải được ảnh lên máy chủ.')
  return (await res.json()) as UploadAssetResponse
}

const Editor = lazy(() => import('@md-reader/ui/editor').then((m) => ({ default: m.Editor })))

export function firstH1(text: string): string {
  const m = /^#[ \t]+(.+?)[ \t#]*$/m.exec(text.replace(/^---\n[\s\S]*?\n---\n/, ''))
  return m?.[1]?.trim() || 'Tài liệu được chia sẻ'
}

export function PageHeader(props: {
  title: string
  status?: string
  presence?: React.ReactNode
  toggle?: { value: 'edit' | 'view'; onChange: (v: 'edit' | 'view') => void }
}): React.JSX.Element {
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
          <div role="radiogroup" aria-label="Chế độ" className="web-toggle">
            {(['edit', 'view'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={props.toggle!.value === v}
                title={v === 'edit' ? 'Sửa trên trang' : 'Xem'}
                className={props.toggle!.value === v ? 'is-active' : ''}
                onClick={() => props.toggle!.onChange(v)}
              >
                {v === 'edit' ? 'Sửa' : 'Xem'}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

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
      <div className="web-notice">
        <form onSubmit={submit} className="web-card">
          <label>
            Tên của bạn
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} required />
          </label>
          <p className="web-hint">Người khác sẽ thấy tên này cạnh con trỏ của bạn.</p>
          <button type="submit">Bắt đầu sửa</button>
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
  const [html, setHtml] = useState('')
  const [, setTick] = useState(0)
  const [mode, setMode] = useState<'edit' | 'view'>('edit')
  const resolved = useResolvedTheme()
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
      <div className="web-notice">
        <p role="alert">Không kết nối được phòng sửa. Link có thể đã bị thu hồi hoặc máy chủ không phản hồi.</p>
        <button type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
      </div>
    )
  }
  if (!wasOnline || !session) return <div className="web-notice"><p role="status">Đang tải tài liệu…</p></div>

  return (
    <div className="web-page">
      <PageHeader
        title={info.title ?? firstH1(session.yText.toString())}
        status={STATUS_TEXT[status]}
        presence={<PresenceBar peers={peers} />}
        toggle={{ value: mode, onChange: setMode }}
      />
      {mode === 'edit' ? (
        <>
          <FormattingToolbar
            onAction={onAction}
            canUndo={session.undo.undoStack.length > 0}
            canRedo={session.undo.redoStack.length > 0}
            onUndo={() => session.undo.undo()}
            onRedo={() => session.undo.redo()}
          />
          <div className="web-sheet web-sheet-edit">
            <Suspense fallback={<div aria-busy="true" />}>
              <Editor
                variant="live"
                live={{ theme: () => (resolved === 'dark' ? 'dark' : 'default') }}
                yText={session.yText}
                undoManager={session.undo}
                awareness={session.conn.awareness}
                editorViewRef={editorViewRef}
                saveImage={async (file) => ({ src: (await uploadImage(serverUrl ?? location.origin, info.roomId, token, file)).url })}
                onImageMessage={(m) => window.alert(m)}
              />
            </Suspense>
          </div>
        </>
      ) : (
        <div className="web-sheet">
          <Viewer html={html} isAppPage={false} />
        </div>
      )}
    </div>
  )
}
