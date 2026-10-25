import type { ImageResolver } from '@md-reader/ui'

export type DisposableImageResolver = ImageResolver & { dispose(): void }

export function createImageResolver(origin: { url?: string; dirHandle?: FileSystemDirectoryHandle }): DisposableImageResolver {
  const cache = new Map<string, Promise<string>>()
  const objectUrls: string[] = []
  const memo = (key: string, make: () => Promise<Blob>): Promise<string> => {
    let p = cache.get(key)
    if (!p) {
      p = make().then((b) => {
        const u = URL.createObjectURL(b)
        objectUrls.push(u)
        return u
      })
      p.catch(() => cache.delete(key))
      cache.set(key, p)
    }
    return p
  }
  const fromDir = async (dir: FileSystemDirectoryHandle, src: string): Promise<Blob> => {
    const clean = src.split(/[?#]/)[0] ?? ""
    let decoded = clean
    try { decoded = decodeURIComponent(clean) } catch { /* keep raw */ }
    const out: string[] = []
    for (const seg of decoded.split('/')) {
      if (seg === '' || seg === '.') continue
      if (seg === '..') {
        if (out.length === 0) throw new Error('path escapes the document folder')
        out.pop()
      } else out.push(seg)
    }
    if (out.length === 0) throw new Error('empty path')
    let cur = dir
    for (const seg of out.slice(0, -1)) cur = await cur.getDirectoryHandle(seg)
    const fh = await cur.getFileHandle(out[out.length - 1]!)
    return fh.getFile()
  }
  const resolver = ((src: string) => {
    if (origin.dirHandle) {
      const dir = origin.dirHandle
      return memo('dir:' + src, () => fromDir(dir, src))
    }
    if (origin.url && /^https?:/i.test(origin.url)) return new URL(src, origin.url).href
    if (origin.url && /^file:/i.test(origin.url)) {
      const abs = new URL(src, origin.url).href
      return memo(abs, async () => {
        const res = await fetch(abs)
        if (!res.ok) throw new Error('fetch failed')
        return res.blob()
      })
    }
    return src
  }) as DisposableImageResolver
  resolver.dispose = () => {
    for (const u of objectUrls) URL.revokeObjectURL(u)
    objectUrls.length = 0
    cache.clear()
  }
  return resolver
}
