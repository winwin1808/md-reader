import * as Y from 'yjs'
import { IndexeddbPersistence, storeState } from 'y-indexeddb'
import { ensureDoc, getSource, getMeta, applyTextChange, ORIGIN_LOAD, hashText } from '@md-reader/core'

export type OriginKind = 'url' | 'file' | 'drop'
export interface DocRecord {
  docId: string
  title: string
  originKind: OriginKind
  originPath: string | null
  persistenceName: string
  lastOpenedAt: number
  hasHandle: boolean
}

const DB_NAME = 'md_reader_registry'
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        const docs = db.createObjectStore('docs', { keyPath: 'docId' })
        docs.createIndex('originPath', 'originPath')
        db.createObjectStore('handles')
        db.createObjectStore('bases')
        db.createObjectStore('meta')
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => { db.close(); dbPromise = null }
        db.onclose = () => { dbPromise = null }
        resolve(db)
      }
      req.onerror = () => reject(req.error)
    })
    dbPromise.catch(() => { dbPromise = null })
  }
  return dbPromise
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function __resetForTests(): Promise<void> {
  migrationPromise = null
  inFlightByOrigin.clear()
  if (dbPromise) {
    try { (await dbPromise).close() } catch { /* ignore */ }
    dbPromise = null
  }
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB_NAME)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
    r.onblocked = () => resolve()
  })
}

export async function getRecord(docId: string): Promise<DocRecord | null> {
  const db = await openDb()
  const v = await req(db.transaction('docs').objectStore('docs').get(docId))
  return (v as DocRecord | undefined) ?? null
}

export async function findByOrigin(originPath: string): Promise<DocRecord | null> {
  const db = await openDb()
  const v = await req(db.transaction('docs').objectStore('docs').index('originPath').get(originPath))
  return (v as DocRecord | undefined) ?? null
}

async function putRecord(record: DocRecord): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('docs', 'readwrite')
  tx.objectStore('docs').put(record)
  await done(tx)
}

export async function createRecord(init: {
  title: string
  originKind: OriginKind
  originPath: string | null
  persistenceName?: string
}): Promise<DocRecord> {
  const docId = crypto.randomUUID()
  const record: DocRecord = {
    docId,
    title: init.title,
    originKind: init.originKind,
    originPath: init.originPath,
    persistenceName: init.persistenceName ?? `md-reader-doc-${docId}`,
    lastOpenedAt: Date.now(),
    hasHandle: false,
  }
  await putRecord(record)
  return record
}

const inFlightByOrigin = new Map<string, Promise<DocRecord>>()

export function findOrCreateByOrigin(init: {
  title: string
  originKind: OriginKind
  originPath: string
  persistenceName?: string
  lastOpenedAt?: number
}): Promise<DocRecord> {
  const existing = inFlightByOrigin.get(init.originPath)
  if (existing) return existing
  const p = (async () => {
    const db = await openDb()
    const tx = db.transaction('docs', 'readwrite')
    const store = tx.objectStore('docs')
    const found = (await req(store.index('originPath').get(init.originPath))) as DocRecord | undefined
    let record: DocRecord
    if (found) {
      record = found
    } else {
      const docId = crypto.randomUUID()
      record = {
        docId,
        title: init.title,
        originKind: init.originKind,
        originPath: init.originPath,
        persistenceName: init.persistenceName ?? `md-reader-doc-${docId}`,
        lastOpenedAt: init.lastOpenedAt ?? Date.now(),
        hasHandle: false,
      }
      store.put(record)
    }
    await done(tx)
    return record
  })().finally(() => { inFlightByOrigin.delete(init.originPath) })
  inFlightByOrigin.set(init.originPath, p)
  return p
}

export async function touchRecord(docId: string, patch?: Partial<Omit<DocRecord, 'docId'>>): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('docs', 'readwrite')
  const store = tx.objectStore('docs')
  const cur = (await req(store.get(docId))) as DocRecord | undefined
  if (cur) store.put({ ...cur, ...patch, docId, lastOpenedAt: Date.now() })
  await done(tx)
}

export async function deleteRecord(docId: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['docs', 'handles', 'bases'], 'readwrite')
  tx.objectStore('docs').delete(docId)
  tx.objectStore('handles').delete(docId)
  tx.objectStore('bases').delete(docId)
  await done(tx)
}

export async function listRecent(limit = 10): Promise<DocRecord[]> {
  const db = await openDb()
  const all = (await req(db.transaction('docs').objectStore('docs').getAll())) as DocRecord[]
  return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, limit)
}

export async function storeHandle(docId: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['handles', 'docs'], 'readwrite')
  tx.objectStore('handles').put(handle, docId)
  const docs = tx.objectStore('docs')
  const cur = (await req(docs.get(docId))) as DocRecord | undefined
  if (cur) docs.put({ ...cur, hasHandle: true })
  await done(tx)
}

export async function getHandle(docId: string): Promise<FileSystemFileHandle | null> {
  const db = await openDb()
  const v = await req(db.transaction('handles').objectStore('handles').get(docId))
  return (v as FileSystemFileHandle | undefined) ?? null
}

export async function storeBase(docId: string, text: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('bases', 'readwrite')
  tx.objectStore('bases').put(text, docId)
  await done(tx)
}

export async function getBase(docId: string): Promise<string | null> {
  const db = await openDb()
  const v = await req(db.transaction('bases').objectStore('bases').get(docId))
  return (v as string | undefined) ?? null
}

let migrationPromise: Promise<number> | null = null

export function migrateLegacyRegistry(): Promise<number> {
  if (migrationPromise) return migrationPromise.then(() => 0)
  migrationPromise = runMigration().finally(() => { migrationPromise = null })
  return migrationPromise
}

async function runMigration(): Promise<number> {
  const db = await openDb()
  const flag = await req(db.transaction('meta').objectStore('meta').get('migratedV1'))
  if (flag) return 0

  let created = 0
  let entries: Array<{ id: string; name: string; lastOpened: number }> = []
  try {
    const res = await (globalThis as any).chrome.storage.local.get('recentFiles')
    if (Array.isArray(res?.recentFiles)) entries = res.recentFiles
  } catch {
    entries = []
  }
  for (const e of entries) {
    try {
      new URL(e.id)
    } catch {
      continue
    }
    if (await findByOrigin(e.id)) continue
    await findOrCreateByOrigin({
      title: e.name,
      originKind: 'url',
      originPath: e.id,
      persistenceName: `md-reader-${encodeURIComponent(e.id)}`,
      ...(typeof e.lastOpened === 'number' ? { lastOpenedAt: e.lastOpened } : {}),
    })
    created++
  }

  try {
    const dbs = await indexedDB.databases?.()
    const all = (await req(db.transaction('docs').objectStore('docs').getAll())) as DocRecord[]
    if (dbs?.some((d) => d.name === 'md-reader') && !all.some((r) => r.persistenceName === 'md-reader')) {
      await createRecord({
        title: 'Tài liệu đã kéo thả',
        originKind: 'drop',
        originPath: null,
        persistenceName: 'md-reader',
      })
      created++
    }
  } catch {
    /* ignore */
  }

  const tx = db.transaction('meta', 'readwrite')
  tx.objectStore('meta').put(true, 'migratedV1')
  await done(tx)
  return created
}

export async function writeDocText(
  record: DocRecord,
  text: string,
  mode: 'replace' | 'if-clean',
): Promise<'written' | 'kept'> {
  const doc = new Y.Doc({ gc: false })
  const p = new IndexeddbPersistence(record.persistenceName, doc)
  try {
    await p.whenSynced
    ensureDoc(doc, { title: record.title })
    const local = getSource(doc).toString()
    const originHash = getMeta(doc).get('originHash')
    const newHash = await hashText(text)
    if (mode === 'if-clean' && local !== '' && local !== text) {
      if (originHash == null || (await hashText(local)) !== originHash) return 'kept'
    }
    doc.transact(() => {
      if (local !== text) applyTextChange(getSource(doc), text)
      getMeta(doc).set('originHash', newHash)
    }, ORIGIN_LOAD)
    await storeBase(record.docId, text).catch((err) => console.warn('storeBase failed:', err))
    return 'written'
  } finally {
    try {
      await storeState(p, true)
    } finally {
      await p.destroy()
    }
  }
}
