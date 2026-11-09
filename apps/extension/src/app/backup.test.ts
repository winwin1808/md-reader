import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { unzipSync, strFromU8 } from 'fflate'
import { getSource } from '@md-reader/core'
import { backupFileNames, buildBackup, readDocSource } from './backup'
import type { DocRecord } from './doc-registry'

const rec = (docId: string, title: string, persistenceName = `p-${docId}`): DocRecord => ({
  docId, title, originKind: 'url', originPath: null, persistenceName, lastOpenedAt: 0, hasHandle: false,
}) as DocRecord

async function unzip(blob: Blob) {
  const u = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  return Object.fromEntries(Object.entries(u).map(([k, v]) => [k, strFromU8(v)]))
}

describe('backupFileNames', () => {
  it('dedupes case-insensitively', () => {
    expect(backupFileNames(['A', 'a', 'A'])).toEqual(['A.md', 'a (2).md', 'A (3).md'])
  })
  it('sanitizes', () => {
    const out = backupFileNames(['../x', 'a/b:c', '', '  ', 'note.md', '\u0007bell'])
    for (const n of out) {
      expect(n).not.toMatch(/[/\\]/)
      expect(n.startsWith('..')).toBe(false)
      expect(n).not.toMatch(/[\u0000-\u001f\u007f]/)
      expect(n.length).toBeGreaterThan(3)
    }
    expect(out).toContain('Untitled.md')
    expect(out).toContain('note.md')
    expect(out).not.toContain('note.md.md')
  })
  it('keeps names distinct when a title already looks like a suffix', () => {
    for (const input of [['A (2)', 'A', 'A'], ['A', 'A', 'A (2)']]) {
      const out = backupFileNames(input)
      expect(new Set(out.map((n) => n.toLowerCase())).size).toBe(out.length)
    }
  })
})

describe('buildBackup', () => {
  const md = '![x](data:image/png;base64,iVBORw0KGgo=)\n# Xin chào'
  it('records failures', async () => {
    const read = async (r: DocRecord) => { if (r.docId === 'b') throw new Error('x'); return r.docId === 'a' ? md : 'two' }
    const res = await buildBackup([rec('a', 'One'), rec('b', 'Bad'), rec('c', 'Two')], read)
    expect(res.included).toBe(2)
    expect(res.failed).toEqual(['Bad'])
    const f = await unzip(res.blob)
    expect(f['One.md']).toBe(md)
    expect(f['Two.md']).toBe('two')
    expect(f['_backup-errors.txt']).toContain('Bad')
  })
  it('no errors file when all ok', async () => {
    const res = await buildBackup([rec('a', 'One')], async () => 'z')
    expect(Object.keys(await unzip(res.blob))).toEqual(['One.md'])
  })
})

const rawCount = (name: string) => new Promise<number>((resolve, reject) => {
  const req = indexedDB.open(name)
  req.onerror = () => reject(req.error)
  req.onsuccess = () => {
    const db = req.result
    const c = db.transaction('updates', 'readonly').objectStore('updates').count()
    c.onsuccess = () => { db.close(); resolve(c.result) }
    c.onerror = () => { db.close(); reject(c.error) }
  }
})

describe('readDocSource raw read-only', () => {
  it('does not add rows to updates', async () => {
    const r = rec('rc', 'RC', 'persist-rc')
    const w = new Y.Doc({ gc: false })
    const wp = new IndexeddbPersistence(r.persistenceName, w)
    await wp.whenSynced
    getSource(w).insert(0, '# Rows')
    await new Promise((res) => setTimeout(res, 50))
    await wp.destroy(); w.destroy()
    const before = await rawCount(r.persistenceName)
    expect(await readDocSource(r)).toBe('# Rows')
    expect(await rawCount(r.persistenceName)).toBe(before)
  })
  it('rejects for a missing DB and creates none', async () => {
    await expect(readDocSource(rec('m', 'M', 'persist-missing'))).rejects.toThrow('missing document storage')
    // an aborted first open leaves only a version-0 stub in fake-indexeddb; a created DB has version >= 1
    const dbs = await indexedDB.databases()
    expect(dbs.some((d) => d.name === 'persist-missing' && (d.version ?? 0) > 0)).toBe(false)
  })
  it('buildBackup puts a missing DB in failed with no .md', async () => {
    const res = await buildBackup([rec('m2', 'Ghost', 'persist-ghost')])
    expect(res.failed).toEqual(['Ghost'])
    expect(res.included).toBe(0)
    expect(Object.keys(await unzip(res.blob))).not.toContain('Ghost.md')
  })
})

describe('readDocSource', () => {
  it('reads without writing', async () => {
    const r = rec('d', 'D', 'persist-d')
    const w = new Y.Doc({ gc: false })
    const wp = new IndexeddbPersistence(r.persistenceName, w)
    await wp.whenSynced
    getSource(w).insert(0, '# Hi')
    await new Promise((res) => setTimeout(res, 50))
    await wp.destroy(); w.destroy()

    const sv = async () => {
      const d = new Y.Doc({ gc: false })
      const p = new IndexeddbPersistence(r.persistenceName, d)
      await p.whenSynced
      const v = Y.encodeStateVector(d)
      await p.destroy(); d.destroy()
      return v
    }
    const before = await sv()
    expect(await readDocSource(r)).toBe('# Hi')
    expect(await sv()).toEqual(before)
  })
})
