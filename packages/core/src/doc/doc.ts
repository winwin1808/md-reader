import * as Y from 'yjs'
import { applyTextChange, ORIGIN_LOAD } from './apply.js'
import { DOC_KEYS, FORMAT_VERSION, UnsupportedFormatVersionError, type DocMeta, type HistoryEntry } from './schema.js'

type InitOpts = {
  title?: string
  source?: string
  originPath?: string | null
  originHash?: string | null
}

function initDoc(doc: Y.Doc, init?: InitOpts): void {
  doc.transact(() => {
    const meta = doc.getMap(DOC_KEYS.meta)
    meta.set('title', init?.title ?? 'Untitled')
    meta.set('formatVersion', FORMAT_VERSION)
    meta.set('originPath', init?.originPath ?? null)
    meta.set('originHash', init?.originHash ?? null)
    meta.set('createdAt', Date.now())
    meta.set('actors', new Y.Map<string>())
    const source = getSource(doc)
    if (init?.source && source.length === 0) {
      source.insert(0, init.source)
    }
    getHistory(doc)
  })
}

export function createDoc(init?: InitOpts): Y.Doc {
  const doc = new Y.Doc({ gc: false })
  initDoc(doc, init)
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
  const formatVersion = typeof m.get('formatVersion') === 'number' ? (m.get('formatVersion') as number) : 1
  const originPath = typeof m.get('originPath') === 'string' ? (m.get('originPath') as string) : null
  const originHash = typeof m.get('originHash') === 'string' ? (m.get('originHash') as string) : null
  const createdAt = typeof m.get('createdAt') === 'number' ? (m.get('createdAt') as number) : 0
  const rawActors = m.get('actors')
  const actors: Record<string, string> =
    rawActors instanceof Y.Map
      ? (rawActors.toJSON() as Record<string, string>)
      : rawActors && typeof rawActors === 'object' && !Array.isArray(rawActors)
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

/** Đưa Y.Text về text bằng delta tối thiểu, trong MỘT transaction. Set originPath/originHash. */
export function importText(
  doc: Y.Doc,
  text: string,
  opts: { originPath?: string | null; originHash: string },
): void {
  doc.transact(() => {
    applyTextChange(getSource(doc), text)
    const meta = getMeta(doc)
    if (opts.originPath !== undefined) {
      meta.set('originPath', opts.originPath)
    }
    meta.set('originHash', opts.originHash)
  }, ORIGIN_LOAD)
}

export function exportText(doc: Y.Doc): string {
  return getSource(doc).toString()
}

/** Migrate a doc to FORMAT_VERSION. Missing formatVersion means v1. */
export function migrateDoc(doc: Y.Doc): { from: number; to: number } {
  const meta = getMeta(doc)
  const raw = meta.get('formatVersion')
  const v = typeof raw === 'number' ? raw : 1
  if (v > FORMAT_VERSION) {
    throw new UnsupportedFormatVersionError(v, FORMAT_VERSION)
  }
  if (v === FORMAT_VERSION) return { from: v, to: v }
  doc.transact(() => {
    const name = meta.get('name')
    if (meta.get('title') === undefined && typeof name === 'string') meta.set('title', name)
    meta.delete('name')
    meta.delete('size')
    if (meta.get('createdAt') === undefined) meta.set('createdAt', Date.now())
    const rawActors = meta.get('actors')
    if (!(rawActors instanceof Y.Map)) {
      const map = new Y.Map<string>()
      meta.set('actors', map)
      if (rawActors && typeof rawActors === 'object' && !Array.isArray(rawActors)) {
        for (const [k, v] of Object.entries(rawActors as Record<string, string>)) map.set(k, v)
      }
    }
    if (meta.get('originPath') === undefined) meta.set('originPath', null)
    meta.set('formatVersion', FORMAT_VERSION)
  })
  return { from: v, to: FORMAT_VERSION }
}

export function ensureDoc(doc: Y.Doc, init?: InitOpts): { migrated: boolean } {
  if (getMeta(doc).size === 0) {
    initDoc(doc, init)
    return { migrated: false }
  }
  const r = migrateDoc(doc)
  return { migrated: r.from !== r.to }
}
