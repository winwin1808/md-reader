import { describe, it, expect } from 'vitest'
import { parseBridgeMessage, BRIDGE_TOOLS, BRIDGE_PORTS } from './protocol.js'

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
