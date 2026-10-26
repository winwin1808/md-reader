import { describe, it, expect } from 'vitest'
import { parseBridgeMessage, BRIDGE_TOOLS, BRIDGE_PORTS, validateToolArgs, textHash, BRIDGE_MAX_TITLE, BRIDGE_MAX_MARKDOWN, KNOWN_EXTENSION_IDS, isAllowedExtensionOrigin, BRIDGE_MAX_PAYLOAD, BRIDGE_MAX_CONNECTIONS, sanitizeClientName, BRIDGE_MAX_CLIENT } from './protocol.js'
import { hashText } from '../doc/hash.js'

const p = (o: unknown) => parseBridgeMessage(JSON.stringify(o))
const key = 'k'.repeat(16)

describe('parseBridgeMessage', () => {
  it('constants', () => {
    expect(BRIDGE_TOOLS).toHaveLength(7)
    expect(BRIDGE_PORTS).toEqual([47821, 47822, 47823, 47824, 47825, 47826, 47827, 47828, 47829, 47830])
  })
  it('rejects garbage', () => {
    expect(parseBridgeMessage('{nope')).toBeNull()
    expect(parseBridgeMessage('null')).toBeNull()
    expect(parseBridgeMessage('3')).toBeNull()
    expect(p({ type: 'weird' })).toBeNull()
    expect(p({})).toBeNull()
  })
  it('hello', () => {
    expect(p({ type: 'hello', protocol: 1, client: 'c', pairKey: key, extra: 1 })).toEqual({ type: 'hello', protocol: 1, client: 'c', pairKey: key })
    expect(p({ type: 'hello', protocol: 2, client: 'c', pairKey: key })).toBeNull()
    expect(p({ type: 'hello', protocol: 1, client: '', pairKey: key })).toBeNull()
    expect(p({ type: 'hello', protocol: 1, client: 'c', pairKey: 'short' })).toBeNull()
    expect(p({ type: 'hello', protocol: 1, client: 'c'.repeat(101), pairKey: key })).toBeNull()
  })
  it('req', () => {
    expect(p({ type: 'req', id: 'a', tool: 'get_doc', args: { docId: 'x' } })).toEqual({ type: 'req', id: 'a', tool: 'get_doc', args: { docId: 'x' } })
    expect(p({ type: 'req', id: 'a', tool: 'nope', args: {} })).toBeNull()
    expect(p({ type: 'req', id: 'a', tool: 'get_doc' })).toBeNull()
    expect(p({ type: 'req', id: '', tool: 'get_doc', args: 1 })).toBeNull()
    expect(p({ type: 'req', id: 'a'.repeat(65), tool: 'get_doc', args: 1 })).toBeNull()
  })
  it('welcome/reject/ping', () => {
    expect(p({ type: 'welcome', paired: true, x: 1 })).toEqual({ type: 'welcome', paired: true })
    expect(p({ type: 'welcome', paired: 'y' })).toBeNull()
    expect(p({ type: 'reject', code: 'DENIED' })).toEqual({ type: 'reject', code: 'DENIED' })
    expect(p({ type: 'reject', code: 'X' })).toBeNull()
    expect(p({ type: 'ping', z: 1 })).toEqual({ type: 'ping' })
  })
  it('res', () => {
    expect(p({ type: 'res', id: 'a', ok: true, result: 5 })).toEqual({ type: 'res', id: 'a', ok: true, result: 5 })
    expect(p({ type: 'res', id: 'a', ok: true })).toBeNull()
    expect(p({ type: 'res', id: 'a', ok: false, error: { code: 'TIMEOUT', message: 'm' } })).toEqual({ type: 'res', id: 'a', ok: false, error: { code: 'TIMEOUT', message: 'm' } })
    expect(p({ type: 'res', id: 'a', ok: false, error: { code: 'BAD', message: 'm' } })).toBeNull()
    expect(p({ type: 'res', id: 'a', ok: false })).toBeNull()
    expect(p({ type: 'res', id: 'a', ok: 'x' })).toBeNull()
  })
})

describe('validateToolArgs', () => {
  const h = 'a'.repeat(64)
  const bad = (t: any, a: unknown) => { const r = validateToolArgs(t, a); expect(r.ok).toBe(false); return r as { ok: false; message: string } }
  it('rejects non-objects', () => {
    for (const a of [null, 1, 'x', undefined]) bad('get_doc', a)
  })
  it('publish_doc', () => {
    expect(validateToolArgs('publish_doc', { title: 'T', markdown: '# x', extra: 1 })).toEqual({ ok: true, args: { title: 'T', markdown: '# x' } })
    expect(validateToolArgs('publish_doc', { title: 'T', markdown: '', open: true })).toEqual({ ok: true, args: { title: 'T', markdown: '', open: true } })
    expect(bad('publish_doc', { title: '   ', markdown: '' }).message).toBe('title must be 1..200 characters')
    bad('publish_doc', { title: 'x'.repeat(BRIDGE_MAX_TITLE + 1), markdown: '' })
    bad('publish_doc', { title: 'T', markdown: 'x'.repeat(BRIDGE_MAX_MARKDOWN + 1) })
    bad('publish_doc', { title: 'T', markdown: '', open: 'yes' })
  })
  it('list_docs', () => {
    expect(validateToolArgs('list_docs', { a: 1 })).toEqual({ ok: true, args: {} })
  })
  it('get_doc / list_links', () => {
    expect(validateToolArgs('get_doc', { docId: 'd' })).toEqual({ ok: true, args: { docId: 'd' } })
    bad('list_links', { docId: '' })
    bad('get_doc', { docId: 'x'.repeat(65) })
  })
  it('update_doc', () => {
    expect(validateToolArgs('update_doc', { docId: 'd', markdown: 'm', baseHash: h })).toEqual({ ok: true, args: { docId: 'd', markdown: 'm', baseHash: h } })
    bad('update_doc', { docId: 'd', markdown: 'm', baseHash: 'A'.repeat(64) })
    bad('update_doc', { docId: 'd', markdown: 1, baseHash: h })
  })
  it('share_doc defaults', () => {
    expect(validateToolArgs('share_doc', { docId: 'd' })).toEqual({ ok: true, args: { docId: 'd', role: 'view', expiresInDays: 7 } })
    expect(validateToolArgs('share_doc', { docId: 'd', role: 'edit', expiresInDays: null })).toEqual({ ok: true, args: { docId: 'd', role: 'edit', expiresInDays: null } })
    bad('share_doc', { docId: 'd', role: 'admin' })
    bad('share_doc', { docId: 'd', expiresInDays: 5 })
  })
  it('revoke_link', () => {
    expect(validateToolArgs('revoke_link', { docId: 'd', tokenPrefix: 'abcdef' })).toEqual({ ok: true, args: { docId: 'd', tokenPrefix: 'abcdef' } })
    bad('revoke_link', { docId: 'd', tokenPrefix: 'abc' })
  })
  it('textHash equals hashText', async () => {
    expect(await textHash('héllo')).toBe(await hashText('héllo'))
  })
})

describe('isAllowedExtensionOrigin', () => {
  const id = KNOWN_EXTENSION_IDS[0]!
  it('accepts only exact known id', () => {
    expect(isAllowedExtensionOrigin(`chrome-extension://${id}`)).toBe(true)
    expect(isAllowedExtensionOrigin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false)
    expect(isAllowedExtensionOrigin(`moz-extension://${id}`)).toBe(false)
    expect(isAllowedExtensionOrigin('https://example.com')).toBe(false)
    expect(isAllowedExtensionOrigin(`chrome-extension://${id}x`)).toBe(false)
    expect(isAllowedExtensionOrigin(`chrome-extension://${id}/`)).toBe(false)
    expect(isAllowedExtensionOrigin('chrome-extension://zzz', ['zzz'])).toBe(true)
  })
  it('limits', () => {
    expect(BRIDGE_MAX_PAYLOAD).toBe(16 * 1024 * 1024)
    expect(BRIDGE_MAX_CONNECTIONS).toBe(4)
  })
})

describe('sanitizeClientName', () => {
  it('cleans names', () => {
    expect(BRIDGE_MAX_CLIENT).toBe(40)
    expect(sanitizeClientName('  Claude\n\nDesktop ')).toBe('Claude Desktop')
    expect(sanitizeClientName('A\u202EB\u200BC')).toBe('ABC')
    expect(sanitizeClientName('x'.repeat(100))).toBe('x'.repeat(40))
    const e = 'a'.repeat(39) + '😀' + 'zzz'
    expect(sanitizeClientName(e)).toBe('a'.repeat(39) + '😀')
    expect(sanitizeClientName('')).toBe('AI')
    expect(sanitizeClientName('\u200B')).toBe('AI')
    expect(sanitizeClientName(42)).toBe('AI')
  })
})
