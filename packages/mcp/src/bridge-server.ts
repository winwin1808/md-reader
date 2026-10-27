import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'node:crypto'
import {
  BRIDGE_MAX_CONNECTIONS,
  BRIDGE_MAX_PAYLOAD,
  BRIDGE_PORTS,
  KNOWN_EXTENSION_IDS,
  isAllowedExtensionOrigin,
  BRIDGE_PROTOCOL_V2,
  authPayload,
  importPublicKey,
  keyId,
  newNonce,
  parseBridgeMessage,
  signPayload,
  verifyPayload,
  type BridgeArgsMap,
  type BridgeErrorCode,
  type BridgeResultMap,
  type BridgeTool,
} from '@md-reader/core/bridge'
import type { ServerIdentity } from './pairing'

export class BridgeCallError extends Error {
  constructor(readonly code: BridgeErrorCode, message: string) {
    super(message)
    this.name = 'BridgeCallError'
  }
}

export interface BridgeServer {
  readonly port: number
  setClient(name: string): void
  call<T extends BridgeTool>(tool: T, args: BridgeArgsMap[T], timeoutMs?: number): Promise<BridgeResultMap[T]>
  close(): Promise<void>
}

const NOT_CONNECTED_MSG = 'Open Chrome with MD Reader and turn on Settings → AI connection'
const LONG_TOOLS: readonly BridgeTool[] = ['share_doc', 'revoke_link']

function defaultAllowedOrigin(origin: string): boolean {
  const env = (process.env.MDR_EXTENSION_ID ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return isAllowedExtensionOrigin(origin, env.length ? env : KNOWN_EXTENSION_IDS)
}

interface Pending {
  ws: WebSocket
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// Oldest open connection that is not the paired one (clients Set keeps insertion order).
function findReplaceable(wss: WebSocketServer, paired: WebSocket | null, except?: WebSocket): WebSocket | undefined {
  for (const c of wss.clients) {
    if (c !== except && c !== paired && c.readyState === WebSocket.OPEN) return c
  }
  return undefined
}

function listen(port: number, allowed: (o: string) => boolean, getPaired: () => WebSocket | null): Promise<WebSocketServer> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({
      host: '127.0.0.1',
      port,
      maxPayload: BRIDGE_MAX_PAYLOAD,
      verifyClient: (info, cb) => {
        const origin = info.origin
        if (!origin || !allowed(origin)) cb(false, 403, 'Forbidden')
        else if (wss.clients.size >= BRIDGE_MAX_CONNECTIONS && !findReplaceable(wss, getPaired())) cb(false, 503, 'Too many connections')
        else cb(true)
      },
    })
    const onError = (err: Error) => {
      wss.close()
      reject(err)
    }
    wss.once('error', onError)
    wss.once('listening', () => {
      wss.off('error', onError)
      resolve(wss)
    })
  })
}

export async function startBridgeServer(opts: {
  identity: ServerIdentity
  client: string
  ports?: readonly number[]
  connectWaitMs?: number
  allowedOrigin?: (origin: string) => boolean
}): Promise<BridgeServer> {
  const allowed = opts.allowedOrigin ?? defaultAllowedOrigin
  const connectWaitMs = opts.connectWaitMs ?? 35_000
  let client = opts.client

  let paired: WebSocket | null = null
  let wss: WebSocketServer | null = null
  for (const p of opts.ports ?? BRIDGE_PORTS) {
    try {
      wss = await listen(p, allowed, () => paired)
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e
    }
  }
  if (!wss) throw new Error('no free port')
  const server = wss
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0

  let closing = false
  const pending = new Map<string, Pending>()
  const waiters = new Set<{ resolve: (ws: WebSocket) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  let counter = 0

  const failPendingOn = (ws: WebSocket) => {
    for (const [id, p] of pending) {
      if (p.ws !== ws) continue
      pending.delete(id)
      clearTimeout(p.timer)
      p.reject(new BridgeCallError('NOT_CONNECTED', NOT_CONNECTED_MSG))
    }
  }

  server.on('connection', (ws) => {
    if (server.clients.size > BRIDGE_MAX_CONNECTIONS) {
      const old = findReplaceable(server, paired, ws)
      if (old) old.close(4000, 'replaced')
    }
    const nonce = newNonce()
    let authStarted = false
    ws.send(JSON.stringify({ type: 'hello', protocol: BRIDGE_PROTOCOL_V2, client, serverKey: opts.identity.publicKey, nonce }))
    const deny = () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'reject', code: 'DENIED' }))
      ws.close()
    }
    const authenticate = async (msg: { extKey: string; nonce: string; sig: string }) => {
      const id = opts.identity
      try {
        const extPub = await importPublicKey(msg.extKey)
        const ok = await verifyPayload(extPub, authPayload('ext', nonce, await keyId(id.publicKey), port), msg.sig)
        if (!ok) return deny()
        if (id.extKey === null) await id.pinExtKey(msg.extKey)
        else if (id.extKey !== msg.extKey) return deny()
        const sig = await signPayload(id.privateKey, authPayload('srv', msg.nonce, await keyId(msg.extKey), port))
        if (ws.readyState !== WebSocket.OPEN || closing) return
        ws.send(JSON.stringify({ type: 'auth-ok', sig }))
      } catch {
        return deny()
      }
      if (paired === ws) return
      if (paired) {
        const old = paired
        paired = ws
        failPendingOn(old)
        old.close()
      } else paired = ws
      for (const w of waiters) {
        clearTimeout(w.timer)
        w.resolve(ws)
      }
      waiters.clear()
    }
    ws.on('message', (data) => {
      const msg = parseBridgeMessage(String(data))
      if (!msg) return
      switch (msg.type) {
        case 'auth':
          if (authStarted) return
          authStarted = true
          void authenticate(msg)
          return
        case 'reject':
          ws.close()
          return
        case 'res': {
          if (paired !== ws) return
          const p = pending.get(msg.id)
          if (!p || p.ws !== ws) return
          pending.delete(msg.id)
          clearTimeout(p.timer)
          if (msg.ok) p.resolve(msg.result)
          else p.reject(new BridgeCallError(msg.error.code, msg.error.message))
          return
        }
        default:
          return
      }
    })
    ws.on('close', () => {
      if (paired === ws) paired = null
      failPendingOn(ws)
    })
    ws.on('error', () => {})
  })

  const waitPaired = (): Promise<WebSocket> => {
    if (paired && paired.readyState === WebSocket.OPEN) return Promise.resolve(paired)
    return new Promise((resolve, reject) => {
      const w = {
        resolve,
        reject,
        timer: setTimeout(() => {
          waiters.delete(w)
          reject(new BridgeCallError('NOT_CONNECTED', NOT_CONNECTED_MSG))
        }, connectWaitMs),
      }
      waiters.add(w)
    })
  }

  return {
    port,
    setClient(name) {
      client = name
    },
    async call(tool, args, timeoutMs) {
      if (closing) throw new BridgeCallError('NOT_CONNECTED', NOT_CONNECTED_MSG)
      const ws = await waitPaired()
      const id = `${++counter}-${randomBytes(6).toString('hex')}`
      const ms = timeoutMs ?? (LONG_TOOLS.includes(tool) ? 120_000 : 30_000)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new BridgeCallError('TIMEOUT', `${tool} timed out after ${ms}ms`))
        }, ms)
        pending.set(id, { ws, resolve: resolve as (v: unknown) => void, reject, timer })
        ws.send(JSON.stringify({ type: 'req', id, tool, args }), (err) => {
          if (!err || !pending.delete(id)) return
          clearTimeout(timer)
          reject(new BridgeCallError('NOT_CONNECTED', NOT_CONNECTED_MSG))
        })
      }) as Promise<BridgeResultMap[typeof tool]>
    },
    async close() {
      closing = true
      for (const w of waiters) {
        clearTimeout(w.timer)
        w.reject(new BridgeCallError('NOT_CONNECTED', NOT_CONNECTED_MSG))
      }
      waiters.clear()
      for (const [id, p] of pending) {
        pending.delete(id)
        clearTimeout(p.timer)
        p.reject(new BridgeCallError('NOT_CONNECTED', NOT_CONNECTED_MSG))
      }
      for (const c of server.clients) c.terminate()
      await new Promise<void>((r) => server.close(() => r()))
    },
  }
}
