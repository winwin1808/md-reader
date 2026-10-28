import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import * as Y from 'yjs'
import { hashText, ORIGIN_LOAD, applyTextChangeAsActor } from '@md-reader/core'
import { __resetForTests, createRecord, findByOrigin, listRecent, storeBase, getRecord, docParam } from '../doc-registry'

const ensureFail = vi.hoisted(() => ({ on: false }))
vi.mock('@md-reader/core', async (orig) => {
  const actual = await orig<typeof import('@md-reader/core')>()
  return { ...actual, ensureDoc: ((...a: Parameters<typeof actual.ensureDoc>) => {
    if (ensureFail.on) throw new Error('boom')
    return actual.ensureDoc(...a)
  }) as typeof actual.ensureDoc }
})

vi.mock('../doc-registry', async (orig) => {
  const actual = await orig<typeof import('../doc-registry')>()
  return { ...actual, storeBase: vi.fn(actual.storeBase) }
})

let idbUpdate: Uint8Array | null = null
let resolveSync: () => void = () => {}
let emitSynced: () => void = () => {}
let names: string[] = []
let destroyCalls = 0

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class {
    whenSynced: Promise<unknown>
    private handlers: Array<() => void> = []
    constructor(n: string, doc: Y.Doc) {
      names.push(n)
      this.whenSynced = new Promise<void>((res) => {
        resolveSync = () => {
          if (idbUpdate) Y.applyUpdate(doc, idbUpdate)
          this.handlers.forEach((h) => h())
          res()
        }
      })
      emitSynced = () => {}
    }
    once(_e: string, h: () => void) { this.handlers.push(h) }
    destroy() { destroyCalls++; return Promise.resolve() }
  },
}))

import { useDocSession } from './useDocSession'

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  await new Promise((r) => setTimeout(r, 0))
})

async function prepareIdb(text: string, originText: string) {
  const d = new Y.Doc()
  d.getText('source').insert(0, text)
  d.getMap('meta').set('originHash', await hashText(originText))
  idbUpdate = Y.encodeStateAsUpdate(d)
}

function setup(remote: string) {
  namesBefore = names.length
  vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => remote })))
  return renderHook(() => useDocSession({ docId: null, fileUrl: 'https://x.test/a.md' }))
}
const LOAD_WAIT = { timeout: 5000 }
// resolveSync is rebound by each IndexeddbPersistence; under CPU load the hook may not have
// created it yet after a fixed delay, so wait for it before resolving (else it resolves a stale one).
let namesBefore = 0
const syncNow = async () => {
  await waitFor(() => expect(names.length).toBeGreaterThan(namesBefore), LOAD_WAIT)
  await act(async () => { resolveSync() })
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 60)) })

describe('useDocSession safe load', () => {
  beforeEach(async () => {
    idbUpdate = null; names = []; namesBefore = 0; void emitSynced; vi.mocked(storeBase).mockClear()
    await __resetForTests()
    await new Promise<void>((r) => { const q = indexedDB.deleteDatabase('md-reader'); q.onsuccess = () => r(); q.onerror = () => r(); q.onblocked = () => r() })
  })

  it('keeps local edits when remote equals origin (no duplication)', async () => {
    await prepareIdb('old + my edits', 'old')
    const { result } = setup('old')
    await flush()
    await syncNow()
    await flush()
    await waitFor(() => expect(storeBase).toHaveBeenCalledWith(result.current.docId, 'old'), LOAD_WAIT)
    await waitFor(() => expect(result.current.isDirty).toBe(true), LOAD_WAIT)
    expect(result.current.yText.toString()).toBe('old + my edits')
    expect(result.current.externalChange).toBeNull()
  })

  it('flags external change when remote differs and local edited; accept applies', async () => {
    await prepareIdb('old + my edits', 'old')
    const { result } = setup('new')
    await flush()
    await syncNow()
    await waitFor(() => expect(result.current.externalChange?.remoteText).toBe('new'))
    expect(result.current.yText.toString()).toBe('old + my edits')
    expect(result.current.isDirty).toBe(true)
    act(() => result.current.acceptExternal())
    expect(result.current.yText.toString()).toBe('new')
    expect(result.current.doc.getMap('meta').get('originHash')).toBe(await hashText('new'))
    expect(result.current.externalChange).toBeNull()
  })

  it('imports remote into empty IDB', async () => {
    const { result } = setup('hello')
    await flush()
    await syncNow()
    await waitFor(() => expect(result.current.yText.toString()).toBe('hello'))
    expect(result.current.externalChange).toBeNull()
  })

  it('applies remote when local is unchanged since origin', async () => {
    await prepareIdb('old', 'old')
    const { result } = setup('new')
    await flush()
    await syncNow()
    await waitFor(() => expect(result.current.yText.toString()).toBe('new'))
    expect(result.current.externalChange).toBeNull()
    expect(result.current.doc.getMap('meta').get('originHash')).toBe(await hashText('new'))
  })

  it('emptied doc with unchanged remote stays empty, no banner', async () => {
    await prepareIdb('', 'old')
    const { result } = setup('old')
    await flush()
    await syncNow()
    await flush()
    expect(result.current.yText.toString()).toBe('')
    expect(result.current.externalChange).toBeNull()
  })

  it('local equals remote without originHash -> no banner, originHash set', async () => {
    const d = new Y.Doc()
    d.getText('source').insert(0, 'same')
    idbUpdate = Y.encodeStateAsUpdate(d)
    const { result } = setup('same')
    await flush()
    await syncNow()
    await flush()
    const same = await hashText('same')
    await waitFor(() => expect(result.current.doc.getMap('meta').get('originHash')).toBe(same), LOAD_WAIT)
    expect(result.current.externalChange).toBeNull()
    expect(result.current.isDirty).toBe(false)
  })

  it('?file= for a known URL reuses the record and rewrites the URL to ?doc=', async () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    const first = setup('x')
    await flush()
    await syncNow()
    await flush()
    first.unmount()
    const second = setup('x')
    await flush()
    await syncNow()
    await flush()
    const all = await listRecent(10)
    expect(all).toHaveLength(1)
    const rec = await findByOrigin('https://x.test/a.md')
    expect(second.result.current.docId).toBe(rec!.docId)
    expect(spy).toHaveBeenCalledWith(null, '', '?d=' + docParam((await getRecord(rec!.docId))!))
    spy.mockRestore()
  })

  it('?doc= opens the record persistenceName and restores its text', async () => {
    const rec = await createRecord({ title: 'n.md', originKind: 'drop', originPath: null, persistenceName: 'pname-1' })
    await prepareIdb('stored text', 'stored text')
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    namesBefore = names.length
    const { result } = renderHook(() => useDocSession({ docId: rec.docId, fileUrl: null }))
    await flush()
    await syncNow()
    await flush()
    expect(names).toContain('pname-1')
    expect(result.current.yText.toString()).toBe('stored text')
    expect(result.current.record?.docId).toBe(rec.docId)
  })

  it('unknown docId -> error, no doc load', async () => {
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    const { result } = renderHook(() => useDocSession({ docId: 'nope', fileUrl: null }))
    await flush()
    expect(result.current.error).toBe('Không tìm thấy tài liệu này.')
    expect(names).toHaveLength(0)
    expect(result.current.hasContent).toBe(false)
  })

  it('v1 meta (name,size) in IDB -> title from name after ensureDoc', async () => {
    const rec = await createRecord({ title: 'fallback', originKind: 'drop', originPath: null, persistenceName: 'pname-2' })
    const d = new Y.Doc()
    d.getText('source').insert(0, 'body')
    d.getMap('meta').set('name', 'old-name.md')
    d.getMap('meta').set('size', 4)
    idbUpdate = Y.encodeStateAsUpdate(d)
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    namesBefore = names.length
    const { result } = renderHook(() => useDocSession({ docId: rec.docId, fileUrl: null }))
    await flush()
    await syncNow()
    await flush()
    await waitFor(() => expect(result.current.title).toContain('old-name'))
  })

  describe('page cache entry', () => {
    const key = 'file_content_https://x.test/a.md'
    const runCached = async (value: unknown, expired = false) => {
      const remove = vi.fn(async () => {})
      vi.stubGlobal('chrome', { storage: { local: { get: async () => ({ [key]: value }), remove } } })
      const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'FETCHED' }))
      vi.stubGlobal('fetch', fetchMock)
      const r = renderHook(() => useDocSession({ docId: null, fileUrl: 'https://x.test/a.md' }))
      await flush()
      if (!expired) expect(remove).not.toHaveBeenCalled()
      await syncNow()
      await flush()
      return { r, remove, fetchMock }
    }
    it('reads { text, ts } and removes the key only after load', async () => {
      const { r, remove, fetchMock } = await runCached({ text: 'cached new', ts: Date.now() })
      expect(r.result.current.yText.toString()).toBe('cached new')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(remove).toHaveBeenCalledWith(key)
    })
    it('treats an expired entry as a miss: fetches and removes the key', async () => {
      const { fetchMock, remove } = await runCached({ text: 'stale', ts: Date.now() - 11 * 60_000 }, true)
      expect(fetchMock).toHaveBeenCalled()
      expect(remove).toHaveBeenCalledWith(key)
    })
    it('reads a legacy string value', async () => {
      const { r, remove } = await runCached('legacy text')
      expect(r.result.current.yText.toString()).toBe('legacy text')
      expect(remove).toHaveBeenCalledWith(key)
    })
  })

  describe('base storage on load', () => {
    const run = async (remote: string) => {
      const r = setup(remote)
      await flush()
      await syncNow()
      await flush()
      return r
    }
    const idOf = async () => (await findByOrigin('https://x.test/a.md'))!.docId

    it('fresh import (d) stores base', async () => {
      await run('hello')
      const id = await idOf()
      await waitFor(() => expect(storeBase).toHaveBeenCalledWith(id, 'hello'), LOAD_WAIT)
    })
    it('local equals remote (e) stores base', async () => {
      await prepareIdb('same', 'same')
      await run('same')
      const id = await idOf()
      await waitFor(() => expect(storeBase).toHaveBeenCalledWith(id, 'same'), LOAD_WAIT)
    })
    it('apply remote (g) stores base', async () => {
      await prepareIdb('old', 'old')
      await run('new')
      const id = await idOf()
      await waitFor(() => expect(storeBase).toHaveBeenCalledWith(id, 'new'), LOAD_WAIT)
    })
    it('disk unchanged with local edits (f) stores base', async () => {
      await prepareIdb('old + my edits', 'old')
      await run('old')
      const id = await idOf()
      await waitFor(() => expect(storeBase).toHaveBeenCalledWith(id, 'old'), LOAD_WAIT)
    })
    it('diverged (h) does not store base; acceptExternal does', async () => {
      await prepareIdb('old + my edits', 'old')
      const { result } = await run('new')
      expect(result.current.externalChange?.remoteText).toBe('new')
      expect(storeBase).not.toHaveBeenCalled()
      act(() => result.current.acceptExternal())
      const id = await idOf()
      await waitFor(() => expect(storeBase).toHaveBeenCalledWith(id, 'new'), LOAD_WAIT)
    })
  })
})

describe('useDocSession separate URL and disk baselines', () => {
  beforeEach(async () => {
    idbUpdate = null; names = []
    await __resetForTests()
    await new Promise<void>((r) => { const q = indexedDB.deleteDatabase('md-reader'); q.onsuccess = () => r(); q.onerror = () => r(); q.onblocked = () => r() })
  })
  async function prepareSaved(text: string, remoteText: string, originText: string, withRemote = true) {
    const d = new Y.Doc()
    d.getText('source').insert(0, text)
    if (withRemote) d.getMap('meta').set('remoteHash', await hashText(remoteText))
    d.getMap('meta').set('originHash', await hashText(originText))
    idbUpdate = Y.encodeStateAsUpdate(d)
  }
  const run = async (remote: string) => {
    const r = setup(remote)
    await flush()
    await syncNow()
    await flush()
    return r
  }

  it('saved edits survive reload when remote is unchanged (no banner)', async () => {
    await prepareSaved('edited', 'orig', 'edited')
    const { result } = await run('orig')
    await waitFor(() => expect(storeBase).toHaveBeenCalled(), LOAD_WAIT)
    expect(result.current.yText.toString()).toBe('edited')
    expect(result.current.externalChange).toBeNull()
    expect(result.current.isDirty).toBe(false)
  })

  it('remote changed after saved edits -> banner, text kept', async () => {
    await prepareSaved('edited', 'orig', 'edited')
    const { result } = await run('changed')
    await waitFor(() => expect(result.current.externalChange?.remoteText).toBe('changed'))
    expect(result.current.yText.toString()).toBe('edited')
  })

  it('legacy doc with handle and no remoteHash never auto-applies remote over saved edits', async () => {
    const rec = await createRecord({ title: 'a.md', originKind: 'url', originPath: 'https://x.test/a.md' })
    await (await import('../doc-registry')).storeHandle(rec.docId, {} as any).catch(() => {})
    await prepareSaved('edited', '', 'edited', false)
    const { result } = await run('changed')
    await waitFor(() => expect(result.current.externalChange?.remoteText).toBe('changed'))
    expect(result.current.yText.toString()).toBe('edited')
  })

  const withHandle = async () => {
    const rec = await createRecord({ title: 'a.md', originKind: 'url', originPath: 'https://x.test/a.md' })
    await (await import('../doc-registry')).storeHandle(rec.docId, {} as any)
  }

  it('handle: URL change with local === remote base applies remote, keeps disk baseline, dirty', async () => {
    await withHandle()
    await prepareSaved('orig', 'orig', 'DISK')
    const { result } = await run('changed')
    await waitFor(() => expect(result.current.yText.toString()).toBe('changed'))
    expect(result.current.externalChange).toBeNull()
    expect(result.current.doc.getMap('meta').get('originHash')).toBe(await hashText('DISK'))
    expect(result.current.doc.getMap('meta').get('remoteHash')).toBe(await hashText('changed'))
    expect(result.current.isDirty).toBe(true)
  })

  it('handle: (e) local equals remote keeps originHash', async () => {
    await withHandle()
    await prepareSaved('same', 'old', 'DISK')
    const { result } = await run('same')
    await waitFor(() => expect(storeBase).toHaveBeenCalled(), LOAD_WAIT)
    expect(result.current.externalChange).toBeNull()
    expect(result.current.doc.getMap('meta').get('originHash')).toBe(await hashText('DISK'))
    expect(result.current.doc.getMap('meta').get('remoteHash')).toBe(await hashText('same'))
  })

  it('malformed %E0 in the URL path does not throw; title is the raw segment', async () => {
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'hi' })))
    const { result } = renderHook(() => useDocSession({ docId: null, fileUrl: 'https://x.test/%E0.md' }))
    await flush()
    await syncNow()
    await flush()
    expect(result.current.error).toBeNull()
    await waitFor(() => expect(result.current.title).toBe('%E0'))
  })

  it('pagehide flushes the checkpoint tracker', async () => {
    const { result } = await run('hello')
    await waitFor(() => expect(result.current.checkpoints).not.toBeNull())
    const spy = vi.spyOn(result.current.checkpoints!, 'flush')
    window.dispatchEvent(new Event('pagehide'))
    expect(spy).toHaveBeenCalledWith('auto', 'Bạn')
  })
})

describe('useDocSession debounce', () => {
  it('debounces user edits and flushes ORIGIN_LOAD immediately', async () => {
    idbUpdate = null; names = []
    const rec = await createRecord({ title: 'd.md', originKind: 'drop', originPath: null, persistenceName: 'pname-d' })
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    const seen: string[] = []
    const { result } = renderHook(() => { const r = useDocSession({ docId: rec.docId, fileUrl: null }); seen.push(r.content); return r })
    await flush()
    await syncNow()
    await flush()
    vi.useFakeTimers()
    try {
      seen.length = 0
      let text = ''
      for (let i = 0; i < 10; i++) {
        act(() => { result.current.yText.insert(text.length, 'a'); text += 'a' })
        act(() => { vi.advanceTimersByTime(10) })
      }
      expect(result.current.content).not.toBe(text)
      act(() => { vi.advanceTimersByTime(130) })
      expect(result.current.content).toBe(text)
      expect(new Set(seen).size).toBeLessThanOrEqual(2)
      act(() => { result.current.doc.transact(() => { result.current.yText.insert(0, 'L') }, ORIGIN_LOAD) })
      expect(result.current.content).toBe('L' + text)
    } finally {
      vi.useRealTimers()
    }
  })
})

const bind = vi.hoisted(() => ({ calls: [] as any[], conns: [] as any[] }))
vi.mock('../collab/bindRoom', () => ({
  bindRoom: vi.fn((doc: unknown, opts: unknown) => {
    let cb: ((s: string) => void) | null = null
    const conn = {
      awareness: { clientID: 5, setLocalStateField: vi.fn() },
      status$: (f: (s: string) => void) => { cb = f; f('connecting'); return () => { cb = null } },
      destroy: vi.fn(),
      emit: (s: string) => cb?.(s),
    }
    bind.calls.push([doc, opts]); bind.conns.push(conn)
    return conn
  }),
}))
import { bindRoom } from '../collab/bindRoom'

describe('useDocSession room binding', () => {
  const room = { serverUrl: 'https://s.test', roomId: 'r1', ownerToken: 'tok' } as any
  let recId = ''
  beforeEach(async () => {
    idbUpdate = null; names = []; bind.calls.length = 0; bind.conns.length = 0
    vi.mocked(bindRoom).mockClear()
    await __resetForTests()
    const rec = await createRecord({ title: 'r.md', originKind: 'drop', originPath: null, persistenceName: 'pname-room' })
    recId = rec.docId
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
  })
  const mount = (props: { room: any; displayName?: string }) =>
    renderHook((p: { room: any; displayName?: string }) => useDocSession({ docId: recId, fileUrl: null, room: p.room, displayName: p.displayName }), { initialProps: props })

  it('no room -> never binds, status off', async () => {
    const { result } = mount({ room: null })
    await flush(); await syncNow(); await flush()
    expect(bindRoom).not.toHaveBeenCalled()
    expect(result.current.syncStatus).toBe('off')
    expect(result.current.awareness).toBeNull()
  })

  it('binds once after IndexedDB synced, with token and default name; status flows', async () => {
    const { result } = mount({ room })
    await flush()
    expect(bindRoom).not.toHaveBeenCalled()
    await syncNow(); await flush()
    expect(bindRoom).toHaveBeenCalledTimes(1)
    expect(bind.calls[0][1]).toEqual({ serverUrl: 'https://s.test', roomId: 'r1', token: 'tok', name: 'Bạn' })
    expect(result.current.syncStatus).toBe('off')
    await waitFor(() => expect(result.current.syncStatus).toBe('connecting'), { timeout: 1500 })
    expect(result.current.awareness).toBe(bind.conns[0].awareness)
    act(() => bind.conns[0].emit('online'))
    expect(result.current.syncStatus).toBe('online')
  })

  it('suspendPersistence destroys the IDB persistence and resolves (15o)', async () => {
    const { result } = mount({ room: null })
    await flush(); await syncNow(); await flush()
    const before = destroyCalls
    await act(async () => { await (result.current as any).suspendPersistence() })
    expect(destroyCalls).toBe(before + 1)
  })

  it('record null while a room is configured -> off, no awareness (15o)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '' })))
    const { result, rerender } = renderHook((p: { id: string | null }) => useDocSession({ docId: p.id, fileUrl: null, room }), { initialProps: { id: recId as string | null } })
    await flush(); await syncNow(); await flush()
    act(() => bind.conns[0].emit('online'))
    expect(result.current.syncStatus).toBe('online')
    rerender({ id: null })
    await flush()
    expect(result.current.syncStatus).toBe('off')
    expect(result.current.awareness).toBeNull()
  })

  it('room becoming null destroys the connection', async () => {
    const { result, rerender } = mount({ room })
    await flush(); await syncNow(); await flush()
    rerender({ room: null })
    await flush()
    expect(bind.conns[0].destroy).toHaveBeenCalled()
    expect(result.current.syncStatus).toBe('off')
    expect(result.current.awareness).toBeNull()
  })

  it('switching to a different room clears awareness immediately; same room keeps it (15n)', async () => {
    const { result, rerender } = mount({ room })
    await flush(); await syncNow(); await flush()
    await waitFor(() => expect(result.current.awareness).toBe(bind.conns[0].awareness))
    rerender({ room: { ...room, ownerToken: 'tok2' } })
    expect(result.current.awareness).toBe(bind.conns[0].awareness)
    await flush()
    rerender({ room: { ...room, roomId: 'r2' } })
    expect(result.current.awareness).toBeNull()
    await flush()
    await waitFor(() => expect(result.current.awareness).toBe(bind.conns[bind.conns.length - 1].awareness))
  })

  describe('display status (15i)', () => {
    const seen = (r: { current: { syncStatus: string } }, log: string[]) => {
      if (log[log.length - 1] !== r.current.syncStatus) log.push(r.current.syncStatus)
    }
    it('rebind same room while online: never shows off/connecting if resynced < 300ms', async () => {
      const { result, rerender } = mount({ room })
      await flush(); await syncNow(); await flush()
      act(() => bind.conns[0].emit('online'))
      expect(result.current.syncStatus).toBe('online')
      vi.useFakeTimers()
      try {
        const log: string[] = ['online']
        rerender({ room: { ...room, ownerToken: 'tok2' } })
        seen(result, log)
        await act(async () => { await vi.advanceTimersByTimeAsync(50) })
        seen(result, log)
        expect(bind.conns.length).toBe(2)
        act(() => bind.conns[1].emit('online'))
        seen(result, log)
        await act(async () => { await vi.advanceTimersByTimeAsync(400) })
        seen(result, log)
        expect(log).toEqual(['online'])
      } finally { vi.useRealTimers() }
    })
    it('disabling share -> off immediately; revoked immediately', async () => {
      const { result, rerender } = mount({ room })
      await flush(); await syncNow(); await flush()
      act(() => bind.conns[0].emit('online'))
      act(() => bind.conns[0].emit('revoked'))
      expect(result.current.syncStatus).toBe('revoked')
      rerender({ room: null })
      expect(result.current.syncStatus).toBe('off')
    })
  })

  it('unmount before whenSynced -> never binds', async () => {
    const { unmount } = mount({ room })
    await flush()
    unmount()
    await syncNow(); await flush()
    expect(bindRoom).not.toHaveBeenCalled()
  })

  it('displayName change updates awareness without a new provider', async () => {
    const { rerender } = mount({ room })
    await flush(); await syncNow(); await flush()
    rerender({ room, displayName: 'Lan' })
    await flush()
    expect(bindRoom).toHaveBeenCalledTimes(1)
    expect(bind.conns[0].awareness.setLocalStateField).toHaveBeenCalledWith('user', expect.objectContaining({ name: 'Lan' }))
  })
})

describe('useDocSession aiUnsaved (11g)', () => {
  beforeEach(async () => {
    idbUpdate = null; names = []; namesBefore = 0
    await __resetForTests()
  })
  const ready = async () => {
    const h = setup('hello')
    await flush(); await syncNow()
    await waitFor(() => expect(h.result.current.yText.toString()).toBe('hello'), LOAD_WAIT)
    return h
  }

  it('real MCP path sets persistent flag; null-origin/peer do not clear; ackAi only for exact text; undoManager/binding clear', async () => {
    const { result } = await ready()
    const { doc, yText } = result.current
    expect(result.current.aiUnsaved).toBe(false)
    act(() => { applyTextChangeAsActor(doc, 'hello AI', 'AI', 'mcp') })
    expect(result.current.aiUnsaved).toBe(true)
    expect(doc.getMap('meta').get('aiUnsaved')).toBe(true)
    expect(result.current.isDirty).toBe(true)
    // programmatic local transaction with null origin does not clear
    act(() => { doc.transact(() => { yText.insert(0, 'n') }, null) })
    expect(result.current.aiUnsaved).toBe(true)
    // peer update leaves the flag
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc))
    peer.getText('source').insert(0, 'P')
    act(() => { Y.applyUpdate(doc, Y.encodeStateAsUpdate(peer), 'remote') })
    expect(result.current.aiUnsaved).toBe(true)
    // ack with stale text does not clear
    act(() => result.current.ackAi('stale'))
    expect(result.current.aiUnsaved).toBe(true)
    // editor binding origin clears
    act(() => { doc.transact(() => { yText.insert(0, 'x') }, { ytext: yText, awareness: null }) })
    expect(result.current.aiUnsaved).toBe(false)
    act(() => { applyTextChangeAsActor(doc, yText.toString() + '!', 'AI', 'mcp') })
    expect(result.current.aiUnsaved).toBe(true)
    // exact ack clears
    act(() => result.current.ackAi(yText.toString()))
    expect(result.current.aiUnsaved).toBe(false)
    expect(doc.getMap('meta').has('aiUnsaved')).toBe(false)
    // undoManager origin clears
    act(() => { applyTextChangeAsActor(doc, yText.toString() + '?', 'AI', 'mcp') })
    expect(result.current.aiUnsaved).toBe(true)
    act(() => { doc.transact(() => { yText.insert(0, 'u') }, result.current.undoManager) })
    expect(result.current.aiUnsaved).toBe(false)
  })

  it('flag persisted in meta survives reload', async () => {
    const d = new Y.Doc()
    d.getText('source').insert(0, 'hello')
    d.getMap('meta').set('aiUnsaved', true)
    idbUpdate = Y.encodeStateAsUpdate(d)
    const h = setup('hello')
    await flush(); await syncNow()
    await waitFor(() => expect(h.result.current.aiUnsaved).toBe(true), LOAD_WAIT)
  })
})

describe('useDocSession formatVersion tolerance (11h)', () => {
  beforeEach(async () => {
    idbUpdate = null; names = []; namesBefore = 0
    await __resetForTests()
  })

  it('doc with formatVersion 99 opens: synced, checkpoints set, no error', async () => {
    const d = new Y.Doc()
    d.getText('source').insert(0, 'hello')
    d.getMap('meta').set('formatVersion', 99)
    idbUpdate = Y.encodeStateAsUpdate(d)
    const h = setup('hello')
    await flush(); await syncNow()
    await waitFor(() => expect(h.result.current.checkpoints).not.toBeNull(), LOAD_WAIT)
    expect(h.result.current.error).toBeNull()
    expect(h.result.current.newerFormat).toBe(true)
  })

  it('doc with formatVersion 2 -> newerFormat false', async () => {
    const d = new Y.Doc()
    d.getText('source').insert(0, 'hello')
    d.getMap('meta').set('formatVersion', 2)
    idbUpdate = Y.encodeStateAsUpdate(d)
    const h = setup('hello')
    await flush(); await syncNow()
    await waitFor(() => expect(h.result.current.checkpoints).not.toBeNull(), LOAD_WAIT)
    expect(h.result.current.newerFormat).toBe(false)
  })

  it('other ensureDoc failure sets error and does not hang', async () => {
    ensureFail.on = true
    try {
      const h = setup('hello')
      await flush(); await syncNow()
      await waitFor(() => expect(h.result.current.error).not.toBeNull(), LOAD_WAIT)
      expect(h.result.current.checkpoints).toBeNull()
    } finally { ensureFail.on = false }
  })
})
