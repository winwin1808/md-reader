import { describe, it, expect, vi, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { pasteImages, toDataUrl } from './paste-images'

Range.prototype.getClientRects = (() => []) as any
Range.prototype.getBoundingClientRect = (() => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 })) as any
function mk(save: any, opts?: any) {
  const view = new EditorView({
    state: EditorState.create({ doc: 'hi ', extensions: [pasteImages(save, opts)] }),
    parent: document.body,
  })
  view.dispatch({ selection: { anchor: 3 } })
  return view
}
function pasteEvent(files: File[]) {
  const e = new Event('paste', { bubbles: true, cancelable: true }) as any
  e.clipboardData = { getData: () => '', files, items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })) }
  return e
}
const tick = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => vi.unstubAllGlobals())

describe('pasteImages', () => {
  it('inserts final markdown on success', async () => {
    const view = mk(async () => ({ src: 'blob:x' }))
    view.contentDOM.dispatchEvent(pasteEvent([new File(['a'], 'pic.png', { type: 'image/png' })]))
    expect(view.state.doc.toString()).toContain('![Đang tải ảnh…]()')
    await tick(); await tick()
    expect(view.state.doc.toString()).toBe('hi ![pic](blob:x)')
  })
  it('removes placeholder and reports on failure', async () => {
    const onError = vi.fn()
    const view = mk(async () => { throw new Error('boom') }, { onError })
    view.contentDOM.dispatchEvent(pasteEvent([new File(['a'], 'pic.png', { type: 'image/png' })]))
    await tick(); await tick()
    expect(view.state.doc.toString()).toBe('hi ')
    expect(onError).toHaveBeenCalledWith('boom')
  })
  it('ignores non-image paste', () => {
    const save = vi.fn()
    const view = mk(save)
    const e = pasteEvent([new File(['a'], 'a.txt', { type: 'text/plain' })])
    view.contentDOM.dispatchEvent(e)
    expect(save).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe('hi ')
  })
})

describe('toDataUrl', () => {
  it('small blob -> data url', async () => {
    const url = await toDataUrl(new File(['abc'], 'a.png', { type: 'image/png' }))
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })
  it('downscales then throws after 4 tries', async () => {
    const sizes: number[] = []
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1000, height: 800, close() {} }))
    class OC {
      constructor(public width: number, public height: number) { sizes.push(width) }
      getContext() { return { drawImage() {} } }
      async convertToBlob() { return new Blob([new Uint8Array(5000)], { type: 'image/jpeg' }) }
    }
    vi.stubGlobal('OffscreenCanvas', OC)
    const big = new File([new Uint8Array(5000)], 'b.png', { type: 'image/png' })
    await expect(toDataUrl(big, 100)).rejects.toThrow('Ảnh quá lớn')
    expect(sizes).toEqual([500, 250, 125, 62])
  })
})
