import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import type * as Y from 'yjs'
import { EditPage } from './EditPage'
import type { SyncStatus, BindRoomOptions } from './collab'

const info = { roomId: 'room-1', role: 'edit' as const, title: 'T' }
const TOKEN = 'abcdefghijklmnop1234'

function makeBind() {
  const calls: Array<{ doc: Y.Doc; opts: BindRoomOptions }> = []
  const destroy = vi.fn()
  let cb: ((s: SyncStatus) => void) | null = null
  const bind = vi.fn((doc: Y.Doc, opts: BindRoomOptions) => {
    calls.push({ doc, opts })
    return {
      provider: {} as never,
      awareness: {} as never,
      status$(c: (s: SyncStatus) => void) { cb = c; c('connecting'); return () => { cb = null } },
      destroy,
    }
  })
  return { bind, calls, destroy, emit: (s: SyncStatus) => act(() => { cb?.(s) }) }
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('EditPage', () => {
  it('asks for a name first and does not bind', () => {
    const m = makeBind()
    render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    expect(screen.getByText('Tên của bạn')).toBeTruthy()
    expect(m.bind).not.toHaveBeenCalled()
  })
  it('submitting stores trimmed name and binds', () => {
    const m = makeBind()
    render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    fireEvent.change(screen.getByLabelText('Tên của bạn'), { target: { value: '  Lan ' } })
    fireEvent.click(screen.getByText('Bắt đầu sửa'))
    expect(localStorage.getItem('mdr.displayName')).toBe('Lan')
    expect(m.calls[0]!.opts).toMatchObject({ name: 'Lan', roomId: 'room-1', token: TOKEN })
  })
  it('stored name binds immediately and shows loading until online', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    expect(m.bind).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Đang tải tài liệu…')).toBeTruthy()
    expect(container.querySelector('.cm-editor')).toBeNull()
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    expect(screen.getByRole('status').textContent).toContain('Đã đồng bộ')
    expect(screen.getByRole('toolbar')).toBeTruthy()
    m.emit('offline')
    expect(container.querySelector('.cm-editor')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Ngoại tuyến')
  })
  it('preview follows the Y.Text after 120ms', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    vi.useFakeTimers()
    act(() => { m.calls[0]!.doc.getText('source').insert(0, '# Chào bạn') })
    expect(container.textContent).not.toContain('Chào bạn\u0000')
    act(() => { vi.advanceTimersByTime(130) })
    expect(container.querySelector('h1')?.textContent).toContain('Chào bạn')
  })
  it('unmount destroys the connection', () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { unmount } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    unmount()
    expect(m.destroy).toHaveBeenCalled()
  })
})
