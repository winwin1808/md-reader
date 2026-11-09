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
