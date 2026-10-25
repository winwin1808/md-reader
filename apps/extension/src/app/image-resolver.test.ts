import { describe, it, expect, vi, afterEach } from 'vitest'
import { createImageResolver } from './image-resolver'

afterEach(() => vi.unstubAllGlobals())

describe('createImageResolver', () => {
  it('resolves against an http base', async () => {
    const r = createImageResolver({ url: 'http://h.test/a/b/doc.md' })
    expect(await r('./pic.png')).toBe('http://h.test/a/b/pic.png')
    expect(await r('../x.png')).toBe('http://h.test/a/x.png')
  })

  it('returns src unchanged without an origin', async () => {
    expect(await createImageResolver({})('pic.png')).toBe('pic.png')
  })

  it('file:// uses fetch, returns a cached blob: url, revokes on dispose', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }))
    vi.stubGlobal('fetch', fetchMock)
    const create = vi.fn(() => 'blob:abc')
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const r = createImageResolver({ url: 'file:///d/doc.md' })
    expect(await r('pic.png')).toBe('blob:abc')
    expect(await r('pic.png')).toBe('blob:abc')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('file:///d/pic.png')
    r.dispose()
    expect(revoke).toHaveBeenCalledWith('blob:abc')
  })

  it('dirHandle walks segments and refuses escaping the dir', async () => {
    const file = { getFile: async () => new Blob(['x']) }
    const sub = { getFileHandle: vi.fn(async () => file) }
    const root = {
      getDirectoryHandle: vi.fn(async () => sub),
      getFileHandle: vi.fn(async () => file),
    } as unknown as FileSystemDirectoryHandle
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:d', revokeObjectURL: () => {} }))
    const r = createImageResolver({ dirHandle: root })
    expect(await r('img/p.png')).toBe('blob:d')
    expect(await r('./p.png')).toBe('blob:d')
    await expect(r('../x.png')).rejects.toThrow()
    await expect(r('a/../../x.png')).rejects.toThrow()
  })
})
