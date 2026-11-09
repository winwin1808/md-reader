import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogs } from '@md-reader/ui'
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

describe('chữ các bước hướng dẫn', () => {
  const T: Record<string, [string, string, string, string]> = {
    intro: ['Đây là tài liệu mẫu', 'Bấm Tiếp để xem từng nút làm gì. Mất chừng một phút.', 'This is the sample document', 'Press Next to see what each button does. It takes about a minute.'],
    'view-mode': ['Đọc và Sửa', 'Chuyển giữa đọc và sửa ngay trên trang. Khi sửa, dấu Markdown chỉ hiện ở dòng bạn đang gõ.', 'Read and Edit', "Switch between reading and editing right on the page. While editing, Markdown marks only show on the line you're typing."],
    toc: ['Mục lục', 'Mở danh sách đề mục để nhảy nhanh tới phần cần đọc.', 'Contents', 'Open the list of headings to jump to any section.'],
    search: ['Tìm trong tài liệu', 'Tìm chữ trong tài liệu. Phím tắt Cmd/Ctrl+F.', 'Find in document', 'Find text in the document. Shortcut: Cmd/Ctrl+F.'],
    present: ['Trình chiếu', 'Biến tài liệu thành slide, có cửa sổ riêng cho người trình bày. Dòng --- hoặc đề mục sẽ chia slide.', 'Present', 'Turn the document into slides, with a separate presenter window. A --- line or a heading starts a new slide.'],
    mindmap: ['Sơ đồ tư duy', 'Xem cấu trúc tài liệu dạng cây; bấm một nhánh để tới đúng chỗ.', 'Mind map', 'See the document as a tree; click a branch to jump there.'],
    export: ['Xuất', 'Lưu ra HTML, PDF hoặc Word.', 'Export', 'Save as HTML, PDF or Word.'],
    share: ['Chia sẻ', 'Tạo link xem hoặc link cùng sửa. Tài liệu chỉ rời máy khi bạn bật chia sẻ.', 'Share', 'Create a view link or an edit link. Your document only leaves this device when you turn sharing on.'],
    settings: ['Cài đặt', 'Giao diện, kết nối AI, góp ý và sao lưu trước khi gỡ đều ở đây. Hướng dẫn này cũng xem lại được từ Cài đặt → Trợ giúp.', 'Settings', 'Appearance, AI connection, feedback and backups live here. You can replay this tour from Settings → Help.'],
  }
  it.each([...TOUR_STEP_IDS])('%s đúng chữ vi/en', (id) => {
    const vi = catalogs.vi as Record<string, string>
    const en = catalogs.en as Record<string, string>
    const [vt, vb, et, eb] = T[id]!
    expect(vi[`ext.tour.${id}.title`]).toBe(vt)
    expect(vi[`ext.tour.${id}.body`]).toBe(vb)
    expect(en[`ext.tour.${id}.title`]).toBe(et)
    expect(en[`ext.tour.${id}.body`]).toBe(eb)
    expect(vi[`ext.tour.${id}.body`]).not.toBe(en[`ext.tour.${id}.title`])
  })
})
