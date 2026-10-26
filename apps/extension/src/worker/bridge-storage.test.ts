import { describe, it, expect } from 'vitest'
import {
  BRIDGE_STORAGE_KEY, parseBridgeSettings, readBridgeSettings, addApproved, removeApproved, nextScanDelayMin,
  type StoreLike,
} from './bridge-storage'

function fakeStore(init: Record<string, unknown> = {}): StoreLike & { data: Record<string, unknown> } {
  const data = { ...init }
  return {
    data,
    async get(k) { return k in data ? { [k]: data[k] } : {} },
    async set(v) { Object.assign(data, v) },
  }
}

describe('bridge-storage', () => {
  it('parse sai hình dạng → mặc định', () => {
    const d = { enabled: false, approved: [] }
    expect(parseBridgeSettings(undefined)).toEqual(d)
    expect(parseBridgeSettings('x')).toEqual(d)
    expect(parseBridgeSettings({ enabled: 'yes', approved: 3 })).toEqual(d)
    expect(parseBridgeSettings({ enabled: true, approved: [{ keyHash: 1 }] })).toEqual(d)
    expect(parseBridgeSettings({ enabled: true, approved: [{ keyHash: 'a', client: 'c', at: 1 }] }))
      .toEqual({ enabled: true, approved: [{ keyHash: 'a', client: 'c', at: 1 }] })
  })
  it('readBridgeSettings: không có khoá → tắt', async () => {
    expect(await readBridgeSettings(fakeStore())).toEqual({ enabled: false, approved: [] })
  })
  it('addApproved thay entry cùng keyHash', async () => {
    const s = fakeStore({ [BRIDGE_STORAGE_KEY]: { enabled: true, approved: [{ keyHash: 'a', client: 'old', at: 1 }] } })
    await addApproved(s, { keyHash: 'a', client: 'new', at: 2 })
    await addApproved(s, { keyHash: 'b', client: 'b', at: 3 })
    const r = await readBridgeSettings(s)
    expect(r.enabled).toBe(true)
    expect(r.approved).toEqual([{ keyHash: 'a', client: 'new', at: 2 }, { keyHash: 'b', client: 'b', at: 3 }])
  })
  it('removeApproved', async () => {
    const s = fakeStore({ [BRIDGE_STORAGE_KEY]: { enabled: true, approved: [{ keyHash: 'a', client: 'c', at: 1 }] } })
    await removeApproved(s, 'a')
    expect((await readBridgeSettings(s)).approved).toEqual([])
  })
  it('nextScanDelayMin', () => {
    expect(nextScanDelayMin(0)).toBe(0.5)
    expect(nextScanDelayMin(9)).toBe(0.5)
    expect(nextScanDelayMin(10)).toBe(5)
    expect(nextScanDelayMin(50)).toBe(5)
  })
})
