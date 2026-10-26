import type { TFunction } from '@md-reader/ui'

export const INSTALL_KEY_STORAGE = 'mdr.installKey'

type Store = { get(k: string): Promise<Record<string, unknown>>; set(v: Record<string, unknown>): Promise<void> }

export function newInstallKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cached: Promise<string> | null = null

export function __resetInstallKeyCache(): void { cached = null }

export function getInstallKey(store?: Store): Promise<string> {
  if (cached) return cached
  const p = (async () => {
    const s: Store | undefined = store ?? (typeof chrome !== 'undefined' ? (chrome.storage?.local as unknown as Store | undefined) : undefined)
    if (!s) return newInstallKey() // no extension storage (tests / non-extension page): ephemeral key
    const got = await s.get(INSTALL_KEY_STORAGE)
    const v = got[INSTALL_KEY_STORAGE]
    if (typeof v === 'string' && v.length >= 16 && v.length <= 200) return v
    const k = newInstallKey()
    await s.set({ [INSTALL_KEY_STORAGE]: k })
    return k
  })()
  cached = p
  p.catch(() => { if (cached === p) cached = null })
  return p
}

export function limitMessage(t: TFunction, status: number, body: unknown, _now?: number): string | null {
  if (status !== 429) return null
  const b = (typeof body === 'object' && body !== null ? body : {}) as { error?: unknown; retryAfter?: unknown }
  if (b.error === 'QUOTA_EXCEEDED') return t('ext.limit.quota')
  if (typeof b.retryAfter === 'number' && b.retryAfter > 0) {
    return t('ext.limit.rate', { hours: Math.max(1, Math.ceil(b.retryAfter / 3600)) })
  }
  return t('ext.limit.rateSoon')
}
