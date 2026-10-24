export const MD_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mdx'] as const

const GH_HOSTS = ['github.com', 'www.github.com']
const GH_BLOB = /^\/[^/]+\/[^/]+\/blob\//

function mdPath(u: URL): boolean {
  let path = u.pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    // keep raw pathname
  }
  path = path.toLowerCase()
  return MD_EXTENSIONS.some((e) => path.endsWith('.' + e))
}

export function isGithubBlobMarkdownUrl(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  return GH_HOSTS.includes(u.hostname) && GH_BLOB.test(u.pathname) && mdPath(u)
}

export function makeCacheEntry(text: string, now = Date.now()): { text: string; ts: number } {
  return { text, ts: now }
}

export function readCacheEntry(value: unknown, now = Date.now(), maxAgeMs = 600_000): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const v = value as { text?: unknown; ts?: unknown }
    if (typeof v.text === 'string') {
      if (typeof v.ts === 'number' && now - v.ts > maxAgeMs) return null
      return v.text
    }
  }
  return null
}

export function isMarkdownUrl(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'file:') return false
  if (!mdPath(u)) return false
  if (GH_HOSTS.includes(u.hostname) && GH_BLOB.test(u.pathname)) return false
  return true
}

export function isStaleCacheEntry(value: unknown, now: number, maxAgeMs = 600_000): boolean {
  if (typeof value === 'string') return true
  if (value && typeof value === 'object') {
    const v = value as { text?: unknown; ts?: unknown }
    if (typeof v.text === 'string' && typeof v.ts === 'number') return now - v.ts > maxAgeMs
  }
  return true
}
