import * as Y from 'yjs'
import { getSource } from '@md-reader/core'
import type { DocRecord } from './doc-registry'

export interface BackupResult { blob: Blob; included: number; failed: string[] }

const ERRORS_FILE = '_backup-errors.txt'

function cleanTitle(title: string): string {
  let s = (title ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  s = s.replace(/^\.+|\.+$/g, '').trim()
  s = Array.from(s).slice(0, 100).join('')
  s = s.replace(/\.(md|markdown)$/i, '').replace(/^\.+|\.+$/g, '').trim()
  return s || 'Untitled'
}

export function backupFileNames(titles: string[]): string[] {
  const used = new Set<string>()
  return titles.map((t) => {
    const base = cleanTitle(t)
    let name = `${base}.md`
    let n = 1
    while (used.has(name.toLowerCase())) {
      n++
      name = `${base} (${n}).md`
    }
    used.add(name.toLowerCase())
    return name
  })
}

function readUpdates(name: string): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    req.onupgradeneeded = () => {
      // DB did not exist: do not leave an empty one behind
      // (reject only once the aborted open settles, via onerror)
      try { req.transaction?.abort() } catch { /* ignore */ }
    }
    req.onerror = (e) => { e.preventDefault(); reject(new Error('missing document storage')) }
    req.onblocked = () => reject(new Error('missing document storage'))
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('updates')) {
        db.close()
        reject(new Error('missing document storage'))
        return
      }
      try {
        const all = db.transaction('updates', 'readonly').objectStore('updates').getAll()
        all.onsuccess = () => { db.close(); resolve(all.result as Uint8Array[]) }
        all.onerror = () => { db.close(); reject(all.error) }
      } catch (e) {
        db.close()
        reject(e)
      }
    }
  })
}

export async function readDocSource(rec: DocRecord): Promise<string> {
  const updates = await readUpdates(rec.persistenceName)
  const doc = new Y.Doc({ gc: false })
  try {
    for (const u of updates) Y.applyUpdate(doc, u)
    return getSource(doc).toString()
  } finally {
    doc.destroy()
  }
}

export async function buildBackup(
  records: DocRecord[],
  read: (r: DocRecord) => Promise<string> = readDocSource,
): Promise<BackupResult> {
  const failed: string[] = []
  const ok: { title: string; text: string }[] = []
  for (const rec of records) {
    try {
      ok.push({ title: rec.title, text: await read(rec) })
    } catch {
      failed.push(rec.title || rec.docId)
    }
  }
  const { zipSync, strToU8 } = await import('fflate')
  const names = backupFileNames(ok.map((o) => o.title))
  // Uint8Array.from re-creates in this realm (TextEncoder can return a foreign-realm array under jsdom)
  const u8 = (t: string): Uint8Array<ArrayBuffer> => Uint8Array.from(strToU8(t))
  const files: Record<string, Uint8Array<ArrayBuffer>> = {}
  ok.forEach((o, i) => { files[names[i]!] = u8(o.text) })
  if (failed.length) files[ERRORS_FILE] = u8(failed.join('\n') + '\n')
  const blob = new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
  return { blob, included: ok.length, failed }
}
