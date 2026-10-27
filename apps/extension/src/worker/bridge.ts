import {
  BRIDGE_PORTS,
  parseBridgeMessage,
  sanitizeClientName,
  type BridgeRequest,
  type BridgeResponse,
  type BridgeHelloV2,
} from '@md-reader/core/bridge'
import { importPublicKey, keyId, newNonce, authPayload, signPayload, verifyPayload } from '@md-reader/core/bridge-auth'

export const PING_MS = 20_000
export const IDLE_SCANS_BEFORE_BACKOFF = 10
const CONNECT_TIMEOUT_MS = 1000

export interface ApprovedClient { keyHash: string; client: string; at: number; serverKey: string }
export interface BridgeConn { port: number; client: string; keyHash: string; state: 'pending' | 'authing' | 'paired' }
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
  extKey(): Promise<{ privateKey: CryptoKey; publicKey: string }>
  requestPairing(c: { port: number; client: string; keyHash: string }): void
  execute(req: BridgeRequest, client: string): Promise<BridgeResponse>
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(h: unknown): void
}

interface Entry {
  ws: WsLike
  conn: BridgeConn
  hello: boolean
  serverKey: string
  serverNonce: string
  myNonce: string
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

  function kill(e: Entry) {
    try { e.ws.close() } catch { /* ignore */ }
    drop(e.conn.port, e)
  }

  async function authenticate(e: Entry) {
    const live = () => entries.get(e.conn.port) === e && e.ws.readyState < 2
    const { privateKey, publicKey } = await deps.extKey()
    if (!live()) return
    const myNonce = newNonce()
    const sig = await signPayload(privateKey, authPayload('ext', e.serverNonce, e.conn.keyHash, e.conn.port))
    if (!live()) return
    e.myNonce = myNonce
    e.conn.state = 'authing'
    send(e.ws, { type: 'auth', extKey: publicKey, nonce: myNonce, sig })
  }

  async function onAuthOk(e: Entry, sig: string) {
    if (e.conn.state !== 'authing') return
    const live = () => entries.get(e.conn.port) === e && e.ws.readyState < 2
    let ok = false
    try {
      const { publicKey } = await deps.extKey()
      const payload = authPayload('srv', e.myNonce, await keyId(publicKey), e.conn.port)
      ok = await verifyPayload(await importPublicKey(e.serverKey), payload, sig)
    } catch { ok = false }
    if (!live() || e.conn.state !== 'authing') return
    if (ok) e.conn.state = 'paired'
    else kill(e)
  }

  async function onHello(e: Entry, h: BridgeHelloV2) {
    if (e.hello) return
    e.hello = true
    const live = () => entries.get(e.conn.port) === e && e.ws.readyState < 2
    const kid = await keyId(h.serverKey)
    if (!live()) return
    e.conn.client = sanitizeClientName(h.client)
    e.conn.keyHash = kid
    e.serverKey = h.serverKey
    e.serverNonce = h.nonce
    const list = await deps.approved()
    if (!live()) return
    if (list.some((a) => a.keyHash === kid && a.serverKey === h.serverKey)) {
      await authenticate(e)
    } else {
      e.conn.state = 'pending'
      deps.requestPairing({ port: e.conn.port, client: e.conn.client, keyHash: kid })
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
      const e: Entry = { ws, conn: { port, client: '', keyHash: '', state: 'pending' }, hello: false, serverKey: '', serverNonce: '', myNonce: '', pingTimer: undefined }
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
        if (!m) {
          try { if ((JSON.parse(ev.data) as { type?: unknown }).type === 'hello') kill(e) } catch { /* ignore */ }
          return
        }
        if (m.type === 'hello') {
          void onHello(e, m).catch(() => kill(e))
        } else if (m.type === 'auth-ok') {
          void onAuthOk(e, m.sig)
        } else if (m.type === 'reject') {
          kill(e)
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
        await add?.({ keyHash: e.conn.keyHash, client: e.conn.client, at: Date.now(), serverKey: e.serverKey })
        await authenticate(e).catch(() => kill(e))
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
