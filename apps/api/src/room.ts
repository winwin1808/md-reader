import * as Y from 'yjs'
import type { Connection, ConnectionContext } from 'partyserver'
import { YServer } from 'y-partyserver'
import type { Env } from './env.js'
import { classifyMessage, sanitizeAwarenessMessage } from './protocol'
import { appendUpdate, compact, loadState, readStats, shouldCompact, type KVLike, type LogStats } from './persistence.js'

export class DocRoom extends YServer<Env> {
  static callbackOptions = { debounceWait: 2000, debounceMaxWait: 10000, timeout: 5000 }

  private stats: LogStats = { updates: 0, bytes: 0 }
  private queue: Promise<unknown> = Promise.resolve()

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

  private persistUpdate(u: Uint8Array): Promise<void> {
    return this.enqueue(async () => {
      this.stats = await appendUpdate(this.kv, u, this.stats)
      if (shouldCompact(this.stats, false)) this.stats = await compact(this.kv, this.document)
    })
  }

  async onLoad(): Promise<void> {
    this.stats = await readStats(this.kv)
    const state = await loadState(this.kv)
    if (state) Y.applyUpdate(this.document, state)
    this.document.on('update', (u: Uint8Array) => {
      void this.persistUpdate(u).catch((e) => console.error('persist failed', e))
    })
  }

  async onSave(): Promise<void> {
    await this.enqueue(async () => {
      const empty = [...this.getConnections()].length === 0
      if (shouldCompact(this.stats, empty)) this.stats = await compact(this.kv, this.document)
    })
  }

  private compactIfEmpty(closing: Connection): void {
    const others = [...this.getConnections()].filter((c) => c.id !== closing.id)
    if (others.length > 0 || this.stats.updates === 0) return
    void this.enqueue(async () => {
      if (this.stats.updates > 0) this.stats = await compact(this.kv, this.document)
    }).catch((e) => console.error('compact failed', e))
  }

  async onClose(conn: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    await super.onClose(conn, code, reason, wasClean)
    this.compactIfEmpty(conn)
  }

  async onError(conn: Connection, error: unknown): Promise<void> {
    await super.onError(conn, error)
    this.compactIfEmpty(conn)
  }

  onConnect(conn: Connection, ctx: ConnectionContext): void {
    const role = ctx.request.headers.get('x-mdr-role') ?? 'view'
    conn.setState({ role })
    super.onConnect(conn, ctx)
  }

  droppedWrites = 0

  isReadOnly(conn: Connection): boolean {
    return (conn.state as { role?: string } | null)?.role !== 'edit'
  }

  handleMessage(conn: Connection, message: string | ArrayBuffer | ArrayBufferView): void {
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
    if (k === 'awareness') {
      const s = sanitizeAwarenessMessage(bytes)
      if (!s) return
      return super.handleMessage(conn, s)
    }
    return super.handleMessage(conn, message)
  }

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (req.method === 'GET' && req.headers.get('x-mdr-internal') === '1' && url.pathname.endsWith('/snapshot')) {
      return new Response(Y.encodeStateAsUpdate(this.document) as unknown as BodyInit, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      })
    }
    return new Response('not found', { status: 404 })
  }
}
