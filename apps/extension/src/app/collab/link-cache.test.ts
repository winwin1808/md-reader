import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveLinkToken, getLinkTokens, forgetLinkToken } from './link-cache'

let store: Record<string, unknown>
beforeEach(() => {
  store = {}
  ;(globalThis as any).chrome = {
    storage: { local: {
      get: vi.fn(async (k: string) => (k in store ? { [k]: store[k] } : {})),
      set: vi.fn(async (o: Record<string, unknown>) => { Object.assign(store, o) }),
    } },
  }
})

describe('link-cache', () => {
  it('round trips and isolates rooms', async () => {
    await saveLinkToken('r1', 'aaaa', 'T1')
    await saveLinkToken('r1', 'bbbb', 'T2')
    await saveLinkToken('r2', 'aaaa', 'X')
    expect(await getLinkTokens('r1')).toEqual({ aaaa: 'T1', bbbb: 'T2' })
    expect(await getLinkTokens('r2')).toEqual({ aaaa: 'X' })
  })
  it('forget removes one prefix', async () => {
    await saveLinkToken('r1', 'aaaa', 'T1')
    await saveLinkToken('r1', 'bbbb', 'T2')
    await forgetLinkToken('r1', 'aaaa')
    expect(await getLinkTokens('r1')).toEqual({ bbbb: 'T2' })
  })
  it('storage throwing never throws; get returns {}', async () => {
    const boom = vi.fn(async () => { throw new Error('x') })
    ;(globalThis as any).chrome = { storage: { local: { get: boom, set: boom } } }
    await expect(saveLinkToken('r', 'p', 't')).resolves.toBeUndefined()
    await expect(forgetLinkToken('r', 'p')).resolves.toBeUndefined()
    expect(await getLinkTokens('r')).toEqual({})
  })
})
