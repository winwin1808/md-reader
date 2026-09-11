import * as Y from 'yjs'
import { DOC_KEYS, FORMAT_VERSION, UnsupportedFormatVersionError, type DocMeta, type HistoryEntry } from './schema.js'

export function createDoc(init?: {
  title?: string
  source?: string
  originPath?: string | null
  originHash?: string | null
}): Y.Doc {
  const doc = new Y.Doc()
  doc.transact(() => {
    const meta = doc.getMap(DOC_KEYS.meta)
    meta.set('title', init?.title ?? 'Untitled')
    meta.set('formatVersion', FORMAT_VERSION)
    meta.set('originPath', init?.originPath ?? null)
    meta.set('originHash', init?.originHash ?? null)
    meta.set('createdAt', Date.now())
    meta.set('actors', {})
    const source = getSource(doc)
    if (init?.source) {
      source.insert(0, init.source)
    }
    getHistory(doc)
  })
  return doc
}

export function getSource(doc: Y.Doc): Y.Text {
  return doc.getText(DOC_KEYS.source)
}

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.meta)
}

export function getHistory(doc: Y.Doc): Y.Array<HistoryEntry> {
  return doc.getArray<HistoryEntry>(DOC_KEYS.history)
}

/** Đọc meta ra object thường, điền default an toàn cho field thiếu. */
export function readMeta(doc: Y.Doc): DocMeta {
  const m = getMeta(doc)
  const title = typeof m.get('title') === 'string' ? (m.get('title') as string) : 'Untitled'
  const formatVersion = typeof m.get('formatVersion') === 'number' ? (m.get('formatVersion') as number) : FORMAT_VERSION
  const originPath = typeof m.get('originPath') === 'string' ? (m.get('originPath') as string) : null
  const originHash = typeof m.get('originHash') === 'string' ? (m.get('originHash') as string) : null
  const createdAt = typeof m.get('createdAt') === 'number' ? (m.get('createdAt') as number) : 0
  const rawActors = m.get('actors')
  const actors = rawActors && typeof rawActors === 'object' && !Array.isArray(rawActors)
    ? (rawActors as Record<string, string>)
    : {}

  return {
    title,
    formatVersion,
    originPath,
    originHash,
    createdAt,
    actors,
  }
}

/** Thay toàn bộ Y.Text bằng text, trong MỘT transaction. Set originPath/originHash. */
export function importText(
  doc: Y.Doc,
  text: string,
  opts: { originPath?: string | null; originHash: string },
): void {
  doc.transact(() => {
    const source = getSource(doc)
    if (source.length > 0) {
      source.delete(0, source.length)
    }
    source.insert(0, text)
    const meta = getMeta(doc)
    if (opts.originPath !== undefined) {
      meta.set('originPath', opts.originPath)
    }
    meta.set('originHash', opts.originHash)
  })
}

export function exportText(doc: Y.Doc): string {
  return getSource(doc).toString()
}

/**
 * Hook migration của §5.4. v1 là no-op; nó tồn tại để phase sau có chỗ bám và
 * để test fixture cũ có hàm gọi.
 */
export function migrateDoc(doc: Y.Doc): { from: number; to: number } {
  const meta = getMeta(doc)
  const currentVersion = (typeof meta.get('formatVersion') === 'number'
    ? meta.get('formatVersion')
    : FORMAT_VERSION) as number
  if (currentVersion > FORMAT_VERSION) {
    throw new UnsupportedFormatVersionError(currentVersion, FORMAT_VERSION)
  }
  return { from: currentVersion, to: FORMAT_VERSION }
}

