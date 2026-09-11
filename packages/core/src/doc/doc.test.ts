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
})

describe('createDoc & accessors', () => {
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
  it('fills safe defaults for an empty or foreign Y.Doc', () => {
    const doc = new Y.Doc()
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
  })
})
