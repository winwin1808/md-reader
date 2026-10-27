import * as Y from 'yjs'
import type { Connection, ConnectionContext } from 'partyserver'
import { YServer } from 'y-partyserver'
import type { Env } from './env.js'
import { classifyMessage, sanitizeAwarenessMessage } from './protocol'
import { appendUpdate, compact, loadState, readStats, shouldCompact, type KVLike, type LogStats } from './persistence.js'

export const MAX_MESSAGE_BYTES = 16 * 1024 * 1024
export const MAX_ROOM_BYTES = 64 * 1024 * 1024
export const MAX_AWARENESS_IDS_PER_CONN = 4
// Browsers throttle timers in hidden tabs to ~1/min, so 2 min exceeds one throttled renew cycle.
export const AWARENESS_STALE_MS = 120_000

export class DocRoom extends YServer<Env> {
  static callbackOptions = { debounceWait: 2000, debounceMaxWait: 10000, timeout: 5000 }

  private stats: LogStats = { updates: 0, bytes: 0 }
  private queue: Promise<unknown> = Promise.resolve()
  private purged = false
  private roomBytes = 0
  private revoked = new Set<string>()
  private awarenessOwner = new Map<number, string>()
  private lastSeen = new Map<string, number>()

  private get kv(): KVLike {
    const s = this.ctx.storage
    return {
      get: (k) => s.get<Uint8Array | string>(k),
      put: (k, v) => s.put(k, v),
      delete: (k) => s.delete(k),
      list: (o) => s.list<Uint8Array | string>({ prefix: o.prefix }),
    }
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const p = this.queue.then(work)
    this.queue = p.catch(() => undefined)
    return p
  }

  private async doCompact(): Promise<void> {
    const r = await compact(this.kv, this.document)
    this.stats = { updates: r.updates, bytes: r.bytes }
    this.roomBytes = r.stateBytes
  }

  private persistUpdate(u: Uint8Array): Promise<void> {
    if (this.purged) return Promise.resolve()
    return this.enqueue(async () => {
      if (this.purged) return
      this.stats = await appendUpdate(this.kv, u, this.stats)
      if (shouldCompact(this.stats, false)) await this.doCompact()
    })
  }

  async purge(): Promise<void> {
    this.purged = true
    for (const c of [...this.getConnections()]) c.close(4410, 'deleted')
    await this.queue
    try {
      await this.ctx.storage.deleteAlarm()
    } catch (e) {
      console.error('deleteAlarm failed', e)
    }
    await this.ctx.storage.deleteAll()
    await this.ctx.storage.put('tombstone', 1)
  }

  async onLoad(): Promise<void> {
    if (await this.ctx.storage.get('tombstone')) {
      this.purged = true
      return
    }
    for (const k of (await this.ctx.storage.list({ prefix: 'revoked:' })).keys()) this.revoked.add(k.slice('revoked:'.length))
    this.stats = await readStats(this.kv)
    const state = await loadState(this.kv)
    if (state) Y.applyUpdate(this.document, state)
    this.roomBytes = state ? state.length : 0
    this.document.on('update', (u: Uint8Array) => {
      this.roomBytes += u.length
      void this.persistUpdate(u).catch((e) => console.error('persist failed', e))
    })
  }

  async onSave(): Promise<void> {
    if (this.purged) return
    await this.enqueue(async () => {
      if (this.purged) return
      const empty = [...this.getConnections()].length === 0
      if (shouldCompact(this.stats, empty)) await this.doCompact()
    })
  }

  private compactIfEmpty(closing: Connection): void {
    const others = [...this.getConnections()].filter((c) => c.id !== closing.id)
    if (this.purged || others.length > 0 || this.stats.updates === 0) return
    void this.enqueue(async () => {
      if (!this.purged && this.stats.updates > 0) await this.doCompact()
    }).catch((e) => console.error('compact failed', e))
  }

  async onClose(conn: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    for (const [id, owner] of [...this.awarenessOwner]) if (owner === conn.id) this.awarenessOwner.delete(id)
    this.lastSeen.delete(conn.id)
    await super.onClose(conn, code, reason, wasClean)
    this.compactIfEmpty(conn)
  }

  async onError(conn: Connection, error: unknown): Promise<void> {
    await super.onError(conn, error)
    this.compactIfEmpty(conn)
  }

  onConnect(conn: Connection, ctx: ConnectionContext): void {
    if (this.purged) {
      conn.close(4410, 'deleted')
      return
    }
    const h = ctx.request.headers
    const role = h.get('x-mdr-role') ?? 'view'
    const prefix = h.get('x-mdr-prefix') ?? ''
    const exp = h.get('x-mdr-expires')
    if (exp && !/^\d{1,15}$/.test(exp)) {
      conn.close(4410, 'revoked')
      return
    }
    const expiresAt = exp ? Number(exp) : undefined
    if ((prefix && this.revoked.has(prefix)) || (expiresAt !== undefined && expiresAt <= Date.now())) {
      conn.close(4410, 'revoked')
      return
    }
    conn.setState({ role, prefix, expiresAt })
    if (expiresAt !== undefined) void this.scheduleExpiry(expiresAt).catch((e) => console.error('setAlarm failed', e))
    super.onConnect(conn, ctx)
  }

  private async scheduleExpiry(t: number): Promise<void> {
    const cur = await this.ctx.storage.getAlarm()
    if (cur === null || cur === undefined || cur > t) await this.ctx.storage.setAlarm(t)
  }

  async onAlarm(): Promise<void> {
    if (this.purged) return
    await super.onAlarm?.()
    const now = Date.now()
    let next: number | undefined
    for (const c of [...this.getConnections()]) {
      const t = (c.state as { expiresAt?: number } | null)?.expiresAt
      if (t === undefined) continue
      if (t <= now) c.close(4410, 'expired')
      else if (next === undefined || t < next) next = t
    }
    if (next !== undefined) await this.ctx.storage.setAlarm(next)
  }

  droppedWrites = 0

  isReadOnly(conn: Connection): boolean {
    return (conn.state as { role?: string } | null)?.role !== 'edit'
  }

  handleMessage(conn: Connection, message: string | ArrayBuffer | ArrayBufferView): void {
    if (this.purged) return
    const st = conn.state as { prefix?: string; expiresAt?: number } | null
    if ((st?.expiresAt !== undefined && st.expiresAt <= Date.now()) || (st?.prefix && this.revoked.has(st.prefix))) {
      conn.close(4410, 'revoked')
      return
    }
    const now = Date.now()
    this.lastSeen.set(conn.id, now)
    const size = typeof message === 'string' ? message.length : message.byteLength
    if (size > MAX_MESSAGE_BYTES) {
      conn.close(1009, 'too large')
      return
    }
    if (typeof message === 'string') return super.handleMessage(conn, message)
    const bytes =
      message instanceof Uint8Array
        ? message
        : message instanceof ArrayBuffer
          ? new Uint8Array(message)
          : new Uint8Array(message.buffer, message.byteOffset, message.byteLength)
    const k = classifyMessage(bytes)
    if ((k === 'step2' || k === 'update') && this.isReadOnly(conn)) {
      this.droppedWrites++
      return
    }
    if ((k === 'step2' || k === 'update') && this.roomBytes >= MAX_ROOM_BYTES) {
      this.droppedWrites++
      conn.close(4413, 'room full')
      return
    }
    if (k === 'awareness') {
      const s = sanitizeAwarenessMessage(bytes, (id, removal) => {
        const owner = this.awarenessOwner.get(id)
        if (owner === conn.id) return true
        if (owner === undefined && removal) return false
        if (owner !== undefined && now - (this.lastSeen.get(owner) ?? 0) <= AWARENESS_STALE_MS) return false
        let held = 0
        for (const o of this.awarenessOwner.values()) if (o === conn.id) held++
        if (held >= MAX_AWARENESS_IDS_PER_CONN) return false
        this.awarenessOwner.set(id, conn.id)
        return true
      })
      if (!s) return
      return super.handleMessage(conn, s)
    }
    return super.handleMessage(conn, message)
  }

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (req.method === 'POST' && req.headers.get('x-mdr-internal') === '1' && url.pathname.endsWith('/purge')) {
      await this.purge()
      return new Response(null, { status: 204 })
    }
    if (req.method === 'POST' && req.headers.get('x-mdr-internal') === '1' && url.pathname.endsWith('/revoke')) {
      const body = (await req.json().catch(() => null)) as { prefix?: unknown } | null
      const prefix = body?.prefix
      if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 32) return new Response('bad request', { status: 400 })
      this.revoked.add(prefix)
      await this.ctx.storage.put('revoked:' + prefix, Date.now())
      for (const c of [...this.getConnections()]) {
        if ((c.state as { prefix?: string } | null)?.prefix === prefix) c.close(4410, 'revoked')
      }
      return new Response(null, { status: 204 })
    }
    if (this.purged && url.pathname.endsWith('/snapshot')) return new Response('gone', { status: 410 })
    if (req.method === 'GET' && req.headers.get('x-mdr-internal') === '1' && url.pathname.endsWith('/snapshot')) {
      return new Response(Y.encodeStateAsUpdate(this.document) as unknown as BodyInit, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      })
    }
    return new Response('not found', { status: 404 })
  }
}
