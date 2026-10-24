import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import type * as Y from 'yjs'
import { EditPage } from './EditPage'
import type { SyncStatus, BindRoomOptions } from './collab'

const info = { roomId: 'room-1', role: 'edit' as const, title: 'T' }
const TOKEN = 'abcdefghijklmnop1234'

function makeBind() {
  const calls: Array<{ doc: Y.Doc; opts: BindRoomOptions; destroy: ReturnType<typeof vi.fn>; destroyed: boolean }> = []
  const cbs: Array<((s: SyncStatus) => void) | null> = []
  const bind = vi.fn((doc: Y.Doc, opts: BindRoomOptions) => {
    const idx = calls.length
    const destroy = vi.fn()
    const rec = { doc, opts, destroy, destroyed: false }
    doc.on('destroy', () => { rec.destroyed = true })
    calls.push(rec)
    return {
      provider: {} as never,
      awareness: {} as never,
      status$(c: (s: SyncStatus) => void) { cbs[idx] = c; c('connecting'); return () => { cbs[idx] = null } },
      destroy,
    }
  })
  return {
    bind, calls,
    get destroy() { return calls[0]!.destroy },
    emit: (s: SyncStatus) => act(() => { cbs[cbs.length - 1]?.(s) }),
  }
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
  it('preview follows the Y.Text only after 120ms', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    vi.useFakeTimers()
    act(() => { m.calls[0]!.doc.getText('source').insert(0, '# Chào bạn') })
    act(() => { vi.advanceTimersByTime(50) })
    expect(container.querySelector('h1')).toBeNull()
    act(() => { vi.advanceTimersByTime(80) })
    expect(container.querySelector('h1')?.textContent).toContain('Chào bạn')
  })
  it('StrictMode: last doc is alive, earlier conns destroyed', () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    render(<React.StrictMode><EditPage token={TOKEN} info={info} bind={m.bind as never} /></React.StrictMode>)
    expect(m.calls.length).toBeGreaterThanOrEqual(2)
    const last = m.calls[m.calls.length - 1]!
    expect(last.destroyed).toBe(false)
    expect(last.destroy).not.toHaveBeenCalled()
    for (const c of m.calls.slice(0, -1)) {
      expect(c.destroy).toHaveBeenCalled()
      expect(c.destroyed).toBe(true)
    }
    const yText = last.doc.getText('source')
    const seen = vi.fn()
    yText.observe(seen)
    yText.insert(0, 'x')
    expect(seen).toHaveBeenCalled()
  })
  it('unmount destroys the conn and the doc', () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { unmount } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    unmount()
    expect(m.destroy).toHaveBeenCalled()
    expect(m.calls[0]!.destroyed).toBe(true)
  })
  it('offline before online shows alert; retry rebinds with a fresh doc', () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('offline')
    expect(screen.getByRole('alert').textContent).toContain('Không kết nối được phòng sửa')
    fireEvent.click(screen.getByText('Thử lại'))
    expect(m.bind).toHaveBeenCalledTimes(2)
    expect(m.calls[1]!.doc).not.toBe(m.calls[0]!.doc)
    expect(m.calls[0]!.destroy).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('whitespace-only name keeps the form', () => {
    const m = makeBind()
    render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    fireEvent.change(screen.getByLabelText('Tên của bạn'), { target: { value: '   ' } })
    fireEvent.click(screen.getByText('Bắt đầu sửa'))
    expect(screen.getByText('Tên của bạn')).toBeTruthy()
    expect(m.bind).not.toHaveBeenCalled()
  })
  it('localStorage.getItem throwing still shows the form', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const m = makeBind()
    render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    expect(screen.getByText('Tên của bạn')).toBeTruthy()
    spy.mockRestore()
  })
  it('toolbar bold edits the Y.Text and undo reverts', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    const yText = m.calls[0]!.doc.getText('source')
    act(() => { m.calls[0]!.doc.transact(() => yText.insert(0, 'hello'), 'remote') })
    const view = (container.querySelector('.cm-content') as any).cmTile.root.view
    act(() => { view.dispatch({ selection: { anchor: 0, head: 5 } }) })
    const bold = screen.getByTitle('Đậm (⌘B)') as HTMLButtonElement
    const before = yText.toString()
    act(() => { fireEvent.click(bold) })
    expect(yText.toString()).not.toBe(before)
    expect(yText.toString()).toContain('hello')
    const undoBtn = screen.getByTitle('Hoàn tác (⌘Z)') as HTMLButtonElement
    act(() => { fireEvent.click(undoBtn) })
    expect(yText.toString()).toBe(before)
  })
})
