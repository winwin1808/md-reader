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
  shortKey?: string
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
  return ensureShortKey(docId)
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

  let entries: Array<{ id: string; name: string; lastOpened: number }> = []
  try {
    const res = await (globalThis as any).chrome.storage.local.get('recentFiles')
    if (Array.isArray(res?.recentFiles)) entries = res.recentFiles
  } catch {
    entries = []
  }
  entries = entries.filter((e) => {
    try { new URL(e.id); return true } catch { return false }
  })
  let hasLegacyDb = false
  try {
    const dbs = await indexedDB.databases?.()
    hasLegacyDb = !!dbs?.some((d) => d.name === 'md-reader')
  } catch {
    /* ignore */
  }

  // One readwrite transaction: marker check, record creation and marker write are atomic,
  // so a second tab running concurrently sees the marker (or waits) and no-ops.
  const tx = db.transaction(['docs', 'meta'], 'readwrite')
  const docs = tx.objectStore('docs')
  const meta = tx.objectStore('meta')
  const finished = done(tx)
  let created = 0
  try {
    const marker = (await req(meta.get('migratedAt'))) ?? (await req(meta.get('migratedV1')))
    if (marker) {
      await finished
      return 0
    }
    for (const e of entries) {
      if (await req(docs.index('originPath').get(e.id))) continue
      const docId = crypto.randomUUID()
      docs.put({
        docId,
        title: e.name,
        originKind: 'url',
        originPath: e.id,
        persistenceName: `md-reader-${encodeURIComponent(e.id)}`,
        lastOpenedAt: typeof e.lastOpened === 'number' ? e.lastOpened : Date.now(),
        hasHandle: false,
      } satisfies DocRecord)
      created++
    }
    const all = (await req(docs.getAll())) as DocRecord[]
    if (hasLegacyDb && !all.some((r) => r.persistenceName === 'md-reader')) {
      const docId = crypto.randomUUID()
      docs.put({
        docId,
        title: 'Tài liệu đã kéo thả',
        originKind: 'drop',
        originPath: null,
        persistenceName: 'md-reader',
        lastOpenedAt: Date.now(),
        hasHandle: false,
      } satisfies DocRecord)
      created++
    }
    meta.put(true, 'migratedV1')
    meta.put(Date.now(), 'migratedAt')
  } catch (err) {
    try { tx.abort() } catch { /* ignore */ }
    finished.catch(() => {})
    throw err
  }
  await finished
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

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
function randomKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(b, (x) => B62[x % 62]).join('')
}

export function docSlug(name: string): string {
  const base = name.replace(/\.[^./\\]*$/, '')
  const s = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '')
  return s || 'doc'
}

export function docParam(rec: DocRecord): string {
  return `${docSlug(rec.title)}-${rec.shortKey ?? ''}`
}

/** Additive: assigns a unique 4-char key to a record that has none (new or old docs). */
export async function ensureShortKey(docId: string): Promise<DocRecord> {
  const db = await openDb()
  const tx = db.transaction('docs', 'readwrite')
  const store = tx.objectStore('docs')
  const finished = done(tx)
  const cur = (await req(store.get(docId))) as DocRecord | undefined
  if (!cur) {
    await finished
    throw new Error('Record not found: ' + docId)
  }
  if (cur.shortKey) {
    await finished
    return cur
  }
  const all = (await req(store.getAll())) as DocRecord[]
  const used = new Set(all.map((r) => r.shortKey))
  let key = randomKey()
  while (used.has(key)) key = randomKey()
  const next = { ...cur, shortKey: key }
  store.put(next)
  await finished
  return next
}

/** `?d=<slug>-<key>` query for a doc (assigns the key lazily). */
export async function docQuery(docId: string): Promise<string> {
  return '?d=' + docParam(await ensureShortKey(docId))
}

export async function resolveDocParam(params: URLSearchParams): Promise<string | null> {
  const d = params.get('d')
  if (d) {
    const key = d.slice(d.lastIndexOf('-') + 1)
    const db = await openDb()
    const all = (await req(db.transaction('docs').objectStore('docs').getAll())) as DocRecord[]
    return all.find((r) => r.shortKey === key)?.docId ?? null
  }
  const legacy = params.get('doc')
  if (!legacy) return null
  return (await getRecord(legacy))?.docId ?? null
}
