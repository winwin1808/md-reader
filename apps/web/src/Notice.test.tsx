import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import { NoticeStack, useNotices } from './Notice'

let api: ReturnType<typeof useNotices>
function Host(): React.JSX.Element {
  api = useNotices()
  return <NoticeStack items={api.items} onDismiss={api.dismiss} />
}

describe('Notice', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('info tự ẩn sau 5000 ms', () => {
    vi.useFakeTimers()
    render(<Host />)
    act(() => api.push('info', 'xin chào'))
    expect(screen.getByText('xin chào')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText('xin chào')).toBeNull()
  })

  it('error giữ tới khi bấm ×', () => {
    vi.useFakeTimers()
    render(<Host />)
    act(() => api.push('error', 'lỗi ảnh'))
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText('lỗi ảnh')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('lỗi ảnh')).toBeNull()
  })

  it('unmount huỷ timer tự đóng', () => {
    vi.useFakeTimers()
    render(<Host />)
    act(() => api.push('info', 'x'))
    expect(vi.getTimerCount()).toBe(1)
    cleanup()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('nút × có lớp riêng', () => {
    render(<Host />)
    act(() => api.push('error', 'e'))
    expect(screen.getByRole('button').className).toContain('web-notice-close')
  })

  it('EditPage không dùng window.alert', () => {
    expect(readFileSync(join(__dirname, 'EditPage.tsx'), 'utf8')).not.toContain('window.alert')
  })
})
