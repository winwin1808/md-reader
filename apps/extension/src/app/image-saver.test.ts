import { describe, it, expect, vi, afterEach } from 'vitest'
import { createImageSaver, INLINE_IMAGE_MAX_BYTES } from './image-saver'

const png = () => new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
const big = () => new File([new Uint8Array(700_000)], 'b.png', { type: 'image/png' })
afterEach(() => vi.unstubAllGlobals())

function dirStub(existing: string[] = []) {
  const written: Record<string, unknown> = {}
  const names = new Set(existing)
  const assets = {
    getFileHandle: vi.fn(async (n: string, o?: { create?: boolean }) => {
      if (!o?.create && !names.has(n)) throw new Error('nf')
      names.add(n)
      return { createWritable: async () => ({ write: async (b: unknown) => { written[n] = b }, close: async () => {} }) }
    }),
  }
  const dir = { getDirectoryHandle: vi.fn(async () => assets) } as unknown as FileSystemDirectoryHandle
  return { dir, written, names }
}

describe('createImageSaver', () => {
  it('shared uploads with bearer and returns url', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'x', url: 'https://s/api/a/x', size: 3, mime: 'image/png' }), { status: 201 }))
    vi.stubGlobal('fetch', f)
    const r = await createImageSaver({ serverUrl: 'https://s', room: 'r1', ownerToken: 'tok', docName: 'd.md' })(png())
    expect(r.src).toBe('https://s/api/a/x')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/api/rooms/r1/assets')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'content-type': 'image/png' })
  })
  it('413 too_large message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'too_large' }), { status: 413 })))
    await expect(createImageSaver({ serverUrl: 'https://s', room: 'r1', ownerToken: 't', docName: 'd' })(png())).rejects.toThrow('Ảnh quá 2 MB.')
  })
  it('quota message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'quota' }), { status: 413 })))
    await expect(createImageSaver({ serverUrl: 'https://s', room: 'r1', ownerToken: 't', docName: 'd' })(png())).rejects.toThrow('50 MB')
  })
  it('network error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('x') }))
    await expect(createImageSaver({ serverUrl: 'https://s', room: 'r1', ownerToken: 't', docName: 'd' })(png())).rejects.toThrow('Không tải được ảnh lên máy chủ.')
  })
  it('dir handle writes assets and handles collision', async () => {
    const { dir, written } = dirStub()
    const save = createImageSaver({ serverUrl: 'https://s', dirHandle: dir, docName: 'Notes.md' })
    const a = await save(png())
    expect(a.src).toMatch(/^assets\/notes-\d{8}-\d{6}\.png$/)
    expect(Object.keys(written)).toHaveLength(1)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4, 5))
    const { dir: d2 } = dirStub(['notes-20260102-030405.png'])
    const b = await createImageSaver({ serverUrl: 'https://s', dirHandle: d2, docName: 'Notes.md' })(png())
    vi.useRealTimers()
    expect(b.src).toBe('assets/notes-20260102-030405-1.png')
  })
  it('file doc without dir: requestDir granted saves to assets/', async () => {
    const { dir } = dirStub()
    const requestDir = vi.fn(async () => dir)
    const r = await createImageSaver({ serverUrl: 'https://s', docName: 'd', hasFileHandle: true, requestDir })(big())
    expect(requestDir).toHaveBeenCalledOnce()
    expect(r.src.startsWith('assets/')).toBe(true)
  })
  it('file doc without dir: declined throws', async () => {
    const save = createImageSaver({ serverUrl: 'https://s', docName: 'd', hasFileHandle: true, requestDir: async () => null })
    await expect(save(big())).rejects.toThrow('Ảnh lớn hơn 600 KB — cho phép thư mục chứa file để lưu ảnh.')
  })
  it('large URL doc throws', async () => {
    const save = createImageSaver({ serverUrl: 'https://s', docName: 'd' })
    await expect(save(big())).rejects.toThrow('Ảnh lớn hơn 600 KB — lưu tài liệu thành file (⌘S) hoặc bật chia sẻ để chèn ảnh lớn.')
  })
  it('small image inlines as data URL, no requestDir', async () => {
    const requestDir = vi.fn(async () => null)
    const r = await createImageSaver({ serverUrl: 'https://s', docName: 'd', requestDir })(png())
    expect(r.src.startsWith('data:image/png;base64,')).toBe(true)
    expect(requestDir).not.toHaveBeenCalled()
    expect(INLINE_IMAGE_MAX_BYTES).toBe(600_000)
  })
  it('shared small still uploads', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'x', url: 'https://s/api/a/x', size: 3, mime: 'image/png' }), { status: 201 }))
    vi.stubGlobal('fetch', f)
    const r = await createImageSaver({ serverUrl: 'https://s', room: 'r', ownerToken: 't', docName: 'd' })(png())
    expect(r.src).toBe('https://s/api/a/x')
  })
})
