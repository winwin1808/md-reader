import { describe, it, expect } from 'vitest'
import {
  API_PATHS,
  SHARE_EXPIRY_PRESETS,
  buildShareUrl,
  normalizeServerUrl,
  parseShareUrl,
  wsHost,
} from './share.js'

describe('share helpers', () => {
  it('normalizeServerUrl', () => {
    expect(normalizeServerUrl('https://x.workers.dev/')).toBe('https://x.workers.dev')
    expect(normalizeServerUrl('x.workers.dev')).toBe('https://x.workers.dev')
    expect(normalizeServerUrl('http://localhost:8787/')).toBe('http://localhost:8787')
    expect(normalizeServerUrl('http://example.com')).toBeNull()
    expect(normalizeServerUrl('not a url')).toBeNull()
  })
  it('build/parse round-trip', () => {
    const token = 'abcdefABCDEF012345_-xyz'
    const url = buildShareUrl('https://a.b:8443', token)
    expect(url).toBe(`https://a.b:8443/s/${token}`)
    expect(parseShareUrl(url)).toEqual({ serverUrl: 'https://a.b:8443', token })
  })
  it('parseShareUrl rejects bad input', () => {
    expect(parseShareUrl('https://a.b/d/abc')).toBeNull()
    expect(parseShareUrl('https://a.b/s/short')).toBeNull()
    expect(parseShareUrl('nope')).toBeNull()
  })
  it('wsHost', () => {
    expect(wsHost('https://a.b:8443')).toBe('a.b:8443')
  })
  it('constants', () => {
    expect(SHARE_EXPIRY_PRESETS['30d']).toBe(2_592_000_000)
    expect(SHARE_EXPIRY_PRESETS.never).toBeNull()
    expect(API_PATHS.revoke('r1', 'abcdef')).toBe('/api/rooms/r1/links/abcdef')
  })
})
