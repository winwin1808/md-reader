export const MD_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mdx'] as const

export function isMarkdownUrl(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'file:') return false
  let path = u.pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    // keep raw pathname
  }
  path = path.toLowerCase()
  if (!MD_EXTENSIONS.some((e) => path.endsWith('.' + e))) return false
  if (u.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/blob\//.test(u.pathname)) return false
  return true
}

export function isStaleCacheEntry(value: unknown, now: number, maxAgeMs = 600_000): boolean {
  if (typeof value === 'string') return true
  if (value && typeof value === 'object') {
    const v = value as { text?: unknown; ts?: unknown }
    if (typeof v.text === 'string' && typeof v.ts === 'number') return now - v.ts > maxAgeMs
  }
  return false
}
