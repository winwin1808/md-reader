import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createT } from '@md-reader/ui'
import { newInstallKey, getInstallKey, InstallKeyStorageError, limitMessage, INSTALL_KEY_STORAGE, __resetInstallKeyCache } from './tenancy'

const t = createT('vi')

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = { ...initial }
  const set = vi.fn(async (v: Record<string, unknown>) => { await Promise.resolve(); Object.assign(data, v) })
  const get = vi.fn(async (k: string) => { await Promise.resolve(); return k in data ? { [k]: data[k] } : {} })
  return { store: { get, set }, set, data }
}

describe('tenancy', () => {
  beforeEach(() => __resetInstallKeyCache())

  it('newInstallKey: 43 base64url chars, unique', () => {
    const a = newInstallKey()
    expect(a).toHaveLength(43)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(newInstallKey()).not.toBe(a)
  })

  it('getInstallKey generates once then reads back', async () => {
    const f = fakeStore()
    const k1 = await getInstallKey(f.store)
    expect(f.set).toHaveBeenCalledTimes(1)
    expect(f.data[INSTALL_KEY_STORAGE]).toBe(k1)
    __resetInstallKeyCache()
    expect(await getInstallKey(f.store)).toBe(k1)
    expect(f.set).toHaveBeenCalledTimes(1)
  })

  it('replaces a corrupt value', async () => {
    const f = fakeStore({ [INSTALL_KEY_STORAGE]: 'short' })
    const k = await getInstallKey(f.store)
    expect(k).toHaveLength(43)
    expect(f.set).toHaveBeenCalledTimes(1)
  })

  it('parallel calls set once', async () => {
    const f = fakeStore()
    const [a, b] = await Promise.all([getInstallKey(f.store), getInstallKey(f.store)])
    expect(a).toBe(b)
    expect(f.set).toHaveBeenCalledTimes(1)
  })

  it('storage failure is a storage error, not a network error', async () => {
    const store = { get: async () => { throw new Error('quota') }, set: async () => {} }
    await expect(getInstallKey(store)).rejects.toBeInstanceOf(InstallKeyStorageError)
  })

  it('two contexts racing first run share one key via navigator.locks', async () => {
    let tail: Promise<unknown> = Promise.resolve()
    const prev = (navigator as any).locks
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: (_n: string, cb: () => Promise<unknown>) => { const r = tail.then(cb); tail = r.catch(() => {}); return r },
    } })
    try {
      const f = fakeStore()
      const a = getInstallKey(f.store)
      __resetInstallKeyCache() // a second tab has its own module cache
      const b = getInstallKey(f.store)
      expect(await a).toBe(await b)
      expect(f.set).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: prev })
    }
  })

  it('limitMessage', () => {
    expect(limitMessage(t, 200, {})).toBeNull()
    expect(limitMessage(t, 429, { error: 'RATE_LIMITED', retryAfter: 7200 })).toContain('2 giờ')
    expect(limitMessage(t, 429, {})).toBe(t('ext.limit.rateSoon'))
    expect(limitMessage(t, 429, { error: 'QUOTA_EXCEEDED' })).toBe(t('ext.limit.quota'))
  })
})
