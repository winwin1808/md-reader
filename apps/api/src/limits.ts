import type { LimitErrorCode } from '@md-reader/core'
import { hashToken } from './tokens.js'

export const LIMITS = {
  roomsPerInstallPerDay: 20,
  roomsPerIpPerDay: 50,
  roomsGlobalPerDay: 500,
  liveRoomsPerInstall: 200,
  assetsPerInstallPerDay: 100,
  assetBytesPerInstall: 200 * 1024 * 1024,
  assetsPerIpPerDay: 100,
  assetBytesPerIpPerDay: 200 * 1024 * 1024,
  reportsPerIpPerDay: 10,
  assetBytesGlobalStored: 3 * 1024 ** 3,
  assetBytesGlobalPerDay: 1024 ** 3,
} as const

export type LimitKind = 'room' | 'asset' | 'report'
export interface LimitSubject {
  installHash: string | null
  ipHash: string
}
export type LimitVerdict = null | { error: LimitErrorCode; retryAfter?: number }

export interface LimitStore {
  check(kind: LimitKind, s: LimitSubject, info?: { roomId?: string; bytes?: number }): Promise<LimitVerdict>
  record(kind: LimitKind, s: LimitSubject, info: { roomId: string; bytes?: number }): Promise<void>
  forgetRoom(roomId: string): Promise<void>
  pruneUsage(beforeDay: number): Promise<number>
}

const DAY_MS = 86_400_000
export function dayOf(now: number): number {
  return Math.floor(now / DAY_MS)
}
export function secondsToNextDay(now: number): number {
  return Math.ceil(((dayOf(now) + 1) * DAY_MS - now) / 1000)
}

/** Normalise an IP into a quota subject: IPv4 as-is, IPv6 collapsed to its /64. */
export function ipSubject(ip: string): string {
  const raw = (ip ?? '').trim().toLowerCase()
  if (!raw) return 'unknown'
  if (!raw.includes(':')) return /^\d{1,3}(\.\d{1,3}){3}$/.test(raw) ? raw : 'unknown'
  const mapped = /^(?:0{0,4}:){2,5}ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw)
  if (mapped) return mapped[1]!
  const halves = raw.split('::')
  if (halves.length > 2) return 'unknown'
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  let groups: string[]
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length
    if (fill < 1) return 'unknown'
    groups = [...head, ...Array<string>(fill).fill('0'), ...tail]
  } else groups = head
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return 'unknown'
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64'
}

export async function subjectFrom(req: Request): Promise<LimitSubject> {
  const inst = req.headers.get('x-mdr-install')
  const installHash = inst && inst.length >= 16 && inst.length <= 200 ? await hashToken(inst) : null
  const ipHash = await hashToken(ipSubject(req.headers.get('CF-Connecting-IP') ?? ''))
  return { installHash, ipHash }
}

type Scope = 'global' | 'ip' | 'install'

/** Shared decision logic over abstract counters. */
interface Counters {
  count(scope: Scope, subject: string, kind: string): Promise<number>
  liveRooms(installHash: string): Promise<number>
  roomInstall(roomId: string): Promise<string | null>
  installBytes(installHash: string): Promise<number>
  totalAssetBytes(): Promise<number>
}

async function decide(
  c: Counters,
  now: number,
  kind: LimitKind,
  s: LimitSubject,
  info?: { roomId?: string; bytes?: number },
): Promise<LimitVerdict> {
  const rate = (): LimitVerdict => ({ error: 'RATE_LIMITED', retryAfter: secondsToNextDay(now) })
  if (kind === 'room') {
    if ((await c.count('global', '*', 'room')) >= LIMITS.roomsGlobalPerDay) return rate()
    if ((await c.count('ip', s.ipHash, 'room')) >= LIMITS.roomsPerIpPerDay) return rate()
    if (s.installHash) {
      if ((await c.count('install', s.installHash, 'room')) >= LIMITS.roomsPerInstallPerDay) return rate()
      if ((await c.liveRooms(s.installHash)) >= LIMITS.liveRoomsPerInstall) return { error: 'QUOTA_EXCEEDED' }
    }
    return null
  }
  if (kind === 'asset') {
    const bytes = info?.bytes ?? 0
    if ((await c.count('global', '*', 'asset_bytes')) + bytes > LIMITS.assetBytesGlobalPerDay) return rate()
    if ((await c.totalAssetBytes()) + bytes > LIMITS.assetBytesGlobalStored) return { error: 'QUOTA_EXCEEDED' }
    if (!info?.roomId) return null
    if ((await c.count('ip', s.ipHash, 'asset')) >= LIMITS.assetsPerIpPerDay) return rate()
    if ((await c.count('ip', s.ipHash, 'asset_bytes')) + (info.bytes ?? 0) > LIMITS.assetBytesPerIpPerDay) return rate()
    const owner = await c.roomInstall(info.roomId)
    if (!owner) return null
    if ((await c.count('install', owner, 'asset')) >= LIMITS.assetsPerInstallPerDay) return rate()
    if ((await c.installBytes(owner)) + (info.bytes ?? 0) > LIMITS.assetBytesPerInstall) return { error: 'QUOTA_EXCEEDED' }
    return null
  }
  if ((await c.count('ip', s.ipHash, 'report')) >= LIMITS.reportsPerIpPerDay) return rate()
  return null
}

export class MemoryLimitStore implements LimitStore {
  private usage = new Map<string, number>()
  private rooms = new Map<string, { install: string; bytes: number }>()
  private assetBytesByRoom = new Map<string, number>()
  constructor(private now: () => number = Date.now) {}

  private key(scope: Scope, subject: string, kind: string): string {
    return `${scope}|${subject}|${dayOf(this.now())}|${kind}`
  }
  private bump(scope: Scope, subject: string, kind: string, n = 1): void {
    const k = this.key(scope, subject, kind)
    this.usage.set(k, (this.usage.get(k) ?? 0) + n)
  }

  check(kind: LimitKind, s: LimitSubject, info?: { roomId?: string; bytes?: number }): Promise<LimitVerdict> {
    return decide(
      {
        count: async (scope, subject, k) => this.usage.get(this.key(scope, subject, k)) ?? 0,
        liveRooms: async (h) => [...this.rooms.values()].filter((r) => r.install === h).length,
        roomInstall: async (id) => this.rooms.get(id)?.install ?? null,
        installBytes: async (h) =>
          [...this.rooms.values()].filter((r) => r.install === h).reduce((a, r) => a + r.bytes, 0),
        totalAssetBytes: async () => [...this.assetBytesByRoom.values()].reduce((a, b) => a + b, 0),
      },
      this.now(),
      kind,
      s,
      info,
    )
  }

  async pruneUsage(beforeDay: number): Promise<number> {
    let n = 0
    for (const k of [...this.usage.keys()]) {
      if (Number(k.split('|')[2]) < beforeDay) {
        this.usage.delete(k)
        n++
      }
    }
    return n
  }

  async forgetRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId)
    this.assetBytesByRoom.delete(roomId)
  }

  async record(kind: LimitKind, s: LimitSubject, info: { roomId: string; bytes?: number }): Promise<void> {
    if (kind === 'room') {
      this.bump('global', '*', 'room')
      this.bump('ip', s.ipHash, 'room')
      if (s.installHash) {
        this.bump('install', s.installHash, 'room')
        this.rooms.set(info.roomId, { install: s.installHash, bytes: 0 })
      }
    } else if (kind === 'asset') {
      this.bump('ip', s.ipHash, 'asset')
      this.bump('ip', s.ipHash, 'asset_bytes', info.bytes ?? 0)
      this.bump('global', '*', 'asset_bytes', info.bytes ?? 0)
      this.assetBytesByRoom.set(info.roomId, (this.assetBytesByRoom.get(info.roomId) ?? 0) + (info.bytes ?? 0))
      const r = this.rooms.get(info.roomId)
      if (r) {
        this.bump('install', r.install, 'asset')
        r.bytes += info.bytes ?? 0
      }
    } else {
      this.bump('ip', s.ipHash, 'report')
    }
  }
}

const UPSERT =
  'INSERT INTO usage_daily (scope,subject,day,kind,n) VALUES (?,?,?,?,?) ON CONFLICT(scope,subject,day,kind) DO UPDATE SET n = n + excluded.n'

export const TOTAL_CACHE_MS = 5 * 60_000
const totalCache = new WeakMap<object, { value: number; at: number }>()

export class D1LimitStore implements LimitStore {
  constructor(
    private db: D1Database,
    private now: () => number = Date.now,
  ) {}

  private async num(sql: string, ...args: unknown[]): Promise<number> {
    const row = await this.db.prepare(sql).bind(...args).first<{ v: number | null }>()
    return row?.v ?? 0
  }
  private bump(scope: Scope, subject: string, kind: string, n = 1): D1PreparedStatement {
    return this.db.prepare(UPSERT).bind(scope, subject, dayOf(this.now()), kind, n)
  }

  check(kind: LimitKind, s: LimitSubject, info?: { roomId?: string; bytes?: number }): Promise<LimitVerdict> {
    const day = dayOf(this.now())
    return decide(
      {
        count: (scope, subject, k) =>
          this.num('SELECT n AS v FROM usage_daily WHERE scope=? AND subject=? AND day=? AND kind=?', scope, subject, day, k),
        liveRooms: (h) => this.num('SELECT COUNT(*) AS v FROM room_installs WHERE install_hash=?', h),
        roomInstall: async (id) => {
          const r = await this.db
            .prepare('SELECT install_hash AS h FROM room_installs WHERE room_id=?')
            .bind(id)
            .first<{ h: string }>()
          return r?.h ?? null
        },
        installBytes: (h) => this.num('SELECT SUM(bytes) AS v FROM room_installs WHERE install_hash=?', h),
        totalAssetBytes: async () => {
          const c = totalCache.get(this.db)
          const t = this.now()
          if (c && t - c.at >= 0 && t - c.at < TOTAL_CACHE_MS) return c.value
          const value = await this.num('SELECT COALESCE(SUM(size),0) AS v FROM assets')
          totalCache.set(this.db, { value, at: t })
          return value
        },
      },
      this.now(),
      kind,
      s,
      info,
    )
  }

  async pruneUsage(beforeDay: number): Promise<number> {
    const res = await this.db.prepare('DELETE FROM usage_daily WHERE day < ?').bind(beforeDay).run()
    return res.meta?.changes ?? 0
  }

  async forgetRoom(roomId: string): Promise<void> {
    await this.db.prepare('DELETE FROM room_installs WHERE room_id = ?').bind(roomId).run()
  }

  async record(kind: LimitKind, s: LimitSubject, info: { roomId: string; bytes?: number }): Promise<void> {
    const stmts: D1PreparedStatement[] = []
    if (kind === 'room') {
      stmts.push(this.bump('global', '*', 'room'), this.bump('ip', s.ipHash, 'room'))
      if (s.installHash) {
        stmts.push(
          this.bump('install', s.installHash, 'room'),
          this.db
            .prepare('INSERT OR IGNORE INTO room_installs (room_id, install_hash, bytes) VALUES (?,?,0)')
            .bind(info.roomId, s.installHash),
        )
      }
    } else if (kind === 'asset') {
      const r = await this.db
        .prepare('SELECT install_hash AS h FROM room_installs WHERE room_id=?')
        .bind(info.roomId)
        .first<{ h: string }>()
      stmts.push(
        this.bump('ip', s.ipHash, 'asset'),
        this.bump('ip', s.ipHash, 'asset_bytes', info.bytes ?? 0),
        this.bump('global', '*', 'asset_bytes', info.bytes ?? 0),
      )
      if (r) {
        stmts.push(
          this.bump('install', r.h, 'asset'),
          this.db.prepare('UPDATE room_installs SET bytes = bytes + ? WHERE room_id=?').bind(info.bytes ?? 0, info.roomId),
        )
      }
    } else {
      stmts.push(this.bump('ip', s.ipHash, 'report'))
    }
    if (stmts.length) await this.db.batch(stmts)
    if (kind === 'asset') {
      const c = totalCache.get(this.db)
      if (c) c.value += info.bytes ?? 0
    }
  }
}
