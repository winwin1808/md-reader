import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
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
    while (used.has(name.toLowerCase()) || name === ERRORS_FILE) {
      n++
      name = `${base} (${n}).md`
    }
    used.add(name.toLowerCase())
    return name
  })
}

export async function readDocSource(rec: DocRecord): Promise<string> {
  const doc = new Y.Doc({ gc: false })
  const p = new IndexeddbPersistence(rec.persistenceName, doc)
  try {
    await p.whenSynced
    return getSource(doc).toString()
  } finally {
    await p.destroy()
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
