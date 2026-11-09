import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOUR_DONE_KEY, TOUR_STEP_IDS, tourSteps, useGuidedTour } from './tour'

let get: ReturnType<typeof vi.fn>
let set: ReturnType<typeof vi.fn>
beforeEach(() => {
  get = vi.fn().mockResolvedValue({})
  set = vi.fn().mockResolvedValue(undefined)
  ;(globalThis as any).chrome = { storage: { local: { get, set } } }
  window.history.replaceState(null, '', '/?d=x&tour=1')
})
afterEach(() => {
  delete (globalThis as any).chrome
  window.history.replaceState(null, '', '/')
})

describe('tourSteps', () => {
  it('9 bước theo thứ tự', () => {
    const s = tourSteps((k) => k)
    expect(s.map((x) => x.id)).toEqual([...TOUR_STEP_IDS])
    expect(s[0]!.target).toBeNull()
    expect(s[0]!.title).toBe('ext.tour.intro.title')
    expect(s.find((x) => x.id === 'present')!.target!.at(-1)).toBe('[data-tour="more"]')
    expect(s.find((x) => x.id === 'toc')!.target).toEqual(['[data-tour="toc"]'])
  })
})

describe('useGuidedTour', () => {
  it('mở khi có tour=1 và storage trống', async () => {
    const { result } = renderHook(() => useGuidedTour(true))
    await waitFor(() => expect(result.current.open).toBe(true))
  })
  it('không mở khi đã xong', async () => {
    get.mockResolvedValue({ [TOUR_DONE_KEY]: true })
    const { result } = renderHook(() => useGuidedTour(true))
    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(result.current.open).toBe(false)
  })
  it('không có tour=1 → không đọc storage', async () => {
    window.history.replaceState(null, '', '/?d=x')
    const { result } = renderHook(() => useGuidedTour(true))
    expect(result.current.open).toBe(false)
    expect(get).not.toHaveBeenCalled()
  })
  it('ready false → không mở', () => {
    const { result } = renderHook(() => useGuidedTour(false))
    expect(result.current.open).toBe(false)
    expect(get).not.toHaveBeenCalled()
  })
  it('onClose lưu khoá, xoá tour khỏi URL', async () => {
    const { result } = renderHook(() => useGuidedTour(true))
    await waitFor(() => expect(result.current.open).toBe(true))
    act(() => result.current.onClose('skipped'))
    expect(result.current.open).toBe(false)
    expect(set).toHaveBeenCalledWith({ 'mdr:tour-done': true })
    expect(location.search).toBe('?d=x')
  })
  it('set reject → không ném', async () => {
    set.mockRejectedValue(new Error('x'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useGuidedTour(true))
    await waitFor(() => expect(result.current.open).toBe(true))
    expect(() => act(() => result.current.onClose('done'))).not.toThrow()
    await waitFor(() => expect(warn).toHaveBeenCalled())
    warn.mockRestore()
  })
  it('start() mở dù có khoá', async () => {
    get.mockResolvedValue({ [TOUR_DONE_KEY]: true })
    const { result } = renderHook(() => useGuidedTour(true))
    act(() => result.current.start())
    expect(result.current.open).toBe(true)
  })
  it('ready false→true sau khi đóng không mở lại', async () => {
    const { result, rerender } = renderHook(({ r }) => useGuidedTour(r), { initialProps: { r: true } })
    await waitFor(() => expect(result.current.open).toBe(true))
    act(() => result.current.onClose('done'))
    rerender({ r: false })
    rerender({ r: true })
    expect(result.current.open).toBe(false)
  })
})
