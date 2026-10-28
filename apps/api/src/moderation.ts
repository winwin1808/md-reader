export const MAX_REASON = 500

export interface ModerationStore {
  addReport(r: { roomId: string; reason: string; ipHash: string }): Promise<void>
  addTakedown(roomId: string): Promise<void>
}

export class MemoryModerationStore implements ModerationStore {
  readonly reports: Array<{ roomId: string; reason: string; ipHash: string; createdAt: number }> = []
  readonly takedowns = new Map<string, number>()
  constructor(private now: () => number = Date.now) {}
  async addReport(r: { roomId: string; reason: string; ipHash: string }): Promise<void> {
    this.reports.push({ ...r, createdAt: this.now() })
  }
  async addTakedown(roomId: string): Promise<void> {
    if (!this.takedowns.has(roomId)) this.takedowns.set(roomId, this.now())
  }
}

export class D1ModerationStore implements ModerationStore {
  constructor(private db: D1Database, private now: () => number = Date.now) {}
  async addReport(r: { roomId: string; reason: string; ipHash: string }): Promise<void> {
    await this.db
      .prepare('INSERT INTO reports (room_id, reason, ip_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(r.roomId, r.reason, r.ipHash, this.now())
      .run()
  }
  async addTakedown(roomId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('INSERT OR IGNORE INTO takedowns (room_id, created_at) VALUES (?, ?)').bind(roomId, this.now()),
    ])
  }
}

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
}

export async function adminAuthorized(req: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false
  const m = /^Bearer (.*)$/.exec(req.headers.get('authorization') ?? '')
  if (!m) return false
  const [a, b] = await Promise.all([sha256(m[1] ?? ''), sha256(secret)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}
