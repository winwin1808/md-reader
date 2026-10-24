import { describe, it, expect } from 'vitest'
import { isMarkdownUrl, isStaleCacheEntry, isGithubBlobMarkdownUrl, makeCacheEntry, readCacheEntry } from './md-url'

describe('isMarkdownUrl', () => {
  it.each([
    'https://e.com/a.md',
    'https://e.com/A.MD',
    'https://e.com/x.markdown',
    'https://e.com/y.mdx?raw=1',
    'https://e.com/z.md#h',
    'file:///tmp/a.md',
    'https://raw.githubusercontent.com/o/r/main/a.md',
  ])('true: %s', (u) => expect(isMarkdownUrl(u)).toBe(true))
  it.each([
    'https://e.com/a.txt',
    'https://e.com/a.md.txt',
    'https://github.com/o/r/blob/main/a.md',
    'https://www.github.com/o/r/blob/main/a.md',
    'not a url',
    'ftp://e.com/a.md',
  ])('false: %s', (u) => expect(isMarkdownUrl(u)).toBe(false))
})

describe('isStaleCacheEntry', () => {
  it('legacy string is stale', () => expect(isStaleCacheEntry('# x', 1000)).toBe(true))
  it('old object is stale', () =>
    expect(isStaleCacheEntry({ text: 'x', ts: 0 }, 700_000)).toBe(true))
  it('fresh object is not stale', () =>
    expect(isStaleCacheEntry({ text: 'x', ts: 500_000 }, 700_000)).toBe(false))
})

describe('isGithubBlobMarkdownUrl', () => {
  it.each(['https://github.com/o/r/blob/main/a.md', 'https://www.github.com/o/r/blob/main/d/a.MD'])(
    'true: %s', (u) => expect(isGithubBlobMarkdownUrl(u)).toBe(true))
  it.each([
    'https://raw.githubusercontent.com/o/r/main/a.md',
    'https://github.com/o/r/blob/main/a.txt',
    'https://github.com/o/r/tree/main/a.md',
    'nope',
  ])('false: %s', (u) => expect(isGithubBlobMarkdownUrl(u)).toBe(false))
})

describe('cache entries', () => {
  it('makeCacheEntry', () => expect(makeCacheEntry('a', 5)).toEqual({ text: 'a', ts: 5 }))
  it('readCacheEntry', () => {
    expect(readCacheEntry('s')).toBe('s')
    expect(readCacheEntry({ text: 't', ts: Date.now() })).toBe('t')
    expect(readCacheEntry({ text: 3 })).toBeNull()
    expect(readCacheEntry(null)).toBeNull()
    expect(readCacheEntry(42)).toBeNull()
    expect(readCacheEntry({ text: 't', ts: 0 }, 11 * 60_000)).toBeNull()
    expect(readCacheEntry({ text: 't', ts: 0 }, 5 * 60_000)).toBe('t')
    expect(readCacheEntry('legacy', 11 * 60_000)).toBe('legacy')
    expect(isStaleCacheEntry({ weird: 1 }, 1)).toBe(true)
  })
})
