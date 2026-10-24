import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import * as Y from 'yjs'
import { createDoc } from '@md-reader/core'
import { EditorView } from '@codemirror/view'
import { EditPage } from './EditPage'
import type { SyncStatus, BindRoomOptions } from './collab'

const info = { roomId: 'room-1', role: 'edit' as const, title: 'T' }

beforeAll(async () => { await import('@md-reader/ui/editor') }, 30000)
const TOKEN = 'abcdefghijklmnop1234'

function makeAwareness() {
  const states = new Map<number, Record<string, unknown>>([[1, { user: { name: 'Binh' } }]])
  const hs = new Set<(c?: unknown) => void>()
  return {
    clientID: 1,
    getStates: () => states,
    on: (_e: 'change', cb: (c?: unknown) => void) => { hs.add(cb) },
    off: (_e: 'change', cb: (c?: unknown) => void) => { hs.delete(cb) },
    setLocalStateField: () => {},
    getLocalState: () => ({}),
    states,
    emit: () => { for (const h of [...hs]) h({ added: [], updated: [], removed: [] }) },
  }
}

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
      awareness: makeAwareness() as never,
      status$(c: (s: SyncStatus) => void) { cbs[idx] = c; c('connecting'); return () => { cbs[idx] = null } },
      destroy,
    }
  })
  return {
    bind, calls,
    get destroy() { return calls[0]!.destroy },
    emitAt: (i: number, s: SyncStatus) => act(() => { cbs[i]?.(s) }),
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
    try {
      const m = makeBind()
      render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
      expect(screen.getByText('Tên của bạn')).toBeTruthy()
    } finally {
      spy.mockRestore()
    }
  })
  it('localStorage.setItem throwing on submit still binds with the name', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    try {
      const m = makeBind()
      render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
      fireEvent.change(screen.getByLabelText('Tên của bạn'), { target: { value: 'Lan' } })
      fireEvent.click(screen.getByText('Bắt đầu sửa'))
      expect(m.calls[0]!.opts).toMatchObject({ name: 'Lan' })
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })
  it('StrictMode: editor works on the last bind; stale offline callbacks are ignored', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<React.StrictMode><EditPage token={TOKEN} info={info} bind={m.bind as never} /></React.StrictMode>)
    expect(m.calls.length).toBeGreaterThanOrEqual(2)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    const last = m.calls[m.calls.length - 1]!
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    expect(view).toBeTruthy()
    act(() => { view.dispatch({ changes: { from: 0, insert: 'strict' } }) })
    expect(last.doc.getText('source').toString()).toContain('strict')
    act(() => { fireEvent.click(screen.getByTitle('Hoàn tác (⌘Z)')) })
    expect(last.doc.getText('source').toString()).not.toContain('strict')
    for (let i = 0; i < m.calls.length - 1; i++) m.emitAt(i, 'offline')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('.cm-editor')).toBeTruthy()
  })
  it('toolbar bold edits the Y.Text and undo reverts', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    const yText = m.calls[0]!.doc.getText('source')
    act(() => { m.calls[0]!.doc.transact(() => yText.insert(0, 'hello'), 'remote') })
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
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
  it('renders a presence avatar per peer from awareness', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    const aw = m.calls.length ? (m.bind.mock.results[0]!.value.awareness as ReturnType<typeof makeAwareness>) : null
    act(() => { aw!.states.set(2, { user: { name: 'Lan' } }); aw!.emit() })
    expect(container.querySelectorAll('.presence-avatar').length).toBe(2)
  })
  const syncRoom = (doc: Y.Doc) => act(() => { Y.applyUpdate(doc, Y.encodeStateAsUpdate(createDoc())) })
  const actorsOf = (doc: Y.Doc) => JSON.stringify((doc.getMap('meta').get('actors') as Y.Map<unknown> | undefined)?.toJSON() ?? null)
  it('a local edit after room sync registers the stored name as actor', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    const doc = m.calls[0]!.doc
    syncRoom(doc)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    act(() => { view.dispatch({ changes: { from: 0, insert: 'abc' } }) })
    expect(actorsOf(doc)).toContain('Binh')
    expect(actorsOf(doc)).toContain(String(doc.clientID))
  })
  it('a joiner editing before the room sync still gets registered once it arrives', async () => {
    localStorage.setItem('mdr.displayName', 'Binh')
    const m = makeBind()
    const { container } = render(<EditPage token={TOKEN} info={info} bind={m.bind as never} />)
    m.emit('online')
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    const doc = m.calls[0]!.doc
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    act(() => { view.dispatch({ changes: { from: 0, insert: 'abc' } }) })
    expect(doc.getMap('meta').get('actors')).toBeUndefined()
    syncRoom(doc)
    expect(actorsOf(doc)).toContain('Binh')
    expect(actorsOf(doc)).toContain(String(doc.clientID))
  })
})
