import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as Y from 'yjs'
// Y.Text is invariant in its event type, so changed.has needs a narrow cast.
import { useFileSave } from './useFileSave'
import type { DocSession } from './useDocSession'

let disk = ''
const saveToHandle = vi.fn(async (_h: unknown, text: string) => { disk = text })
const saveFileAs = vi.fn()
vi.mock('../fs/file-system', () => ({
  saveToHandle: (h: unknown, t: string) => saveToHandle(h, t),
  saveFileAs: (...a: unknown[]) => saveFileAs(...a),
}))

const storeHandle = vi.fn(async (..._a: unknown[]) => {})
const getHandle = vi.fn(async (..._a: unknown[]): Promise<any> => null)
const listRecent = vi.fn(async (..._a: unknown[]): Promise<any[]> => [])
const createRecord = vi.fn(async (i: any) => ({ docId: 'new-1', persistenceName: 'p', hasHandle: false, ...i }))
const writeDocText = vi.fn(async (..._a: unknown[]) => 'written')
vi.mock('../doc-registry', () => ({
  storeHandle: (...a: unknown[]) => storeHandle(...a),
  getHandle: (...a: unknown[]) => getHandle(...a),
  listRecent: (...a: unknown[]) => listRecent(...a),
  createRecord: (i: unknown) => createRecord(i),
  writeDocText: (...a: unknown[]) => writeDocText(...a),
}))

function fakeHandle() {
  return {
    name: 'a.md',
    getFile: async () => ({ text: async () => disk }),
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  } as unknown as FileSystemFileHandle
}

function makeSession(doc: Y.Doc, over: Partial<DocSession> = {}): DocSession {
  const yText = doc.getText('source')
  return {
    docId: null, record: null,
    doc, yText, undoManager: new Y.UndoManager(yText),
    content: yText.toString(), title: 'a', hasContent: true,
    isDirty: false, setDirty: () => {}, error: null, setError: () => {}, synced: true,
    externalChange: null, acceptExternal: () => {}, dismissExternal: () => {},
    ...over,
  }
}

describe('useFileSave', () => {
  beforeEach(() => {
    disk = ''; saveToHandle.mockClear(); saveFileAs.mockReset()
    storeHandle.mockClear(); getHandle.mockReset(); getHandle.mockResolvedValue(null)
  })
  afterEach(() => { vi.useRealTimers() })

  it('autosave saves raw text without formatting', async () => {
    const doc = new Y.Doc()
    const handle = fakeHandle()
    saveFileAs.mockResolvedValue({ handle })
    doc.getText('source').insert(0, '* a')
    const { result, rerender } = renderHook(({ s }) => useFileSave(s, { formatOnSave: true }), {
      initialProps: { s: makeSession(doc) },
    })
    await act(async () => { await result.current.save({ explicit: false }) })
    expect(result.current.activeHandle).toBe(handle)
    expect(disk).toBe('* a')
    saveToHandle.mockClear()
    vi.useFakeTimers()
    doc.getText('source').insert(3, '\n')
    rerender({ s: makeSession(doc, { isDirty: true, content: '* a\n' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(saveToHandle).toHaveBeenCalledTimes(1)
    expect(disk).toBe('* a\n')
    expect(doc.getText('source').toString()).toBe('* a\n')
  })

  it('explicit save formats with minimal delta', async () => {
    const doc = new Y.Doc()
    const other = new Y.Doc()
    const yText = doc.getText('source')
    yText.insert(0, '* a')
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc))
    other.getText('source').insert(3, '\n\nsuffix')
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other))
    const handle = fakeHandle()
    saveFileAs.mockResolvedValue({ handle })
    const { result } = renderHook(() => useFileSave(makeSession(doc, { isDirty: true }), { formatOnSave: true }))
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(yText.toString()).toBe('- a\n\nsuffix\n')
    let it: any = yText._start
    let found: any = null
    while (it) {
      if (!it.deleted && it.content?.str?.includes('suffix')) found = it
      it = it.right
    }
    expect(found).not.toBeNull()
    expect(found.id.client).toBe(other.clientID)
  })

  it('format transaction origin is md:format', async () => {
    const doc = new Y.Doc()
    const yText = doc.getText('source')
    yText.insert(0, '* a')
    const handle = fakeHandle()
    saveFileAs.mockResolvedValue({ handle })
    const origins: unknown[] = []
    doc.on('afterTransaction', (tr: Y.Transaction) => { if (tr.changed.has(yText as unknown as Y.AbstractType<Y.YEvent<any>>)) origins.push(tr.origin) })
    const { result } = renderHook(() => useFileSave(makeSession(doc, { isDirty: true }), { formatOnSave: true }))
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(yText.toString()).toBe('- a\n')
    expect(origins).toContain('md:format')
    expect(origins).not.toContain('save-format')
  })

  it('revertToDisk applies disk text with origin md:revert', async () => {
    const doc = new Y.Doc()
    const yText = doc.getText('source')
    yText.insert(0, 'local text')
    const handle = fakeHandle()
    saveFileAs.mockResolvedValue({ handle })
    disk = 'disk text'
    doc.getMap('meta').set('originHash', 'stale')
    const { result } = renderHook(() => useFileSave(makeSession(doc, { isDirty: true }), { formatOnSave: false }))
    await act(async () => { await result.current.save({ explicit: true }) }) // no handle -> saveFileAs
    disk = 'disk text'
    doc.getMap('meta').set('originHash', 'stale')
    await act(async () => { await result.current.save({ explicit: true }) }) // conflict
    expect(result.current.conflict.open).toBe(true)
    const origins: unknown[] = []
    doc.on('afterTransaction', (tr: Y.Transaction) => { if (tr.changed.has(yText as unknown as Y.AbstractType<Y.YEvent<any>>)) origins.push(tr.origin) })
    await act(async () => { await result.current.revertToDisk() })
    expect(yText.toString()).toBe('disk text')
    expect(origins).toEqual(['md:revert'])
  })

  async function withHandle(doc: Y.Doc, formatOnSave = false) {
    const handle = fakeHandle()
    saveFileAs.mockResolvedValue({ handle })
    const hook = renderHook(({ s }) => useFileSave(s, { formatOnSave }), { initialProps: { s: makeSession(doc, { isDirty: true }) } })
    await act(async () => { await hook.result.current.save({ explicit: true }) })
    return { handle, ...hook }
  }

  it('getFile rejects -> error state, no conflict, text untouched', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'local')
    const { result } = await withHandle(doc)
    expect(result.current.saveState.kind).toBe('saved')
    result.current.activeHandle!.getFile = async () => { throw new Error('gone') }
    saveToHandle.mockClear()
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(result.current.saveState).toEqual({
      kind: 'error', canSaveAs: true,
      message: 'Không đọc được file trên đĩa (đã bị xoá hoặc di chuyển?).',
    })
    expect(result.current.conflict.open).toBe(false)
    expect(doc.getText('source').toString()).toBe('local')
    expect(saveToHandle).not.toHaveBeenCalled()
  })

  it('successful save -> saved', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    const { result } = await withHandle(doc)
    expect(result.current.saveState.kind).toBe('saved')
  })

  it('write throws -> error with message', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    const { result } = await withHandle(doc)
    saveToHandle.mockRejectedValueOnce(new Error('disk full'))
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(result.current.saveState).toEqual({ kind: 'error', message: 'disk full', canSaveAs: true })
  })

  it('conflict -> closeConflict -> autosave does nothing', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'local')
    const { result, rerender } = await withHandle(doc)
    disk = 'other'
    doc.getMap('meta').set('originHash', 'stale')
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(result.current.conflict.open).toBe(true)
    act(() => { result.current.closeConflict() })
    expect(result.current.conflict.open).toBe(false)
    expect(result.current.saveState.kind).toBe('conflict')
    saveToHandle.mockClear()
    vi.useFakeTimers()
    rerender({ s: makeSession(doc, { isDirty: true, content: 'local!' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(saveToHandle).not.toHaveBeenCalled()
    expect(result.current.conflict.open).toBe(false)
  })

  it('cancelled picker -> idle', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    saveFileAs.mockResolvedValue(null)
    const { result } = renderHook(() => useFileSave(makeSession(doc, { isDirty: true }), { formatOnSave: false }))
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(result.current.saveState).toEqual({ kind: 'idle' })
  })

  it('keepLocal while in flight does not write twice', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'local')
    const { result } = await withHandle(doc)
    disk = 'other'
    doc.getMap('meta').set('originHash', 'stale')
    await act(async () => { await result.current.save({ explicit: true }) })
    saveToHandle.mockClear()
    let release!: () => void
    saveToHandle.mockImplementationOnce(async (_h, t) => { await new Promise<void>(r => { release = r }); disk = t })
    await act(async () => {
      const a = result.current.keepLocal()
      const b = result.current.keepLocal()
      await Promise.resolve()
      release()
      await Promise.all([a, b])
    })
    expect(saveToHandle).toHaveBeenCalledTimes(1)
    expect(result.current.saveState.kind).toBe('saved')
  })

  it('error pauses autosave', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    const { result, rerender } = await withHandle(doc)
    saveToHandle.mockClear()
    saveToHandle.mockRejectedValueOnce(new Error('disk full'))
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(result.current.saveState.kind).toBe('error')
    vi.useFakeTimers()
    rerender({ s: makeSession(doc, { isDirty: true, content: 'x!' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(saveToHandle).toHaveBeenCalledTimes(1)
  })

  it('saved then user edit -> idle', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    const { result, rerender } = await withHandle(doc)
    expect(result.current.saveState.kind).toBe('saved')
    rerender({ s: makeSession(doc, { isDirty: true, content: 'x!' }) })
    expect(result.current.saveState.kind).toBe('idle')
  })

  it('Save As write failure leaves activeHandle null', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    saveFileAs.mockResolvedValue({ handle: fakeHandle() })
    saveToHandle.mockRejectedValueOnce(new Error('nope'))
    const { result } = renderHook(() => useFileSave(makeSession(doc, { isDirty: true }), { formatOnSave: false }))
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(result.current.saveState.kind).toBe('error')
    expect(result.current.activeHandle).toBeNull()
  })

  const rec = { docId: 'doc-1', hasHandle: true, title: 'a', persistenceName: 'p', originKind: 'file', originPath: 'file:a.md', lastOpenedAt: 0 } as any
  function storedHandle(perm: string, req = 'denied') {
    const h: any = fakeHandle()
    h.queryPermission = vi.fn(async () => perm)
    h.requestPermission = vi.fn(async () => req)
    return h
  }

  it('stored handle with granted permission -> save writes without picker', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    const h = storedHandle('granted')
    getHandle.mockResolvedValue(h)
    const { result } = renderHook(() => useFileSave(makeSession(doc, { docId: 'doc-1', record: rec, isDirty: true }), { formatOnSave: false }))
    await waitFor(() => expect(result.current.activeHandle).toBe(h))
    doc.getMap('meta').set('originHash', await (await import('@md-reader/core')).hashText(''))
    disk = ''
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(saveFileAs).not.toHaveBeenCalled()
    expect(disk).toBe('x')
  })

  it('stored handle with prompt permission -> needs-permission; grantPermission activates', async () => {
    const doc = new Y.Doc()
    const h = storedHandle('prompt', 'granted')
    getHandle.mockResolvedValue(h)
    const { result } = renderHook(() => useFileSave(makeSession(doc, { docId: 'doc-1', record: rec }), { formatOnSave: false }))
    await waitFor(() => expect(result.current.saveState).toEqual({ kind: 'needs-permission', fileName: 'a.md' }))
    expect(result.current.activeHandle).toBeNull()
    expect(h.requestPermission).not.toHaveBeenCalled()
    await act(async () => { await result.current.grantPermission() })
    expect(h.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    expect(result.current.activeHandle).toBe(h)
    expect(result.current.saveState).toEqual({ kind: 'idle' })
  })

  it('Save As stores the handle for session.docId', async () => {
    const doc = new Y.Doc()
    doc.getText('source').insert(0, 'x')
    const handle = fakeHandle()
    saveFileAs.mockResolvedValue({ handle })
    const { result } = renderHook(() => useFileSave(makeSession(doc, { docId: 'doc-9', isDirty: true }), { formatOnSave: false }))
    await act(async () => { await result.current.save({ explicit: true }) })
    expect(storeHandle).toHaveBeenCalledWith('doc-9', handle)
  })
})

describe('openLocalFileAsDoc', () => {
  it('same file twice -> createRecord called once', async () => {
    const { openLocalFileAsDoc } = await vi.importActual<typeof import('../fs/file-system')>('../fs/file-system')
    createRecord.mockClear(); writeDocText.mockClear(); storeHandle.mockClear()
    const records: any[] = []
    listRecent.mockImplementation(async () => records)
    getHandle.mockImplementation(async (id: unknown) => (records.find(r => r.docId === id) ? stored : null))
    const stored: any = {
      name: 'n.md', getFile: async () => ({ text: async () => 'hello' }),
      isSameEntry: async () => true,
    }
    createRecord.mockImplementation(async (i: any) => {
      const r = { docId: 'new-1', persistenceName: 'p', hasHandle: true, ...i }
      records.push(r)
      return r
    })
    ;(window as any).showOpenFilePicker = vi.fn(async () => [stored])
    expect(await openLocalFileAsDoc()).toBe('new-1')
    expect(await openLocalFileAsDoc()).toBe('new-1')
    expect(createRecord).toHaveBeenCalledTimes(1)
    expect(writeDocText).toHaveBeenCalledWith(expect.objectContaining({ docId: 'new-1' }), 'hello', 'if-clean')
    delete (window as any).showOpenFilePicker
  })

  it('cancelled picker -> null', async () => {
    const { openLocalFileAsDoc } = await vi.importActual<typeof import('../fs/file-system')>('../fs/file-system')
    ;(window as any).showOpenFilePicker = vi.fn(async () => { const e = new Error('x'); e.name = 'AbortError'; throw e })
    expect(await openLocalFileAsDoc()).toBeNull()
    delete (window as any).showOpenFilePicker
  })
})
