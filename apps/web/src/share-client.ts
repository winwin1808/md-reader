import * as Y from 'yjs'
import { createT, type Locale, type TFunction } from '@md-reader/ui'
import { defaultRenderPlugins, parseYaml } from '@md-reader/core/plugins'
import {
  API_PATHS,
  exportText,
  parseMarkdown,
  renderToHtml,
  type ReportRequest,
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

export async function loadShare(token: string, fetchFn: typeof fetch = fetch, t: TFunction = createT('vi')): Promise<ShareState> {
  let res: Response
  let snap: Response
  try {
    res = await fetchFn(API_PATHS.resolve(token))
    if (res.status === 410) return { kind: 'gone' }
    if (!res.ok) return { kind: 'error', message: t('web.errServer', { status: res.status }) }
    const info = (await res.json()) as ResolveTokenResponse
    snap = await fetchFn(API_PATHS.snapshot(token))
    if (snap.status === 410) return { kind: 'gone' }
    if (!snap.ok) return { kind: 'error', message: t('web.errServer', { status: snap.status }) }
    const bytes = new Uint8Array(await snap.arrayBuffer())
    try {
      const doc = new Y.Doc({ gc: false })
      Y.applyUpdate(doc, bytes)
      return { kind: 'ready', info, text: exportText(doc) }
    } catch {
      return { kind: 'error', message: t('web.errInvalid') }
    }
  } catch {
    return { kind: 'error', message: t('web.errConnect') }
  }
}

const PLUGINS = defaultRenderPlugins()

export function renderShareHtml(text: string, locale: Locale = 'vi'): string {
  const parsed = parseMarkdown(text, { gfm: true, math: true, parseYaml })
  return renderToHtml(parsed, {
    math: true,
    githubAlerts: true,
    localizeAlerts: locale,
    stripFrontmatter: true,
    displayMetadata: true,
    typographer: true,
    externalLinks: true,
    plugins: PLUGINS,
  }).html
}

export type ReportResult = 'sent' | 'limited' | 'failed'

export async function sendReport(token: string, reason: string, fetchFn: typeof fetch = fetch): Promise<ReportResult> {
  try {
    const body: ReportRequest = { token, reason }
    const res = await fetchFn(API_PATHS.report, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 202) return 'sent'
    if (res.status === 429) return 'limited'
    return 'failed'
  } catch {
    return 'failed'
  }
}
