// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useExport } from './useExport'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

function setup(resolveImage?: (s: string) => string) {
  const fetchMock = vi.fn(async () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }))
  vi.stubGlobal('fetch', fetchMock)
  let captured: Blob | null = null
  URL.createObjectURL = ((b: Blob) => { captured = b; return 'blob:dl' }) as typeof URL.createObjectURL
  URL.revokeObjectURL = () => {}
  const { result } = renderHook(() =>
    useExport({ html: '<p><img src="img/a.png" alt="a"></p>', title: 't', parseResult: {} as never, resolveImage }),
  )
  return { result, fetchMock, getBlob: () => captured as Blob | null }
}

describe('useExport html', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('embeds images via resolveImage', async () => {
    const { result, fetchMock, getBlob } = setup(() => 'blob:x')
    await result.current.exportAs('html')
    expect(fetchMock).toHaveBeenCalledWith('blob:x')
    const text = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(getBlob()!) })
    expect(text).toContain('data:image/png;base64,')
    expect(text).not.toContain('src="img/a.png"')
  })

  it('fetches original src without resolveImage', async () => {
    const { result, fetchMock } = setup()
    await result.current.exportAs('html')
    expect(fetchMock).toHaveBeenCalledWith('img/a.png')
  })
})
