import { describe, it, expect } from 'vitest'
import { isMarkdownUrl, isStaleCacheEntry } from './md-url'

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
