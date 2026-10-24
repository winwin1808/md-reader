import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getMeta, getSource, hashText } from '@md-reader/core'
import {
  __resetForTests, createRecord, findByOrigin, getRecord, touchRecord, listRecent,
  storeHandle, getHandle, storeBase, getBase, migrateLegacyRegistry, writeDocText, findOrCreateByOrigin,
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

  it('findOrCreateByOrigin is atomic across concurrent callers', async () => {
    const init = { title: 'A', originKind: 'url' as const, originPath: 'https://x.com/a.md' }
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => findOrCreateByOrigin(init)))
    expect(new Set(rs.map((r) => r.docId)).size).toBe(1)
    expect((await listRecent()).length).toBe(1)
  })

  it('migrateLegacyRegistry racing findOrCreateByOrigin yields one record', async () => {
    legacy = [{ id: 'https://x.com/b.md', name: 'b', lastOpened: 100 }]
    await Promise.all([
      migrateLegacyRegistry(),
      findOrCreateByOrigin({ title: 'b', originKind: 'url', originPath: 'https://x.com/b.md' }),
    ])
    expect((await listRecent()).length).toBe(1)
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
  it('concurrent migrations share one run', async () => {
    legacy = [
      { id: 'file:///a.md', name: 'a', lastOpened: 100 },
      { id: 'https://x.com/b.md', name: 'b', lastOpened: 200 },
    ]
    const [x, y] = await Promise.all([migrateLegacyRegistry(), migrateLegacyRegistry()])
    expect(x + y).toBe(2)
    const all = await listRecent(100)
    expect(all.length).toBe(2)
    expect(new Set(all.map((r) => r.originPath)).size).toBe(2)
  })

  it('two module instances (tabs) migrate once and leave a migratedAt marker', async () => {
    legacy = [
      { id: 'file:///a.md', name: 'a', lastOpened: 100 },
      { id: 'https://x.com/b.md', name: 'b', lastOpened: 200 },
    ]
    vi.resetModules()
    const other = await import('./doc-registry')
    const [x, y] = await Promise.all([migrateLegacyRegistry(), other.migrateLegacyRegistry()])
    expect(x + y).toBe(2)
    expect((await listRecent(100)).length).toBe(2)
    const marker = await new Promise<unknown>((res, rej) => {
      const q = indexedDB.open('md_reader_registry', 1)
      q.onsuccess = () => {
        const g = q.result.transaction('meta').objectStore('meta').get('migratedAt')
        g.onsuccess = () => { q.result.close(); res(g.result) }
        g.onerror = () => rej(g.error)
      }
      q.onerror = () => rej(q.error)
    })
    expect(typeof marker).toBe('number')
  })

  it('retry after deleting only the flag creates no duplicate drop record', async () => {
    await new Promise<void>((res, rej) => {
      const q = indexedDB.open('md-reader', 1)
      q.onsuccess = () => { q.result.close(); res() }
      q.onerror = () => rej(q.error)
    })
    expect(await migrateLegacyRegistry()).toBe(1)
    await new Promise<void>((res, rej) => {
      const q = indexedDB.open('md_reader_registry', 1)
      q.onsuccess = () => {
        const db = q.result
        const tx = db.transaction('meta', 'readwrite')
        tx.objectStore('meta').delete('migratedV1')
        tx.oncomplete = () => { db.close(); res() }
        tx.onerror = () => rej(tx.error)
      }
      q.onerror = () => rej(q.error)
    })
    await migrateLegacyRegistry()
    const drops = (await listRecent(100)).filter((r) => r.persistenceName === 'md-reader')
    expect(drops.length).toBe(1)
  })

  async function readDoc(name: string) {
    const doc = new Y.Doc({ gc: false })
    const p = new IndexeddbPersistence(name, doc)
    await p.whenSynced
    const out = { text: getSource(doc).toString(), hash: getMeta(doc).get('originHash') }
    await p.destroy()
    return out
  }

  it('if-clean on an empty doc writes', async () => {
    const r = await createRecord({ title: 'T', originKind: 'file', originPath: null })
    expect(await writeDocText(r, 'abc', 'if-clean')).toBe('written')
    expect((await readDoc(r.persistenceName)).text).toBe('abc')
  })

  it('if-clean on a clean doc replaces text', async () => {
    const r = await createRecord({ title: 'T', originKind: 'file', originPath: null })
    await writeDocText(r, 'one', 'replace')
    expect(await writeDocText(r, 'two', 'if-clean')).toBe('written')
    const d = await readDoc(r.persistenceName)
    expect(d.text).toBe('two')
    expect(d.hash).toBe(await hashText('two'))
  })

  it('if-clean with identical text but no originHash writes and sets hash', async () => {
    const r = await createRecord({ title: 'T', originKind: 'file', originPath: null })
    const doc = new Y.Doc({ gc: false })
    const p = new IndexeddbPersistence(r.persistenceName, doc)
    await p.whenSynced
    doc.transact(() => getSource(doc).insert(0, 'same'))
    await p.destroy()
    expect(await writeDocText(r, 'same', 'if-clean')).toBe('written')
    const d = await readDoc(r.persistenceName)
    expect(d.text).toBe('same')
    expect(d.hash).toBe(await hashText('same'))
  })

  it('writeDocText stores the base when written, leaves it when kept', async () => {
    const r = await createRecord({ title: 'T', originKind: 'file', originPath: null })
    expect(await writeDocText(r, 'hello', 'replace')).toBe('written')
    expect(await getBase(r.docId)).toBe('hello')
    const doc = new Y.Doc({ gc: false })
    const p = new IndexeddbPersistence(r.persistenceName, doc)
    await p.whenSynced
    doc.transact(() => getSource(doc).insert(5, ' edited'))
    await p.destroy()
    expect(await writeDocText(r, 'other', 'if-clean')).toBe('kept')
    expect(await getBase(r.docId)).toBe('hello')
  })
})
