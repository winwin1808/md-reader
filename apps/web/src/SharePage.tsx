import { useCallback, useEffect, useMemo, useState } from 'react'
import { Viewer } from '@md-reader/ui'
import { EditPage, PageHeader, firstH1 } from './EditPage'
import { loadShare, renderShareHtml, type ShareState } from './share-client'

const REPO = 'https://github.com/winwin1808/md-reader'

export function SharePage(props: { token: string | null; load?: typeof loadShare; mermaid?: boolean }): React.JSX.Element {
  const { token, load = loadShare, mermaid = true } = props
  const [state, setState] = useState<ShareState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setState({ kind: 'loading' })
    load(token)
      .then((s) => { if (!cancelled) setState(s) })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Lỗi không xác định' }) })
    return () => { cancelled = true }
  }, [token, load, attempt])

  useEffect(() => {
    if (state.kind === 'ready') document.title = state.info.title ?? 'MD Reader'
  }, [state])

  const html = useMemo(() => (state.kind === 'ready' && state.info.role !== 'edit' ? renderShareHtml(state.text) : ''), [state])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  let body: React.JSX.Element
  if (!token) body = <div className="web-notice"><p>Không tìm thấy trang</p></div>
  else if (state.kind === 'loading') body = <div className="web-notice"><p>Đang tải…</p></div>
  else if (state.kind === 'gone') body = <div className="web-notice"><p>Link này không còn hiệu lực</p></div>
  else if (state.kind === 'error') {
    body = (
      <div className="web-notice">
        <p>{state.message}</p>
        <button type="button" onClick={retry}>Thử lại</button>
      </div>
    )
  } else if (state.info.role === 'edit') body = <EditPage token={token} info={state.info} />
  else body = <div className="web-sheet"><Viewer html={html} isAppPage mermaid={mermaid} /></div>

  const isView = state.kind === 'ready' && state.info.role !== 'edit'
  return (
    <main className="web-page">
      {isView && state.kind === 'ready' && <PageHeader title={state.info.title ?? firstH1(state.text)} status="Đã đồng bộ" />}
      {body}
      <footer className="web-footer">
        <a href={REPO} target="_blank" rel="noopener noreferrer">Xem bằng MD Reader</a>
      </footer>
    </main>
  )
}
