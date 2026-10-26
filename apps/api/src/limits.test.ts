import { describe, expect, it } from 'vitest'
import { LIMITS, MemoryLimitStore, dayOf, secondsToNextDay, subjectFrom } from './limits.js'

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
    expect(await st.check('asset', S, { roomId: 'nope', bytes: 999 * MB })).toBeNull()
    await st.record('room', S, { roomId: 'r1' })
    await st.record('asset', S, { roomId: 'r1', bytes: 150 * MB })
    expect(await st.check('asset', S, { roomId: 'r1', bytes: 50 * MB })).toBeNull()
    expect(await st.check('asset', S, { roomId: 'r1', bytes: 50 * MB + 1 })).toEqual({ error: 'QUOTA_EXCEEDED' })
    const c = new MemoryLimitStore(() => 0)
    await c.record('room', S, { roomId: 'r2' })
    for (let i = 0; i < LIMITS.assetsPerInstallPerDay; i++) await c.record('asset', S, { roomId: 'r2', bytes: 1 })
    expect((await c.check('asset', S, { roomId: 'r2', bytes: 1 }))?.error).toBe('RATE_LIMITED')
  })

  it('report: 10 per ip per day', async () => {
    const st = new MemoryLimitStore(() => 0)
    for (let i = 0; i < LIMITS.reportsPerIpPerDay; i++) await st.record('report', S, { roomId: 'r' })
    expect((await st.check('report', S))?.error).toBe('RATE_LIMITED')
    expect(await st.check('report', { installHash: null, ipHash: 'other' })).toBeNull()
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
