import {
  BRIDGE_PORTS,
  BRIDGE_PROTOCOL,
  parseBridgeMessage,
  textHash,
  sanitizeClientName,
  type BridgeRequest,
  type BridgeResponse,
  type BridgeHello,
} from '@md-reader/core/bridge'

export const PING_MS = 20_000
export const IDLE_SCANS_BEFORE_BACKOFF = 10
const CONNECT_TIMEOUT_MS = 1000

export interface ApprovedClient { keyHash: string; client: string; at: number }
export interface BridgeConn { port: number; client: string; keyHash: string; state: 'pending' | 'paired' }
export interface WsLike {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: (() => void) | null
  onmessage: ((e: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}
export interface BridgeDeps {
  connect(url: string): WsLike
  approved(): Promise<ApprovedClient[]>
  requestPairing(c: { port: number; client: string; keyHash: string }): void
  execute(req: BridgeRequest, client: string): Promise<BridgeResponse>
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(h: unknown): void
}

interface Entry {
  ws: WsLike
  conn: BridgeConn
  hello: boolean
  pingTimer: unknown
}

export function createBridge(deps: BridgeDeps) {
  const entries = new Map<number, Entry>()
  const connecting = new Set<number>()
  let scanning: Promise<number> | null = null

  function drop(port: number, e: Entry) {
    if (entries.get(port) === e) entries.delete(port)
    if (e.pingTimer !== undefined) { deps.clearTimer(e.pingTimer); e.pingTimer = undefined }
  }

  function send(ws: WsLike, m: unknown) {
    try { ws.send(JSON.stringify(m)) } catch { /* socket gone */ }
  }

  async function onHello(e: Entry, h: BridgeHello) {
    if (e.hello) return
    e.hello = true
    const live = () => entries.get(e.conn.port) === e && e.ws.readyState < 2
    const keyHash = await textHash(h.pairKey)
    if (!live()) return
    e.conn.client = sanitizeClientName(h.client)
    e.conn.keyHash = keyHash
    const list = await deps.approved()
    if (!live()) return
    if (list.some((a) => a.keyHash === keyHash)) {
      e.conn.state = 'paired'
      send(e.ws, { type: 'welcome', paired: true })
    } else {
      e.conn.state = 'pending'
      send(e.ws, { type: 'welcome', paired: false })
      deps.requestPairing({ port: e.conn.port, client: e.conn.client, keyHash })
    }
  }

  async function onReq(e: Entry, req: BridgeRequest) {
    if (e.conn.state !== 'paired') return
    let res: BridgeResponse
    try {
      res = await deps.execute(req, e.conn.client)
    } catch (err) {
      res = { type: 'res', id: req.id, ok: false, error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) } }
    }
    send(e.ws, res)
  }

  function tryConnect(port: number): Promise<void> {
    if (connecting.has(port) || entries.has(port)) return Promise.resolve()
    connecting.add(port)
    return new Promise((resolve) => {
      let ws: WsLike
      try { ws = deps.connect(`ws://127.0.0.1:${port}`) } catch { connecting.delete(port); resolve(); return }
      const e: Entry = { ws, conn: { port, client: '', keyHash: '', state: 'pending' }, hello: false, pingTimer: undefined }
      let settled = false
      let timeout: unknown
      const settle = () => {
        if (settled) return
        settled = true
        connecting.delete(port)
        deps.clearTimer(timeout)
        resolve()
      }
      timeout = deps.setTimer(() => {
        if (settled) return
        try { ws.close() } catch { /* ignore */ }
        drop(port, e)
        settle()
      }, CONNECT_TIMEOUT_MS)
      ws.onopen = () => {
        if (settled) return
        entries.set(port, e)
        e.pingTimer = deps.setTimer(() => send(ws, { type: 'ping' }), PING_MS)
        settle()
      }
      ws.onerror = () => { drop(port, e); settle() }
      ws.onclose = () => { drop(port, e); settle() }
      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return
        const m = parseBridgeMessage(ev.data)
        if (!m) return
        if (m.type === 'hello') {
          if (m.protocol === BRIDGE_PROTOCOL) void onHello(e, m).catch(() => {})
        } else if (m.type === 'req') {
          void onReq(e, m)
        }
      }
    })
  }

  return {
    scan(ports: readonly number[] = BRIDGE_PORTS): Promise<number> {
      if (scanning) return scanning
      const p = (async () => {
        await Promise.all(ports.filter((x) => !entries.has(x) && !connecting.has(x)).map(tryConnect))
        return entries.size
      })()
      scanning = p
      const clear = () => { if (scanning === p) scanning = null }
      p.then(clear, clear)
      return p
    },
    async decide(port: number, allow: boolean, add?: (c: ApprovedClient) => Promise<void>, keyHash?: string): Promise<void> {
      const e = entries.get(port)
      if (!e || e.conn.state !== 'pending' || !e.conn.keyHash) return
      if (keyHash !== undefined && keyHash !== e.conn.keyHash) return
      if (allow) {
        await add?.({ keyHash: e.conn.keyHash, client: e.conn.client, at: Date.now() })
        e.conn.state = 'paired'
        send(e.ws, { type: 'welcome', paired: true })
      } else {
        send(e.ws, { type: 'reject', code: 'DENIED' })
        try { e.ws.close() } catch { /* ignore */ }
        drop(port, e)
      }
    },
    revoke(keyHash: string): void {
      for (const [port, e] of [...entries]) {
        if (e.conn.keyHash === keyHash) {
          try { e.ws.close() } catch { /* ignore */ }
          drop(port, e)
        }
      }
    },
    stopAll(): void {
      for (const [port, e] of [...entries]) {
        try { e.ws.close() } catch { /* ignore */ }
        drop(port, e)
      }
    },
    conns(): BridgeConn[] {
      return [...entries.values()].map((e) => ({ ...e.conn }))
    },
  }
}
