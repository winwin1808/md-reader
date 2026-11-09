import { DEFAULT_SERVER_URL } from '../shared/collab'

// Khai lại tương ứng apps/api/src/feedback.ts (không import apps/api).
export interface FeedbackInput {
  kind: 'uninstall' | 'bug' | 'idea'
  reason: 'not_needed' | 'missing_feature' | 'bugs' | 'hard_to_use' | 'privacy' | 'switched' | 'other' | null
  message: string
  email: string | null
  version: string | null
  browser: string | null
  locale: 'vi' | 'en' | null
}

export const FEEDBACK_EMAIL = 'qhao.work@gmail.com'
export const HELP_URL = 'https://winwin1808.github.io/md-reader/'
export const PRIVACY_URL = 'https://winwin1808.github.io/md-reader/privacy.html'

interface NavLike {
  userAgent?: string
  userAgentData?: { brands?: { brand: string; version: string }[] }
}

export function browserLabel(nav?: NavLike): string {
  const brands = nav?.userAgentData?.brands ?? []
  const pick = (name: string, short: string): string | null => {
    const b = brands.find((x) => x.brand === name)
    return b ? `${short} ${b.version.split('.')[0]}` : null
  }
  const fromBrands =
    pick('Microsoft Edge', 'Edge') ?? pick('Google Chrome', 'Chrome') ?? pick('Chromium', 'Chromium')
  if (fromBrands) return fromBrands
  const ua = nav?.userAgent ?? ''
  let m = /Edg\/(\d+)/.exec(ua)
  if (m) return `Edge ${m[1]}`
  m = /Firefox\/(\d+)/.exec(ua)
  if (m) return `Firefox ${m[1]}`
  m = /Chrome\/(\d+)/.exec(ua)
  if (m) return `Chrome ${m[1]}`
  return 'unknown'
}

export function diagnostics(): { version: string; browser: string; locale: string } {
  const version = chrome.runtime?.getManifest?.().version ?? 'unknown'
  const browser = browserLabel(typeof navigator !== 'undefined' ? (navigator as NavLike) : undefined)
  const lang = chrome.i18n?.getUILanguage?.() ?? ''
  return { version, browser, locale: lang.startsWith('vi') ? 'vi' : 'en' }
}

export async function sendFeedback(
  input: FeedbackInput,
  fetchImpl: typeof fetch = fetch,
  base: string = DEFAULT_SERVER_URL,
): Promise<'sent' | 'failed'> {
  const b = (base ?? '').replace(/\/+$/, '')
  if (!b) return 'failed'
  try {
    const res = await fetchImpl(b + '/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ ...input, website: '' }),
    })
    return res.status === 204 || res.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

type Diag = { version: string; browser: string; locale: string }
type Draft = { kind: 'bug' | 'idea'; message: string; email: string }

export function feedbackMailto(d: Draft, diag: Diag): string {
  const subject = encodeURIComponent(`MD Reader feedback (${d.kind})`)
  const body = encodeURIComponent(
    `${d.message}\n\n---\nVersion: ${diag.version} · Browser: ${diag.browser} · Language: ${diag.locale}`,
  )
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
}

export function toFeedbackInput(d: Draft, diag: Diag): FeedbackInput {
  return {
    kind: d.kind,
    reason: null,
    message: d.message,
    email: d.email.trim() || null,
    version: diag.version,
    browser: diag.browser,
    locale: diag.locale === 'vi' ? 'vi' : 'en',
  }
}
