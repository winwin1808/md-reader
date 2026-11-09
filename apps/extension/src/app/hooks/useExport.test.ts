// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useExport, SLIDES_READY_TIMEOUT_MS } from './useExport'

const printSlidesMock = vi.hoisted(() => vi.fn())
vi.mock('@md-reader/ui', async (orig) => ({
  ...(await orig<typeof import('@md-reader/ui')>()),
  printSlides: printSlidesMock,
}))

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

describe('useExport slides-pdf waits for slides', () => {
  afterEach(() => { vi.useRealTimers(); printSlidesMock.mockClear() })

  function setupSlides(waitSlidesReady?: (signal: AbortSignal) => Promise<void>) {
    return renderHook(() =>
      useExport({ html: '', title: 't', parseResult: {} as never, waitSlidesReady }),
    )
  }

  it('prints only after waitSlidesReady resolves, with isPrintingSlides true before', async () => {
    let resolve!: () => void
    let printingAtCall: boolean | null = null
    let hookRef: { current: { isPrintingSlides: boolean } } | null = null
    const wait = vi.fn(() => {
      printingAtCall = hookRef!.current.isPrintingSlides
      return new Promise<void>((r) => { resolve = r })
    })
    const { result } = setupSlides(wait)
    hookRef = result
    let p!: Promise<void>
    const { act } = await import('@testing-library/react')
    await act(async () => { p = result.current.exportAs('slides-pdf') })
    expect(wait).toHaveBeenCalled()
    expect(printingAtCall).toBe(true)
    expect(printSlidesMock).not.toHaveBeenCalled()
    await act(async () => { resolve(); await p })
    expect(printSlidesMock).toHaveBeenCalledTimes(1)
  })

  it('prints after 5000ms when waitSlidesReady never resolves', async () => {
    vi.useFakeTimers()
    const { result } = setupSlides(() => new Promise<void>(() => {}))
    const p = result.current.exportAs('slides-pdf')
    await vi.advanceTimersByTimeAsync(SLIDES_READY_TIMEOUT_MS - 1)
    expect(printSlidesMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(printSlidesMock).toHaveBeenCalledTimes(1)
  })

  it('waits 7000ms (not 5000ms), aborts the signal and warns on timeout', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let sig!: AbortSignal
    const { result } = setupSlides((s) => { sig = s; return new Promise<void>(() => {}) })
    const p = result.current.exportAs('slides-pdf')
    await vi.advanceTimersByTimeAsync(5000)
    expect(printSlidesMock).not.toHaveBeenCalled()
    expect(sig.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    await p
    expect(printSlidesMock).toHaveBeenCalledTimes(1)
    expect(sig.aborted).toBe(true)
    expect(warn).toHaveBeenCalledWith('[md-reader] slides not ready, printing as-is')
    warn.mockRestore()
  })

  it('does not abort the signal when waitSlidesReady resolves in time', async () => {
    let sig!: AbortSignal
    const { result } = setupSlides(async (s) => { sig = s })
    await result.current.exportAs('slides-pdf')
    expect(sig.aborted).toBe(false)
    expect(printSlidesMock).toHaveBeenCalledTimes(1)
  })

  it('still prints when waitSlidesReady rejects', async () => {
    const { result } = setupSlides(() => Promise.reject(new Error('x')))
    await result.current.exportAs('slides-pdf')
    expect(printSlidesMock).toHaveBeenCalledTimes(1)
  })

  it('still prints without waitSlidesReady', async () => {
    const { result } = setupSlides()
    await result.current.exportAs('slides-pdf')
    expect(printSlidesMock).toHaveBeenCalledTimes(1)
  })
})
