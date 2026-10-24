import * as Y from 'yjs'
import {
  API_PATHS,
  exportText,
  parseMarkdown,
  renderToHtml,
  type ResolveTokenResponse,
} from '@md-reader/core'

export function tokenFromPath(pathname: string): string | null {
  const m = /^\/s\/([^/]+)\/?$/.exec(pathname)
  if (!m) return null
  return /^[A-Za-z0-9_-]{16,}$/.test(m[1]!) ? m[1]! : null
}

export type ShareState =
  | { kind: 'loading' }
  | { kind: 'ready'; info: ResolveTokenResponse; text: string }
  | { kind: 'gone' }
  | { kind: 'error'; message: string }

export async function loadShare(token: string, fetchFn: typeof fetch = fetch): Promise<ShareState> {
  try {
    const res = await fetchFn(API_PATHS.resolve(token))
    if (res.status === 410) return { kind: 'gone' }
    if (!res.ok) return { kind: 'error', message: `Không tải được liên kết (${res.status}).` }
    const info = (await res.json()) as ResolveTokenResponse
    const snap = await fetchFn(API_PATHS.snapshot(token))
    if (snap.status === 410) return { kind: 'gone' }
    if (!snap.ok) return { kind: 'error', message: `Không tải được nội dung (${snap.status}).` }
    const doc = new Y.Doc({ gc: false })
    Y.applyUpdate(doc, new Uint8Array(await snap.arrayBuffer()))
    return { kind: 'ready', info, text: exportText(doc) }
  } catch {
    return { kind: 'error', message: 'Lỗi mạng. Kiểm tra kết nối rồi thử lại.' }
  }
}

export function renderShareHtml(text: string): string {
  const parsed = parseMarkdown(text, { gfm: true, math: true })
  return renderToHtml(parsed, { math: true, githubAlerts: true }).html
}
