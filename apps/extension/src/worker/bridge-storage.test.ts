import { describe, it, expect } from 'vitest'
import {
  BRIDGE_STORAGE_KEY, parseBridgeSettings, readBridgeSettings, addApproved, removeApproved, nextScanDelayMin, parsePairDecision, PAIR_DECISION_MSG, loadOrCreateExtKey, BRIDGE_KEY_STORAGE,
  pairPolicy, parseAsked, readAsked, markAsked, parseSeen, readSeen, upsertSeen, removeSeen, pruneSeen, parseConnectMsg,
  BRIDGE_ASKED_KEY, BRIDGE_SEEN_KEY, BRIDGE_CONNECT_MSG, ASKED_MAX, SEEN_TTL_MS,
  type StoreLike, type SeenServer,
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
    expect(parseBridgeSettings({ enabled: true, approved: [{ keyHash: 'a', client: 'c', at: 1, serverKey: 's' }] }))
      .toEqual({ enabled: true, approved: [{ keyHash: 'a', client: 'c', at: 1, serverKey: 's' }] })
  })
  it('parse bỏ mục thiếu serverKey', () => {
    expect(parseBridgeSettings({ enabled: true, approved: [{ keyHash: 'a', client: 'c', at: 1 }] }).approved).toEqual([])
  })
  it('readBridgeSettings: không có khoá → tắt', async () => {
    expect(await readBridgeSettings(fakeStore())).toEqual({ enabled: false, approved: [] })
  })
  it('addApproved thay entry cùng keyHash', async () => {
    const s = fakeStore({ [BRIDGE_STORAGE_KEY]: { enabled: true, approved: [{ keyHash: 'a', client: 'old', at: 1, serverKey: 's' }] } })
    await addApproved(s, { keyHash: 'a', client: 'new', at: 2, serverKey: 's' })
    await addApproved(s, { keyHash: 'b', client: 'b', at: 3, serverKey: 's' })
    const r = await readBridgeSettings(s)
    expect(r.enabled).toBe(true)
    expect(r.approved).toEqual([{ keyHash: 'a', client: 'new', at: 2, serverKey: 's' }, { keyHash: 'b', client: 'b', at: 3, serverKey: 's' }])
  })
  it('removeApproved', async () => {
    const s = fakeStore({ [BRIDGE_STORAGE_KEY]: { enabled: true, approved: [{ keyHash: 'a', client: 'c', at: 1, serverKey: 's' }] } })
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

describe('parsePairDecision', () => {
  const k = 'a'.repeat(64)
  const ok = { type: PAIR_DECISION_MSG, port: 0, allow: true, keyHash: k }
  it('hợp lệ → object đúng; sai → null', async () => {
    const { BRIDGE_PORTS } = await import('@md-reader/core/bridge')
    const port = BRIDGE_PORTS[0]
    expect(parsePairDecision({ ...ok, port })).toEqual({ type: PAIR_DECISION_MSG, port, allow: true, keyHash: k })
    expect(parsePairDecision({ ...ok, port: 1 })).toBeNull()
    expect(parsePairDecision({ ...ok, port, keyHash: 'xyz' })).toBeNull()
    expect(parsePairDecision({ ...ok, port, keyHash: 'A'.repeat(64) })).toBeNull()
    expect(parsePairDecision({ ...ok, port, allow: 'yes' })).toBeNull()
    expect(parsePairDecision(null)).toBeNull()
  })
})

describe('loadOrCreateExtKey', () => {
  it('(f) lần 2 trả cùng publicKey; hỏng → tạo mới', async () => {
    const s = fakeStore()
    const a = await loadOrCreateExtKey(s)
    const b = await loadOrCreateExtKey(s)
    expect(b.publicKey).toBe(a.publicKey)
    expect(b.privateKey.type).toBe('private')
    s.data[BRIDGE_KEY_STORAGE] = { junk: true }
    const c = await loadOrCreateExtKey(s)
    expect(c.publicKey).not.toBe(a.publicKey)
    expect((await loadOrCreateExtKey(s)).publicKey).toBe(c.publicKey)
  })
})

const H1 = 'a'.repeat(64)
const H2 = 'b'.repeat(64)

describe('pairPolicy', () => {
  const base = { pinned: 'unknown' as const, asked: false, manual: false, recentlyRevoked: false }
  it('bảng nhánh', () => {
    expect(pairPolicy({ ...base, pinned: 'other', manual: true })).toBe('silent')
    expect(pairPolicy({ ...base, manual: true, asked: true })).toBe('ask')
    expect(pairPolicy({ ...base, manual: true, recentlyRevoked: true })).toBe('ask')
    expect(pairPolicy({ ...base, recentlyRevoked: true })).toBe('silent')
    expect(pairPolicy({ ...base, asked: true })).toBe('silent')
    for (const pinned of ['unknown', 'none', 'self'] as const) expect(pairPolicy({ ...base, pinned })).toBe('ask')
  })
})

describe('asked', () => {
  it('parseAsked bỏ rác', () => {
    expect(parseAsked(null)).toEqual({})
    expect(parseAsked('x')).toEqual({})
    expect(parseAsked({ bad: { at: 1 }, [H1]: { at: 'x' }, [H2]: { at: 5, rejected: 'yes' } })).toEqual({ [H2]: { at: 5 } })
    expect(parseAsked({ [H1]: { at: 5, rejected: true } })).toEqual({ [H1]: { at: 5, rejected: true } })
  })
  it('readAsked trống', async () => { expect(await readAsked(fakeStore())).toEqual({}) })
  it('markAsked giữ rejected cũ, ghi đè khi truyền', async () => {
    const s = fakeStore()
    await markAsked(s, H1, 1, true)
    await markAsked(s, H1, 2)
    expect(await readAsked(s)).toEqual({ [H1]: { at: 2, rejected: true } })
    await markAsked(s, H1, 3, false)
    expect((await readAsked(s))[H1]).toEqual({ at: 3 })
    expect('rejected' in (s.data[BRIDGE_ASKED_KEY] as any)[H1]).toBe(false)
  })
  it('cắt còn 20 mục mới nhất', async () => {
    const s = fakeStore()
    const hs = Array.from({ length: ASKED_MAX + 1 }, (_, i) => i.toString(16).padStart(64, '0'))
    for (let i = 0; i < hs.length; i++) await markAsked(s, hs[i]!, i + 1)
    const m = await readAsked(s)
    expect(Object.keys(m)).toHaveLength(ASKED_MAX)
    expect(m[hs[0]!]).toBeUndefined()
    expect(m[hs[ASKED_MAX]!]).toBeDefined()
  })
})

describe('seen', () => {
  const sv = (o: Partial<SeenServer> = {}): SeenServer => ({ keyHash: H1, client: 'c', port: 47821, pinned: 'none', rejected: false, at: 100, ...o })
  it('parseSeen bỏ rác', () => {
    expect(parseSeen({})).toEqual([])
    expect(parseSeen([sv(), { ...sv(), keyHash: 'x' }, { ...sv(), port: 1.5 }, { ...sv(), pinned: 'z' }, { ...sv(), rejected: 1 }, { ...sv(), at: NaN }, null, { ...sv(), client: 3 }])).toEqual([sv()])
  })
  it('upsert thay mục trùng, thêm cuối', async () => {
    const s = fakeStore()
    await upsertSeen(s, sv())
    await upsertSeen(s, sv({ keyHash: H2 }))
    await upsertSeen(s, sv({ client: 'd' }))
    const r = await readSeen(s)
    expect(r.map((x) => x.client)).toEqual(['d', 'c'])
    expect(r.map((x) => x.keyHash)).toEqual([H1, H2])
  })
  it('removeSeen', async () => {
    const s = fakeStore()
    await upsertSeen(s, sv()); await upsertSeen(s, sv({ keyHash: H2 }))
    await removeSeen(s, H1)
    expect((await readSeen(s)).map((x) => x.keyHash)).toEqual([H2])
  })
  it('pruneSeen bỏ mục quá TTL, giữ mục mới, không ghi khi không đổi', async () => {
    const now = 10_000_000
    const s = fakeStore()
    await upsertSeen(s, sv({ at: now - SEEN_TTL_MS - 1 }))
    await upsertSeen(s, sv({ keyHash: H2, at: now - 1000 }))
    await pruneSeen(s, now)
    expect((await readSeen(s)).map((x) => x.keyHash)).toEqual([H2])
    const before = s.data[BRIDGE_SEEN_KEY]
    await pruneSeen(s, now)
    expect(s.data[BRIDGE_SEEN_KEY]).toBe(before)
  })
})

describe('parseConnectMsg', () => {
  it('nhận đúng, chặn sai', () => {
    expect(parseConnectMsg({ type: BRIDGE_CONNECT_MSG, keyHash: H1 })).toEqual({ type: BRIDGE_CONNECT_MSG, keyHash: H1 })
    expect(parseConnectMsg({ type: BRIDGE_CONNECT_MSG, keyHash: 'zz' })).toBeNull()
    expect(parseConnectMsg({ type: 'other', keyHash: H1 })).toBeNull()
    expect(parseConnectMsg(null)).toBeNull()
  })
})
