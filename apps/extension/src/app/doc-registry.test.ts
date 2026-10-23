import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getMeta, getSource, hashText } from '@md-reader/core'
import {
  __resetForTests, createRecord, findByOrigin, getRecord, touchRecord, listRecent,
  storeHandle, getHandle, storeBase, getBase, migrateLegacyRegistry, writeDocText,
} from './doc-registry'

let legacy: unknown[] = []
beforeEach(async () => {
  await __resetForTests()
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('md-reader'); r.onsuccess = () => res(); r.onerror = () => res() })
  legacy = []
  ;(globalThis as any).chrome = {
    storage: { local: { get: vi.fn(async () => ({ recentFiles: legacy })) } },
  }
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('doc-registry', () => {
  it('create/get/findByOrigin', async () => {
    const r = await createRecord({ title: 'A', originKind: 'url', originPath: 'file:///a.md' })
    expect(r.persistenceName).toBe(`md-reader-doc-${r.docId}`)
    expect(r.hasHandle).toBe(false)
    expect(await getRecord(r.docId)).toEqual(r)
    expect((await findByOrigin('file:///a.md'))?.docId).toBe(r.docId)
    expect(await findByOrigin('nope')).toBeNull()
  })

  it('touchRecord merges patch and bumps time; unknown is no-op', async () => {
    const r = await createRecord({ title: 'A', originKind: 'drop', originPath: null })
    await sleep(5)
    await touchRecord(r.docId, { title: 'B' })
    const u = (await getRecord(r.docId))!
    expect(u.title).toBe('B')
    expect(u.lastOpenedAt).toBeGreaterThan(r.lastOpenedAt)
    await touchRecord('missing', { title: 'x' })
    expect(await getRecord('missing')).toBeNull()
  })

  it('listRecent orders and limits', async () => {
    const a = await createRecord({ title: 'a', originKind: 'drop', originPath: null })
    await sleep(3)
    const b = await createRecord({ title: 'b', originKind: 'drop', originPath: null })
    await sleep(3)
    const c = await createRecord({ title: 'c', originKind: 'drop', originPath: null })
    expect((await listRecent()).map((x) => x.docId)).toEqual([c.docId, b.docId, a.docId])
    expect((await listRecent(2)).length).toBe(2)
  })

  it('handle round-trip sets hasHandle', async () => {
    const r = await createRecord({ title: 'a', originKind: 'file', originPath: null })
    expect(await getHandle(r.docId)).toBeNull()
    await storeHandle(r.docId, { kind: 'file', name: 'a.md' } as unknown as FileSystemFileHandle)
    expect(await getHandle(r.docId)).toEqual({ kind: 'file', name: 'a.md' })
    expect((await getRecord(r.docId))!.hasHandle).toBe(true)
  })

  it('base round-trip', async () => {
    expect(await getBase('x')).toBeNull()
    await storeBase('x', 'hello')
    expect(await getBase('x')).toBe('hello')
  })

  it('migrateLegacyRegistry migrates URL entries once', async () => {
    legacy = [
      { id: 'file:///a.md', name: 'a', lastOpened: 100 },
      { id: 'https://x.com/b.md', name: 'b', lastOpened: 200 },
      { id: 'not a url', name: 'c', lastOpened: 300 },
    ]
    expect(await migrateLegacyRegistry()).toBe(2)
    const a = (await findByOrigin('file:///a.md'))!
    expect(a.persistenceName).toBe(`md-reader-${encodeURIComponent('file:///a.md')}`)
    expect(a.lastOpenedAt).toBe(100)
    expect(await migrateLegacyRegistry()).toBe(0)
  })

  it('migrateLegacyRegistry creates drop record when md-reader DB exists', async () => {
    await new Promise<void>((res, rej) => {
      const q = indexedDB.open('md-reader', 1)
      q.onsuccess = () => { q.result.close(); res() }
      q.onerror = () => rej(q.error)
    })
    expect(await migrateLegacyRegistry()).toBe(1)
    const d = (await listRecent())[0]!
    expect(d.originKind).toBe('drop')
    expect(d.persistenceName).toBe('md-reader')
    expect(d.originPath).toBeNull()
  })

  it('migrate tolerates missing chrome', async () => {
    delete (globalThis as any).chrome
    expect(await migrateLegacyRegistry()).toBe(0)
  })

  it('writeDocText replace persists text and hash; if-clean keeps edits', async () => {
    const r = await createRecord({ title: 'T', originKind: 'file', originPath: null })
    expect(await writeDocText(r, 'hello', 'replace')).toBe('written')

    const doc = new Y.Doc({ gc: false })
    const p = new IndexeddbPersistence(r.persistenceName, doc)
    await p.whenSynced
    expect(getSource(doc).toString()).toBe('hello')
    expect(getMeta(doc).get('originHash')).toBe(await hashText('hello'))
    doc.transact(() => getSource(doc).insert(5, ' edited'))
    await p.destroy()

    expect(await writeDocText(r, 'other', 'if-clean')).toBe('kept')
    const doc2 = new Y.Doc({ gc: false })
    const p2 = new IndexeddbPersistence(r.persistenceName, doc2)
    await p2.whenSynced
    expect(getSource(doc2).toString()).toBe('hello edited')
    await p2.destroy()
  })
})
