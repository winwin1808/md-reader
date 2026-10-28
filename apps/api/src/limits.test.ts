import { describe, expect, it } from 'vitest'
import { LIMITS, D1LimitStore, MemoryLimitStore, dayOf, ipSubject, secondsToNextDay, subjectFrom } from './limits.js'

const S = { installHash: 'i1', ipHash: 'ip1' }
const MB = 1024 * 1024

describe('LimitStore (memory)', () => {
  it('dayOf / secondsToNextDay', () => {
    expect(dayOf(86_400_000 * 3 + 5)).toBe(3)
    expect(secondsToNextDay(86_400_000 - 1500)).toBe(2)
  })

  it('install rate limit after 20 rooms, with retryAfter', async () => {
    let now = 1000
    const st = new MemoryLimitStore(() => now)
    for (let i = 0; i < LIMITS.roomsPerInstallPerDay; i++) {
      expect(await st.check('room', S)).toBeNull()
      await st.record('room', S, { roomId: `r${i}` })
    }
    const v = await st.check('room', S)
    expect(v).toEqual({ error: 'RATE_LIMITED', retryAfter: secondsToNextDay(now) })
    now += 86_400_000
    expect(await st.check('room', S)).toBeNull()
  })

  it('ip limit applies without install; global limit', async () => {
    const st = new MemoryLimitStore(() => 0)
    for (let i = 0; i < LIMITS.roomsPerIpPerDay; i++) await st.record('room', { installHash: null, ipHash: 'x' }, { roomId: `a${i}` })
    expect((await st.check('room', { installHash: null, ipHash: 'x' }))?.error).toBe('RATE_LIMITED')
    const g = new MemoryLimitStore(() => 0)
    for (let i = 0; i < LIMITS.roomsGlobalPerDay; i++) await g.record('room', { installHash: null, ipHash: `ip${i}` }, { roomId: `g${i}` })
    expect((await g.check('room', { installHash: null, ipHash: 'new' }))?.error).toBe('RATE_LIMITED')
  })

  it('live rooms quota across days -> QUOTA_EXCEEDED without retryAfter', async () => {
    let now = 0
    const st = new MemoryLimitStore(() => now)
    for (let i = 0; i < LIMITS.liveRoomsPerInstall; i++) {
      await st.record('room', S, { roomId: `r${i}` })
      if (i % 10 === 9) now += 86_400_000
    }
    now += 86_400_000
    expect(await st.check('room', S)).toEqual({ error: 'QUOTA_EXCEEDED' })
  })

  it('asset: unknown room passes; bytes quota; daily count', async () => {
    const st = new MemoryLimitStore(() => 0)
    expect(await st.check('asset', S, { roomId: 'nope', bytes: 1 * MB })).toBeNull()
    await st.record('room', S, { roomId: 'r1' })
    await st.record('asset', { ...S, ipHash: 'other-ip' }, { roomId: 'r1', bytes: 150 * MB })
    expect(await st.check('asset', S, { roomId: 'r1', bytes: 50 * MB })).toBeNull()
    expect(await st.check('asset', S, { roomId: 'r1', bytes: 50 * MB + 1 })).toEqual({ error: 'QUOTA_EXCEEDED' })
    const c = new MemoryLimitStore(() => 0)
    await c.record('room', S, { roomId: 'r2' })
    for (let i = 0; i < LIMITS.assetsPerInstallPerDay; i++) await c.record('asset', { ...S, ipHash: `o${i}` }, { roomId: 'r2', bytes: 1 })
    expect((await c.check('asset', S, { roomId: 'r2', bytes: 1 }))?.error).toBe('RATE_LIMITED')
  })

  it('report: 10 per ip per day', async () => {
    const st = new MemoryLimitStore(() => 0)
    for (let i = 0; i < LIMITS.reportsPerIpPerDay; i++) await st.record('report', S, { roomId: 'r' })
    expect((await st.check('report', S))?.error).toBe('RATE_LIMITED')
    expect(await st.check('report', { installHash: null, ipHash: 'other' })).toBeNull()
  })
})

describe('LimitStore isolation and unlocked-room asset limits', () => {
  const A = { installHash: 'A', ipHash: 'ipA' }
  const B = { installHash: 'B', ipHash: 'ipB' }

  it('(a) uploader B into room of A spends the quota of A', async () => {
    const st = new MemoryLimitStore(() => 0)
    await st.record('room', A, { roomId: 'ra' })
    await st.record('room', B, { roomId: 'rb' })
    for (let i = 0; i < LIMITS.assetsPerInstallPerDay; i++) await st.record('asset', { ...B, ipHash: `o${i}` }, { roomId: 'ra', bytes: 1 })
    expect((await st.check('asset', B, { roomId: 'ra', bytes: 1 }))?.error).toBe('RATE_LIMITED')
    expect(await st.check('asset', B, { roomId: 'rb', bytes: 1 })).toBeNull()
  })

  it('(b) install A hitting daily and live limits does not affect install B', async () => {
    const st = new MemoryLimitStore(() => 0)
    for (let i = 0; i < LIMITS.roomsPerInstallPerDay; i++) await st.record('room', A, { roomId: `a${i}` })
    expect((await st.check('room', A))?.error).toBe('RATE_LIMITED')
    expect(await st.check('room', B)).toBeNull()
    let now = 0
    const lv = new MemoryLimitStore(() => now)
    for (let i = 0; i < LIMITS.liveRoomsPerInstall; i++) {
      await lv.record('room', A, { roomId: `l${i}` })
      if (i % 10 === 9) now += 86_400_000
    }
    now += 86_400_000
    expect(await lv.check('room', A)).toEqual({ error: 'QUOTA_EXCEEDED' })
    expect(await lv.check('room', B)).toBeNull()
  })

  it('(c) IP a hitting 50 rooms/day does not affect IP b', async () => {
    const st = new MemoryLimitStore(() => 0)
    const a = { installHash: null, ipHash: 'a' }
    for (let i = 0; i < LIMITS.roomsPerIpPerDay; i++) await st.record('room', a, { roomId: `r${i}` })
    expect((await st.check('room', a))?.error).toBe('RATE_LIMITED')
    expect(await st.check('room', { installHash: null, ipHash: 'b' })).toBeNull()
  })

  it('(d) unlocked room: 100 assets/day per IP, other IP free, bytes cap per IP', async () => {
    const st = new MemoryLimitStore(() => 0)
    const a = { installHash: null, ipHash: 'a' }
    const b = { installHash: null, ipHash: 'b' }
    for (let i = 0; i < LIMITS.assetsPerIpPerDay; i++) {
      expect(await st.check('asset', a, { roomId: 'free', bytes: 1 })).toBeNull()
      await st.record('asset', a, { roomId: 'free', bytes: 1 })
    }
    const v = await st.check('asset', a, { roomId: 'free', bytes: 1 })
    expect(v?.error).toBe('RATE_LIMITED')
    expect(v?.retryAfter).toBeGreaterThan(0)
    expect(await st.check('asset', b, { roomId: 'free', bytes: 1 })).toBeNull()
    const c = new MemoryLimitStore(() => 0)
    await c.record('asset', a, { roomId: 'free', bytes: 150 * MB })
    expect(await c.check('asset', a, { roomId: 'free', bytes: 50 * MB })).toBeNull()
    const over = await c.check('asset', a, { roomId: 'free', bytes: 50 * MB + 1 })
    expect(over?.error).toBe('RATE_LIMITED')
    expect(over?.retryAfter).toBeGreaterThan(0)
  })
})

describe('LimitStore.forgetRoom', () => {
  const X = { installHash: 'X', ipHash: 'ipX' }

  it('frees a live-room slot', async () => {
    let now = 0
    const st = new MemoryLimitStore(() => now)
    for (let i = 0; i < LIMITS.liveRoomsPerInstall; i++) {
      await st.record('room', X, { roomId: `r${i}` })
      if (i % 10 === 9) now += 86_400_000
    }
    now += 86_400_000
    expect(await st.check('room', X)).toEqual({ error: 'QUOTA_EXCEEDED' })
    await st.forgetRoom('r0')
    expect(await st.check('room', X)).toBeNull()
  })

  it('returns room bytes but keeps the daily asset counter', async () => {
    const st = new MemoryLimitStore(() => 0)
    await st.record('room', X, { roomId: 'r0' })
    await st.record('room', X, { roomId: 'r1' })
    const Y = { ...X, ipHash: 'fresh-ip' }
    await st.record('asset', Y, { roomId: 'r0', bytes: 150 * MB })
    expect(await st.check('asset', X, { roomId: 'r1', bytes: 100 * MB })).toEqual({ error: 'QUOTA_EXCEEDED' })
    await st.forgetRoom('r0')
    expect(await st.check('asset', X, { roomId: 'r1', bytes: 100 * MB })).toBeNull()
    for (let i = 0; i < LIMITS.assetsPerInstallPerDay - 1; i++) await st.record('asset', { ...X, ipHash: `o${i}` }, { roomId: 'r1', bytes: 1 })
    expect((await st.check('asset', X, { roomId: 'r1', bytes: 1 }))?.error).toBe('RATE_LIMITED')
  })
})

describe('subjectFrom', () => {
  it('hashes install header (16..200) and ip', async () => {
    const r = new Request('https://x/', { headers: { 'x-mdr-install': 'a'.repeat(20), 'CF-Connecting-IP': '1.2.3.4' } })
    const s = await subjectFrom(r)
    expect(s.installHash).toMatch(/^[0-9a-f]{64}$/)
    expect(s.ipHash).toMatch(/^[0-9a-f]{64}$/)
    expect(s.installHash).not.toContain('aaaa')
  })
  it('short/missing install -> null; missing ip hashes "unknown"', async () => {
    const a = await subjectFrom(new Request('https://x/', { headers: { 'x-mdr-install': 'short' } }))
    const b = await subjectFrom(new Request('https://x/'))
    expect(a.installHash).toBeNull()
    expect(b.installHash).toBeNull()
    expect(a.ipHash).toBe(b.ipHash)
  })
})

describe('11e: IP always counted, IPv6 /64', () => {
  it('(a) rotating install keys from one IP still hits the IP byte cap', async () => {
    const st = new MemoryLimitStore(() => 0)
    let verdict: unknown = null
    for (let i = 0; i < 10 && !verdict; i++) {
      const s = { installHash: `inst${i}`, ipHash: 'same-ip' }
      await st.record('room', s, { roomId: `r${i}` })
      verdict = await st.check('asset', s, { roomId: `r${i}`, bytes: 25 * MB })
      if (!verdict) await st.record('asset', s, { roomId: `r${i}`, bytes: 25 * MB })
    }
    expect(verdict).toMatchObject({ error: 'RATE_LIMITED' })
  })

  it('(b) record asset on an install room also bumps ip counters', async () => {
    const st = new MemoryLimitStore(() => 0)
    const s = { installHash: 'i1', ipHash: 'ipX' }
    await st.record('room', s, { roomId: 'r1' })
    await st.record('asset', s, { roomId: 'r1', bytes: 150 * MB })
    const other = { installHash: 'i2', ipHash: 'ipX' }
    await st.record('room', other, { roomId: 'r2' })
    expect(await st.check('asset', other, { roomId: 'r2', bytes: 50 * MB + 1 })).toMatchObject({ error: 'RATE_LIMITED' })
  })

  it('(c) ipSubject', () => {
    expect(ipSubject('2001:db8:1:2:aaaa::1')).toBe(ipSubject('2001:db8:1:2:bbbb::2'))
    expect(ipSubject('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64')
    expect(ipSubject('2001:db8:1:2:aaaa::1')).not.toBe(ipSubject('2001:db8:1:3::1'))
    expect(ipSubject('::ffff:1.2.3.4')).toBe('1.2.3.4')
    expect(ipSubject('1.2.3.4')).toBe('1.2.3.4')
    expect(ipSubject('')).toBe('unknown')
  })

  it('(d) subjectFrom groups same /64', async () => {
    const mk = (ip: string) => new Request('http://x', { headers: { 'CF-Connecting-IP': ip } })
    const a = await subjectFrom(mk('2001:db8:1:2:aaaa::1'))
    const b = await subjectFrom(mk('2001:db8:1:2:bbbb::2'))
    expect(a.ipHash).toBe(b.ipHash)
  })
})

describe('12c: global asset byte caps', () => {
  const GB = 1024 * MB
  it('global per-day exceeded -> rate even if ip/install have quota', async () => {
    const st = new MemoryLimitStore(() => 0)
    await st.record('room', S, { roomId: 'r1' })
    for (let i = 0; i < 5; i++) await st.record('asset', { installHash: null, ipHash: `g${i}` }, { roomId: `x${i}`, bytes: 200 * MB })
    expect(await st.check('asset', S, { roomId: 'r1', bytes: 24 * MB })).toBeNull()
    const v = await st.check('asset', S, { roomId: 'r1', bytes: 25 * MB })
    expect(v).toMatchObject({ error: 'RATE_LIMITED' })
    expect(v?.retryAfter).toBeGreaterThan(0)
  })
  it('total stored exceeded -> QUOTA_EXCEEDED; forgetRoom frees', async () => {
    let now = 0
    const st = new MemoryLimitStore(() => now)
    for (let i = 0; i < 3; i++) {
      await st.record('asset', { installHash: null, ipHash: `s${i}` }, { roomId: `big${i}`, bytes: 1000 * MB })
      now += 86_400_000
    }
    expect(await st.check('asset', S, { roomId: 'free', bytes: 100 * MB })).toEqual({ error: 'QUOTA_EXCEEDED' })
    expect(await st.check('asset', S, { roomId: 'free', bytes: 50 * MB })).toBeNull()
    await st.forgetRoom('big0')
    expect(await st.check('asset', S, { roomId: 'free', bytes: 100 * MB })).toBeNull()
    expect(LIMITS.assetBytesGlobalStored).toBe(3 * GB)
  })
  it('record adds global asset_bytes', async () => {
    const st = new MemoryLimitStore(() => 0)
    await st.record('asset', S, { roomId: 'a', bytes: 1000 * MB })
    expect(await st.check('asset', { installHash: null, ipHash: 'z' }, { roomId: 'a', bytes: 25 * MB })).toMatchObject({ error: 'RATE_LIMITED' })
  })
})

describe('pruneUsage', () => {
  it('removes old days, keeps recent', async () => {
    let now = 0
    const st = new MemoryLimitStore(() => now)
    await st.record('report', S, { roomId: 'r' })
    now = 5 * 86_400_000
    await st.record('report', S, { roomId: 'r' })
    expect(await st.pruneUsage(3)).toBe(1)
    expect(await st.check('report', S)).toBeNull()
    expect(await st.pruneUsage(3)).toBe(0)
  })
})

describe('14b: totalAssetBytes cache', () => {
  it('queries SUM once across uploads and still enforces the cap', async () => {
    let sums = 0
    const stored = 3 * 1024 ** 3 - 10
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            if (sql.includes('SUM(size)')) { sums++; return { v: stored } }
            return { v: 0 }
          },
        }),
      }),
      batch: async () => [],
    } as unknown as D1Database
    const st = new D1LimitStore(db, () => 1000)
    const S2 = { installHash: null, ipHash: 'h' }
    expect(await st.check('asset', S2, { bytes: 5 })).toBeNull()
    expect(await st.check('asset', S2, { bytes: 20 })).toEqual({ error: 'QUOTA_EXCEEDED' })
    expect(sums).toBe(1)
    await st.record('asset', S2, { roomId: 'r', bytes: 8 })
    expect(await st.check('asset', S2, { bytes: 5 })).toEqual({ error: 'QUOTA_EXCEEDED' })
    expect(sums).toBe(1)
  })
})
