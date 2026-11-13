import {
  BRIDGE_PORTS,
  parseBridgeMessage,
  sanitizeClientName,
  type BridgeRequest,
  type BridgeResponse,
  bridgePinState,
  type BridgeHelloV2,
  type BridgePinState,
} from '@md-reader/core/bridge'
import { importPublicKey, keyId, newNonce, authPayload, signPayload, verifyPayload } from '@md-reader/core/bridge-auth'

export const PING_MS = 20_000
export const IDLE_SCANS_BEFORE_BACKOFF = 10
const CONNECT_TIMEOUT_MS = 1000
export const DECIDE_HELLO_WAIT_MS = 3000
export const DECIDE_AUTH_WAIT_MS = 5000
export type PairOutcome = 'paired' | 'denied' | 'rejected' | 'gone'

export interface ApprovedClient { keyHash: string; client: string; at: number; serverKey: string }
export interface BridgeConn { port: number; client: string; keyHash: string; state: 'pending' | 'authing' | 'paired'; pinned: BridgePinState }
export interface UnpairedServer { port: number; client: string; keyHash: string; pinned: BridgePinState }
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
  /** true = đã mở hộp hỏi, giữ kết nối chờ quyết định */
  onUnpaired(s: UnpairedServer): Promise<boolean>
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
  authStarted?: boolean
  silent?: boolean
  outcome?: Promise<PairOutcome>
  settle?: (o: PairOutcome) => void
  helloDone: Promise<void>
  helloResolve: () => void
  pingTimer: unknown
}

export function createBridge(deps: BridgeDeps) {
  const entries = new Map<number, Entry>()
  const connecting = new Set<number>()
  const inflight = new Map<number, { p: Promise<PairOutcome>; keyHash: string | undefined }>()
  let scanning: Promise<number> | null = null

  function drop(port: number, e: Entry) {
    e.settle?.('rejected')
    e.helloResolve()
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
    if (e.authStarted) return
    e.authStarted = true
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
    if (ok) { e.conn.state = 'paired'; e.settle?.('paired') }
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
    const myKid = await keyId((await deps.extKey()).publicKey)
    if (!live()) return
    const pinned = bridgePinState(h.pinnedExt, myKid)
    e.conn.pinned = pinned
    const list = await deps.approved()
    if (!live()) return
    if (pinned !== 'other' && list.some((a) => a.keyHash === kid && a.serverKey === h.serverKey)) {
      e.helloResolve()
      await authenticate(e)
    } else {
      e.conn.state = 'pending'
      e.helloResolve()
      if (e.silent) return
      let keep = false
      try { keep = await deps.onUnpaired({ port: e.conn.port, client: e.conn.client, keyHash: kid, pinned }) } catch { keep = false }
      if (live() && !keep) kill(e)
    }
  }

  function waitHello(e: Entry): Promise<boolean> {
    return new Promise((resolve) => {
      let t: unknown
      t = deps.setTimer(() => { deps.clearTimer(t); resolve(false) }, DECIDE_HELLO_WAIT_MS)
      void e.helloDone.then(() => { deps.clearTimer(t); resolve(true) })
    })
  }

  function startAuth(e: Entry, add?: (c: ApprovedClient) => Promise<void>): Promise<PairOutcome> {
    if (e.outcome) return e.outcome
    const outcome = new Promise<PairOutcome>((resolve) => {
      let t: unknown
      let done = false
      const finish = (o: PairOutcome) => {
        if (done) return
        done = true
        deps.clearTimer(t)
        e.settle = undefined
        resolve(o)
      }
      e.settle = finish
      t = deps.setTimer(() => { finish('rejected'); kill(e) }, DECIDE_AUTH_WAIT_MS)
    })
    e.outcome = outcome
    void (async () => {
      try {
        if (e.conn.state === 'pending') await add?.({ keyHash: e.conn.keyHash, client: e.conn.client, at: Date.now(), serverKey: e.serverKey })
        await authenticate(e)
      } catch { kill(e) }
    })()
    return outcome
  }

  async function allowFlow(port: number, add?: (c: ApprovedClient) => Promise<void>, keyHash?: string): Promise<PairOutcome> {
    let e = entries.get(port)
    let reconnected = false
    if (!e) {
      if (keyHash === undefined) return 'gone'
      await tryConnect(port, true)
      e = entries.get(port)
      if (!e) return 'gone'
      reconnected = true
    }
    if (!e.conn.keyHash) {
      if (!(await waitHello(e)) || !e.conn.keyHash || entries.get(port) !== e) {
        if (reconnected || !e.conn.keyHash) kill(e)
        return 'gone'
      }
    }
    if (keyHash !== undefined && keyHash !== e.conn.keyHash) {
      if (reconnected) kill(e)
      return 'gone'
    }
    if (e.conn.state === 'paired') return 'paired'
    return startAuth(e, add)
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

  function tryConnect(port: number, silent = false): Promise<void> {
    if (connecting.has(port) || entries.has(port)) return Promise.resolve()
    connecting.add(port)
    return new Promise((resolve) => {
      let ws: WsLike
      try { ws = deps.connect(`ws://127.0.0.1:${port}`) } catch { connecting.delete(port); resolve(); return }
      let helloResolve = () => {}
      const helloDone = new Promise<void>((r) => { helloResolve = r })
      const e: Entry = { ws, conn: { port, client: '', keyHash: '', state: 'pending', pinned: 'unknown' }, hello: false, serverKey: '', serverNonce: '', myNonce: '', pingTimer: undefined, silent, helloDone, helloResolve: () => helloResolve() }
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
        await Promise.all(ports.filter((x) => !entries.has(x) && !connecting.has(x)).map((x) => tryConnect(x)))
        return entries.size
      })()
      scanning = p
      const clear = () => { if (scanning === p) scanning = null }
      p.then(clear, clear)
      return p
    },
    decide(port: number, allow: boolean, add?: (c: ApprovedClient) => Promise<void>, keyHash?: string): Promise<PairOutcome> {
      if (!allow) {
        const e = entries.get(port)
        if (e && e.conn.state === 'pending' && e.conn.keyHash && (keyHash === undefined || keyHash === e.conn.keyHash)) {
          send(e.ws, { type: 'reject', code: 'DENIED' })
          try { e.ws.close() } catch { /* ignore */ }
          drop(port, e)
        }
        return Promise.resolve('denied')
      }
      const running = inflight.get(port)
      if (running) return running.keyHash === keyHash ? running.p : Promise.resolve('gone')
      const p = allowFlow(port, add, keyHash)
      inflight.set(port, { p, keyHash })
      const clear = () => { if (inflight.get(port)?.p === p) inflight.delete(port) }
      p.then(clear, clear)
      return p
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
