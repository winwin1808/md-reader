import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import {
  FORMAT_VERSION,
  DOC_KEYS,
  UnsupportedFormatVersionError,
} from './schema.js'
import { hashText } from './hash.js'
import {
  createDoc,
  getSource,
  getMeta,
  getHistory,
  readMeta,
  importText,
  exportText,
  migrateDoc,
} from './doc.js'
import * as CoreExports from '../index.js'

describe('doc schema & constants', () => {
  it('defines FORMAT_VERSION and DOC_KEYS correctly', () => {
    expect(FORMAT_VERSION).toBe(1)
    expect(DOC_KEYS).toEqual({
      source: 'source',
      meta: 'meta',
      history: 'history',
    })
  })

  it('instantiates UnsupportedFormatVersionError properly', () => {
    const err = new UnsupportedFormatVersionError(2, 1)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('UnsupportedFormatVersionError')
    expect(err.foundVersion).toBe(2)
    expect(err.maxSupportedVersion).toBe(1)
    expect(err.message).toBe('Unsupported formatVersion: 2 (max supported: 1)')
  })
})

describe('hashText', () => {
  it('computes SHA-256 hex using globalThis.crypto.subtle', async () => {
    const emptyHash = await hashText('')
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

    const helloHash = await hashText('hello')
    expect(helloHash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('matches standard SHA-256 hex values', async () => {
    expect(await hashText('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(await hashText('hello world')).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    )
  })
})

describe('createDoc & accessors', () => {
  it('initializes exactly 3 keys (source, meta, history) and formatVersion === 1', () => {
    const doc = createDoc()
    expect(Array.from(doc.share.keys()).sort()).toEqual(['history', 'meta', 'source'])
    expect(doc.share.size).toBe(3)
    const meta = readMeta(doc)
    expect(meta.formatVersion).toBe(1)
  })

  it('creates doc with defaults when no options provided', () => {
    const doc = createDoc()
    expect(doc).toBeInstanceOf(Y.Doc)

    const source = getSource(doc)
    expect(source.toString()).toBe('')

    const history = getHistory(doc)
    expect(history.toArray()).toEqual([])

    const meta = readMeta(doc)
    expect(meta.title).toBe('Untitled')
    expect(meta.formatVersion).toBe(1)
    expect(meta.originPath).toBeNull()
    expect(meta.originHash).toBeNull()
    expect(typeof meta.createdAt).toBe('number')
    expect(meta.createdAt).toBeGreaterThan(0)
    expect(meta.actors).toEqual({})
  })

  it('creates doc with custom options', () => {
    const doc = createDoc({
      title: 'Test Note',
      source: '# Hello World\n\nContent here',
      originPath: '/path/to/test.md',
      originHash: 'abc123hash',
    })

    expect(getSource(doc).toString()).toBe('# Hello World\n\nContent here')

    const meta = readMeta(doc)
    expect(meta.title).toBe('Test Note')
    expect(meta.formatVersion).toBe(1)
    expect(meta.originPath).toBe('/path/to/test.md')
    expect(meta.originHash).toBe('abc123hash')
  })

  it('accessors return corresponding Yjs shared types', () => {
    const doc = new Y.Doc()
    expect(getSource(doc)).toBe(doc.getText(DOC_KEYS.source))
    expect(getMeta(doc)).toBe(doc.getMap(DOC_KEYS.meta))
    expect(getHistory(doc)).toBe(doc.getArray(DOC_KEYS.history))
  })
})

describe('readMeta resilience', () => {
  it('runs on a plain new Y.Doc() without throwing and returns valid defaults for all fields', () => {
    const doc = new Y.Doc()
    let meta!: ReturnType<typeof readMeta>
    expect(() => {
      meta = readMeta(doc)
    }).not.toThrow()
    expect(meta).toEqual({
      title: 'Untitled',
      formatVersion: FORMAT_VERSION,
      originPath: null,
      originHash: null,
      createdAt: 0,
      actors: {},
    })
  })

  it('falls back to defaults for invalid types in meta map', () => {
    const doc = new Y.Doc()
    const map = doc.getMap(DOC_KEYS.meta)
    map.set('title', 12345)
    map.set('formatVersion', 'v1')
    map.set('originPath', 99)
    map.set('originHash', true)
    map.set('createdAt', 'yesterday')
    map.set('actors', 'not-an-object')

    const meta = readMeta(doc)
    expect(meta).toEqual({
      title: 'Untitled',
      formatVersion: FORMAT_VERSION,
      originPath: null,
      originHash: null,
      createdAt: 0,
      actors: {},
    })
  })
})

describe('importText and exportText', () => {
  it('round-trips character-by-character for unicode, emojis, newlines, and whitespace', () => {
    const testCases = [
      'Xin chào thế giới! 🌟🚀 Tiếng Việt có dấu: á, ơ, ư, ê, đ.',
      'Line 1\nLine 2\n\nLine 4 with trailing newline\n',
      'CRLF line 1\r\nCRLF line 2\r\n',
      '   leading and trailing spaces \t \n  ',
    ]
    for (const text of testCases) {
      const doc = createDoc()
      importText(doc, text, { originHash: 'test-hash', originPath: 'test.md' })
      expect(exportText(doc)).toBe(text)
    }
  })

  it('second importText cleanly replaces all previous content in a single transaction', () => {
    const doc = createDoc({ source: 'original legacy content that should be replaced completely' })
    let txCount = 0
    doc.on('afterTransaction', () => {
      txCount++
    })

    const newText = 'brand new content completely replacing the old'
    importText(doc, newText, { originHash: 'hash-v2' })

    expect(exportText(doc)).toBe(newText)
    expect(txCount).toBe(1)
    const meta = readMeta(doc)
    expect(meta.originHash).toBe('hash-v2')
  })
})

describe('importText minimal delta', () => {
  it('changes only the differing word, keeping untouched chars original clientID', () => {
    const doc = createDoc({ source: 'alpha beta gamma' })
    const source = getSource(doc)
    const origId = doc.clientID
    const other = new Y.Doc()
    other.clientID = origId + 1
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc))
    // run import on the other replica so new chars get a different clientID
    importText(other, 'alpha delta gamma', { originHash: 'h2' })
    expect(exportText(other)).toBe('alpha delta gamma')
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other))
    expect(source.toString()).toBe('alpha delta gamma')
    const chars: string[] = []
    const ownerOf: number[] = []
    const t = getSource(other)
    for (let item = t._start; item; item = item.right) {
      if (item.deleted) continue
      const s = (item.content as { str?: string }).str ?? ''
      for (const ch of s) {
        chars.push(ch)
        ownerOf.push(item.id.client)
      }
    }
    const text = chars.join('')
    const idx = text.indexOf('delta')
    for (let i = 0; i < text.length; i++) {
      const inWord = i >= idx && i < idx + 5
      if (!inWord) expect(ownerOf[i]).toBe(origId)
    }
    expect(ownerOf.slice(idx, idx + 5).some((c) => c === other.clientID)).toBe(true)
    // convergence
    expect(exportText(doc)).toBe(exportText(other))
  })

  it('uses origin md:load for the transaction', () => {
    const doc = createDoc({ source: 'one two' })
    const origins: unknown[] = []
    doc.on('afterTransaction', (tr: Y.Transaction) => {
      origins.push(tr.origin)
    })
    importText(doc, 'one three', { originHash: 'h' })
    expect(origins).toEqual(['md:load'])
  })
})

describe('migrateDoc', () => {
  it('returns { from: 1, to: 1 } for normal v1 doc', () => {
    const doc = createDoc()
    const result = migrateDoc(doc)
    expect(result).toEqual({ from: 1, to: 1 })
  })

  it('throws UnsupportedFormatVersionError when formatVersion is 2', () => {
    const doc = createDoc()
    getMeta(doc).set('formatVersion', 2)
    expect(() => migrateDoc(doc)).toThrow(UnsupportedFormatVersionError)
    try {
      migrateDoc(doc)
      expect.unreachable('should have thrown UnsupportedFormatVersionError')
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedFormatVersionError)
      const err = e as UnsupportedFormatVersionError
      expect(err.foundVersion).toBe(2)
      expect(err.maxSupportedVersion).toBe(1)
    }
  })
})

describe('re-exports from @md-reader/core', () => {
  it('exports all schema, hash, and doc functions', () => {
    expect(CoreExports.FORMAT_VERSION).toBe(1)
    expect(CoreExports.DOC_KEYS).toBeDefined()
    expect(CoreExports.UnsupportedFormatVersionError).toBeDefined()
    expect(CoreExports.hashText).toBeDefined()
    expect(CoreExports.createDoc).toBeDefined()
    expect(CoreExports.getSource).toBeDefined()
    expect(CoreExports.getMeta).toBeDefined()
    expect(CoreExports.getHistory).toBeDefined()
    expect(CoreExports.readMeta).toBeDefined()
    expect(CoreExports.importText).toBeDefined()
    expect(CoreExports.exportText).toBeDefined()
    expect(CoreExports.migrateDoc).toBeDefined()
  })
})

