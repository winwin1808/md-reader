import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as Y from 'yjs'
import { hashText } from '@md-reader/core'

let idbUpdate: Uint8Array | null = null
let resolveSync: () => void = () => {}
let emitSynced: () => void = () => {}

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class {
    whenSynced: Promise<unknown>
    private handlers: Array<() => void> = []
    constructor(_n: string, doc: Y.Doc) {
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
vi.mock('../registry', () => ({ addRecentFile: async () => {} }))

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
  return renderHook(() => useDocSession({ fileUrl: 'https://x.test/a.md' }))
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })

describe('useDocSession safe load', () => {
  beforeEach(() => { idbUpdate = null; void emitSynced })

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
})
