import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as Y from 'yjs'
import { hashText, ORIGIN_LOAD } from '@md-reader/core'
import { __resetForTests, createRecord, findByOrigin, listRecent, storeBase } from '../doc-registry'

vi.mock('../doc-registry', async (orig) => {
  const actual = await orig<typeof import('../doc-registry')>()
  return { ...actual, storeBase: vi.fn(actual.storeBase) }
})

let idbUpdate: Uint8Array | null = null
let resolveSync: () => void = () => {}
let emitSynced: () => void = () => {}
let names: string[] = []

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
    destroy() {}
  },
}))

import { useDocSession } from './useDocSession'

async function prepareIdb(text: string, originText: string) {
  const d = new Y.Doc()
  d.getText('source').insert(0, text)
  d.getMap('meta').set('originHash', await hashText(originText))
  idbUpdate = Y.encodeStateAsUpdate(d)
}

function setup(remote: string) {
  vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => remote })))
  return renderHook(() => useDocSession({ docId: null, fileUrl: 'https://x.test/a.md' }))
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 60)) })

describe('useDocSession safe load', () => {
  beforeEach(async () => {
    idbUpdate = null; names = []; void emitSynced; vi.mocked(storeBase).mockClear()
    await __resetForTests()
    await new Promise<void>((r) => { const q = indexedDB.deleteDatabase('md-reader'); q.onsuccess = () => r(); q.onerror = () => r(); q.onblocked = () => r() })
  })

  it('keeps local edits when remote equals origin (no duplication)', async () => {
    await prepareIdb('old + my edits', 'old')
    const { result } = setup('old')
    await flush()
    await act(async () => { resolveSync() })
    await flush()
    expect(result.current.yText.toString()).toBe('old + my edits')
    expect(result.current.externalChange).toBeNull()
    expect(result.current.isDirty).toBe(true)
  })

  it('flags external change when remote differs and local edited; accept applies', async () => {
    await prepareIdb('old + my edits', 'old')
    const { result } = setup('new')
    await flush()
    await act(async () => { resolveSync() })
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
    await act(async () => { resolveSync() })
    await waitFor(() => expect(result.current.yText.toString()).toBe('hello'))
    expect(result.current.externalChange).toBeNull()
  })

  it('applies remote when local is unchanged since origin', async () => {
    await prepareIdb('old', 'old')
    const { result } = setup('new')
    await flush()
    await act(async () => { resolveSync() })
    await waitFor(() => expect(result.current.yText.toString()).toBe('new'))
    expect(result.current.externalChange).toBeNull()
    expect(result.current.doc.getMap('meta').get('originHash')).toBe(await hashText('new'))
  })

  it('emptied doc with unchanged remote stays empty, no banner', async () => {
    await prepareIdb('', 'old')
    const { result } = setup('old')
    await flush()
    await act(async () => { resolveSync() })
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
    await act(async () => { resolveSync() })
    await flush()
    expect(result.current.externalChange).toBeNull()
    expect(result.current.doc.getMap('meta').get('originHash')).toBe(await hashText('same'))
    expect(result.current.isDirty).toBe(false)
  })

  it('?file= for a known URL reuses the record and rewrites the URL to ?doc=', async () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    const first = setup('x')
    await flush()
    await act(async () => { resolveSync() })
    await flush()
    first.unmount()
    const second = setup('x')
    await flush()
    await act(async () => { resolveSync() })
    await flush()
    const all = await listRecent(10)
    expect(all).toHaveLength(1)
    const rec = await findByOrigin('https://x.test/a.md')
    expect(second.result.current.docId).toBe(rec!.docId)
    expect(spy).toHaveBeenCalledWith(null, '', '?doc=' + rec!.docId)
    spy.mockRestore()
  })

  it('?doc= opens the record persistenceName and restores its text', async () => {
    const rec = await createRecord({ title: 'n.md', originKind: 'drop', originPath: null, persistenceName: 'pname-1' })
    await prepareIdb('stored text', 'stored text')
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    const { result } = renderHook(() => useDocSession({ docId: rec.docId, fileUrl: null }))
    await flush()
    await act(async () => { resolveSync() })
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
    const { result } = renderHook(() => useDocSession({ docId: rec.docId, fileUrl: null }))
    await flush()
    await act(async () => { resolveSync() })
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
      await act(async () => { resolveSync() })
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
      await act(async () => { resolveSync() })
      await flush()
      return r
    }
    const idOf = async () => (await findByOrigin('https://x.test/a.md'))!.docId

    it('fresh import (d) stores base', async () => {
      await run('hello')
      expect(storeBase).toHaveBeenCalledWith(await idOf(), 'hello')
    })
    it('local equals remote (e) stores base', async () => {
      await prepareIdb('same', 'same')
      await run('same')
      expect(storeBase).toHaveBeenCalledWith(await idOf(), 'same')
    })
    it('apply remote (g) stores base', async () => {
      await prepareIdb('old', 'old')
      await run('new')
      expect(storeBase).toHaveBeenCalledWith(await idOf(), 'new')
    })
    it('disk unchanged with local edits (f) stores base', async () => {
      await prepareIdb('old + my edits', 'old')
      await run('old')
      expect(storeBase).toHaveBeenCalledWith(await idOf(), 'old')
    })
    it('diverged (h) does not store base; acceptExternal does', async () => {
      await prepareIdb('old + my edits', 'old')
      const { result } = await run('new')
      expect(result.current.externalChange?.remoteText).toBe('new')
      expect(storeBase).not.toHaveBeenCalled()
      act(() => result.current.acceptExternal())
      expect(storeBase).toHaveBeenCalledWith(await idOf(), 'new')
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
    await act(async () => { resolveSync() })
    await flush()
    return r
  }

  it('saved edits survive reload when remote is unchanged (no banner)', async () => {
    await prepareSaved('edited', 'orig', 'edited')
    const { result } = await run('orig')
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

  it('malformed %E0 in the URL path does not throw; title is the raw segment', async () => {
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'hi' })))
    const { result } = renderHook(() => useDocSession({ docId: null, fileUrl: 'https://x.test/%E0.md' }))
    await flush()
    await act(async () => { resolveSync() })
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
    idbUpdate = null
    const rec = await createRecord({ title: 'd.md', originKind: 'drop', originPath: null, persistenceName: 'pname-d' })
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), remove: async () => {} } } })
    const seen: string[] = []
    const { result } = renderHook(() => { const r = useDocSession({ docId: rec.docId, fileUrl: null }); seen.push(r.content); return r })
    await flush()
    await act(async () => { resolveSync() })
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
