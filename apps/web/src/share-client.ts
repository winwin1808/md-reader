import * as Y from 'yjs'
import { defaultRenderPlugins, parseYaml } from '@md-reader/core/plugins'
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
  let res: Response
  let snap: Response
  try {
    res = await fetchFn(API_PATHS.resolve(token))
    if (res.status === 410) return { kind: 'gone' }
    if (!res.ok) return { kind: 'error', message: `Máy chủ trả lỗi ${res.status}` }
    const info = (await res.json()) as ResolveTokenResponse
    snap = await fetchFn(API_PATHS.snapshot(token))
    if (snap.status === 410) return { kind: 'gone' }
    if (!snap.ok) return { kind: 'error', message: `Máy chủ trả lỗi ${snap.status}` }
    const bytes = new Uint8Array(await snap.arrayBuffer())
    try {
      const doc = new Y.Doc({ gc: false })
      Y.applyUpdate(doc, bytes)
      return { kind: 'ready', info, text: exportText(doc) }
    } catch {
      return { kind: 'error', message: 'Dữ liệu chia sẻ không hợp lệ' }
    }
  } catch {
    return { kind: 'error', message: 'Không kết nối được máy chủ' }
  }
}

const PLUGINS = defaultRenderPlugins()

export function renderShareHtml(text: string): string {
  const parsed = parseMarkdown(text, { gfm: true, math: true, parseYaml })
  return renderToHtml(parsed, {
    math: true,
    githubAlerts: true,
    localizeAlerts: 'vi',
    stripFrontmatter: true,
    displayMetadata: true,
    typographer: true,
    externalLinks: true,
    plugins: PLUGINS,
  }).html
}
