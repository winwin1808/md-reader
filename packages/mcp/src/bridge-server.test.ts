import { afterEach, describe, expect, it } from 'vitest'
import net from 'node:net'
import WebSocket from 'ws'
import {
  KNOWN_EXTENSION_IDS,
} from '@md-reader/core/bridge'
import { authPayload, exportPublicKey, generateBridgeKeyPair, importPublicKey, keyId, newNonce, signPayload, verifyPayload } from '@md-reader/core/bridge-auth'
import type { ServerIdentity } from './pairing'
import { AUTH_DEADLINE_MS, BridgeCallError, PAIR_WINDOW_MS, startBridgeServer, type BridgeServer } from './bridge-server'

const ORIGIN = `chrome-extension://${KNOWN_EXTENSION_IDS[0]}`
const FOREIGN = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const p = (srv.address() as net.AddressInfo).port
      srv.close(() => resolve(p))
    })
  })

const servers: BridgeServer[] = []
const sockets: WebSocket[] = []
afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate()
  for (const s of servers.splice(0)) await s.close()
})

async function makeIdentity(extKey: string | null = null): Promise<ServerIdentity & { pinned: string[] }> {
  const pair = await generateBridgeKeyPair()
  const id: ServerIdentity & { pinned: string[] } = {
    privateKey: pair.privateKey,
    publicKey: await exportPublicKey(pair.publicKey),
    extKey,
    pinned: [],
    async pinExtKey(k: string) {
      id.pinned.push(k)
      id.extKey = k
    },
  }
  return id
}

let lastIdentity: ServerIdentity & { pinned: string[] }
async function start(opts: { connectWaitMs?: number; ports?: number[]; identity?: ServerIdentity & { pinned: string[] }; now?: () => number; authDeadlineMs?: number } = {}) {
  const ports = opts.ports ?? [await freePort()]
  lastIdentity = opts.identity ?? (await makeIdentity())
  const s = await startBridgeServer({ identity: lastIdentity, client: 'test-client', ports, connectWaitMs: opts.connectWaitMs ?? 2000, now: opts.now, authDeadlineMs: opts.authDeadlineMs })
  servers.push(s)
  return s
}

interface Ext { ws: WebSocket; msgs: any[]; next: (pred?: (m: any) => boolean) => Promise<any> }
function connect(port: number, origin: string | undefined = ORIGIN): Promise<Ext> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {})
    sockets.push(ws)
    const msgs: any[] = []
    const waiters: Array<{ pred: (m: any) => boolean; res: (m: any) => void }> = []
    ws.on('message', (d) => {
      const m = JSON.parse(String(d))
      msgs.push(m)
      const i = waiters.findIndex((w) => w.pred(m))
      if (i >= 0) waiters.splice(i, 1)[0]!.res(m)
    })
    const next = (pred: (m: any) => boolean = () => true) =>
      new Promise<any>((res) => {
        const found = msgs.findIndex(pred)
        if (found >= 0) res(msgs.splice(found, 1)[0])
        else waiters.push({ pred, res })
      })
    ws.on('open', () => resolve({ ws, msgs, next }))
    ws.on('error', reject)
  })
}
const closed = (ws: WebSocket) => new Promise<void>((r) => (ws.readyState === WebSocket.CLOSED ? r() : ws.once('close', () => r())))
async function sendAuth(
  e: Ext,
  hello: any,
  port: number,
  o: { pair?: CryptoKeyPair; signPort?: number; badSig?: boolean } = {},
) {
  const pair = o.pair ?? (await generateBridgeKeyPair())
  const extKey = await exportPublicKey(pair.publicKey)
  const nonce = newNonce()
  const sig = await signPayload(pair.privateKey, authPayload('ext', hello.nonce, await keyId(hello.serverKey), o.signPort ?? port))
  e.ws.send(JSON.stringify({ type: 'auth', extKey, nonce, sig: o.badSig ? 'A'.repeat(sig.length) : sig }))
  return { pair, extKey, nonce }
}
const pairUp = async (port: number, pair?: CryptoKeyPair) => {
  const e = await connect(port)
  const hello = await e.next((m) => m.type === 'hello')
  await sendAuth(e, hello, port, { pair })
  await e.next((m) => m.type === 'auth-ok')
  return e
}

describe('bridge server', () => {
  it('sends hello with the right fields on connect', async () => {
    const s = await start()
    const e = await connect(s.port)
    const hello = await e.next()
    expect(hello).toEqual({ type: 'hello', protocol: 2, client: 'test-client', serverKey: lastIdentity.publicKey, nonce: hello.nonce })
    expect(typeof hello.nonce).toBe('string')
    expect(hello.nonce.length).toBeGreaterThan(10)
    expect('pairKey' in hello).toBe(false)
  })

  it('valid auth gets auth-ok verifiable with the right port, then receives req', async () => {
    const s = await start()
    const e = await connect(s.port)
    const hello = await e.next((m) => m.type === 'hello')
    const { extKey, nonce } = await sendAuth(e, hello, s.port)
    const ok = await e.next((m) => m.type === 'auth-ok')
    const srvPub = await importPublicKey(lastIdentity.publicKey)
    expect(await verifyPayload(srvPub, authPayload('srv', nonce, await keyId(extKey), s.port), ok.sig)).toBe(true)
    expect(await verifyPayload(srvPub, authPayload('srv', nonce, await keyId(extKey), s.port + 1), ok.sig)).toBe(false)
    expect(lastIdentity.pinned).toEqual([extKey])
    const p = s.call('list_docs', {})
    const req = await e.next((m) => m.type === 'req')
    e.ws.send(JSON.stringify({ type: 'res', id: req.id, ok: true, result: { docs: [] } }))
    await expect(p).resolves.toEqual({ docs: [] })
  })

  it('bad signature is rejected and closed, no req', async () => {
    const s = await start({ connectWaitMs: 150 })
    const e = await connect(s.port)
    const hello = await e.next((m) => m.type === 'hello')
    await sendAuth(e, hello, s.port, { badSig: true })
    expect((await e.next((m) => m.type === 'reject')).code).toBe('DENIED')
    await closed(e.ws)
    await expect(s.call('list_docs', {})).rejects.toMatchObject({ code: 'NOT_CONNECTED' })
    expect(e.msgs.some((m) => m.type === 'req')).toBe(false)
    expect(lastIdentity.pinned).toEqual([])
  })

  it('a different ext key than the pinned one is rejected even with a valid signature', async () => {
    const a = await generateBridgeKeyPair()
    const identity = await makeIdentity(await exportPublicKey(a.publicKey))
    const s = await start({ identity, connectWaitMs: 150 })
    const e = await connect(s.port)
    const hello = await e.next((m) => m.type === 'hello')
    await sendAuth(e, hello, s.port) // fresh key B
    expect((await e.next((m) => m.type === 'reject')).code).toBe('DENIED')
    await closed(e.ws)
    await expect(s.call('list_docs', {})).rejects.toMatchObject({ code: 'NOT_CONNECTED' })
    // the pinned key still works
    const ok = await pairUp(s.port, a)
    expect(ok.ws.readyState).toBe(WebSocket.OPEN)
  })

  it('signature over a different port is rejected', async () => {
    const s = await start({ connectWaitMs: 150 })
    const e = await connect(s.port)
    const hello = await e.next((m) => m.type === 'hello')
    await sendAuth(e, hello, s.port, { signPort: s.port + 1 })
    expect((await e.next((m) => m.type === 'reject')).code).toBe('DENIED')
    await closed(e.ws)
  })

  it('a second auth on the same connection is ignored', async () => {
    const s = await start()
    const e = await pairUp(s.port)
    const hello = { nonce: 'x', serverKey: lastIdentity.publicKey }
    await sendAuth(e, hello, s.port)
    const p = s.call('list_docs', {})
    const req = await e.next((m) => m.type === 'req')
    expect(e.msgs.filter((m) => m.type === 'auth-ok').length).toBeLessThanOrEqual(1)
    expect(e.msgs.some((m) => m.type === 'reject')).toBe(false)
    e.ws.send(JSON.stringify({ type: 'res', id: req.id, ok: true, result: { docs: [] } }))
    await expect(p).resolves.toEqual({ docs: [] })
  })

  it('waits for auth, then sends req and resolves on ok res', async () => {
    const s = await start()
    const e = await connect(s.port)
    const hello = await e.next((m) => m.type === 'hello')
    const p = s.call('list_docs', {})
    await sendAuth(e, hello, s.port)
    const req = await e.next((m) => m.type === 'req')
    expect(req.tool).toBe('list_docs')
    expect(req.args).toEqual({})
    e.ws.send(JSON.stringify({ type: 'res', id: req.id, ok: true, result: { docs: [] } }))
    await expect(p).resolves.toEqual({ docs: [] })
  })

  it('welcome is ignored: the connection stays open but is not paired', async () => {
    const s = await start({ connectWaitMs: 150 })
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    e.ws.send(JSON.stringify({ type: 'welcome', paired: true }))
    await expect(s.call('list_docs', {})).rejects.toMatchObject({ code: 'NOT_CONNECTED' })
    expect(e.ws.readyState).toBe(WebSocket.OPEN)
  })

  it('maps error res to BridgeCallError with the code', async () => {
    const s = await start()
    const e = await pairUp(s.port)
    const p = s.call('get_doc', { docId: 'x' })
    const req = await e.next((m) => m.type === 'req')
    e.ws.send(JSON.stringify({ type: 'res', id: req.id, ok: false, error: { code: 'NOT_FOUND', message: 'nope' } }))
    const err = await p.catch((x) => x)
    expect(err).toBeInstanceOf(BridgeCallError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('nope')
  })

  it('rejects NOT_CONNECTED after connectWaitMs with no extension', async () => {
    const s = await start({ connectWaitMs: 80 })
    const err = await s.call('list_docs', {}).catch((x) => x)
    expect(err).toBeInstanceOf(BridgeCallError)
    expect(err.code).toBe('NOT_CONNECTED')
    expect(err.message).toContain('AI connection')
  })

  it('rejects TIMEOUT when no res arrives', async () => {
    const s = await start()
    const e = await pairUp(s.port)
    const p = s.call('list_docs', {}, 80)
    await e.next((m) => m.type === 'req')
    await expect(p).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('refuses a bad Origin with 403', async () => {
    const s = await start()
    await expect(connect(s.port, 'https://evil.example')).rejects.toThrow(/403/)
    await expect(connect(s.port, '')).rejects.toThrow(/403/)
  })

  it('falls through to the next port when the first is busy', async () => {
    const busy = await freePort()
    const blocker = net.createServer()
    await new Promise<void>((r) => blocker.listen(busy, '127.0.0.1', r))
    try {
      const next = await freePort()
      const s = await start({ ports: [busy, next] })
      expect(s.port).toBe(next)
    } finally {
      await new Promise((r) => blocker.close(r))
    }
  })

  it('rejects when no port is free', async () => {
    const busy = await freePort()
    const blocker = net.createServer()
    await new Promise<void>((r) => blocker.listen(busy, '127.0.0.1', r))
    try {
      await expect(startBridgeServer({ identity: await makeIdentity(), client: 'c', ports: [busy] })).rejects.toThrow('no free port')
    } finally {
      await new Promise((r) => blocker.close(r))
    }
  })

  it('a second paired connection replaces the first; pending call rejects NOT_CONNECTED', async () => {
    const s = await start()
    const kp = await generateBridgeKeyPair()
    const a = await pairUp(s.port, kp)
    const p = s.call('list_docs', {})
    const settled = p.catch((x) => x)
    await a.next((m) => m.type === 'req')
    const aClosed = closed(a.ws)
    const b = await pairUp(s.port, kp)
    const err = await settled
    expect(err.code).toBe('NOT_CONNECTED')
    await aClosed
    const p2 = s.call('list_docs', {})
    const req = await b.next((m) => m.type === 'req')
    b.ws.send(JSON.stringify({ type: 'res', id: req.id, ok: true, result: { docs: [] } }))
    await expect(p2).resolves.toEqual({ docs: [] })
  })

  it('reject message closes that connection', async () => {
    const s = await start()
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    e.ws.send(JSON.stringify({ type: 'reject', code: 'DENIED' }))
    await closed(e.ws)
  })

  it('ignores ping and garbage messages', async () => {
    const s = await start()
    const e = await pairUp(s.port)
    e.ws.send(JSON.stringify({ type: 'ping' }))
    e.ws.send('not json')
    const p = s.call('list_docs', {})
    const req = await e.next((m) => m.type === 'req')
    e.ws.send(JSON.stringify({ type: 'res', id: req.id, ok: true, result: { docs: [] } }))
    await expect(p).resolves.toEqual({ docs: [] })
  })

  it('pending call rejects NOT_CONNECTED when the connection drops', async () => {
    const s = await start()
    const e = await pairUp(s.port)
    const p = s.call('list_docs', {})
    const settled = p.catch((x) => x)
    await e.next((m) => m.type === 'req')
    e.ws.close()
    expect((await settled).code).toBe('NOT_CONNECTED')
  })

  it('close() rejects pending calls', async () => {
    const s = await start()
    const e = await pairUp(s.port)
    const p = s.call('list_docs', {})
    const settled = p.catch((x) => x)
    await e.next((m) => m.type === 'req')
    await s.close()
    expect((await settled).code).toBe('NOT_CONNECTED')
  })

  it('refuses a foreign extension id by default; MDR_EXTENSION_ID allows it', async () => {
    const s = await start()
    await expect(connect(s.port, FOREIGN)).rejects.toThrow(/403/)
    const prev = process.env.MDR_EXTENSION_ID
    process.env.MDR_EXTENSION_ID = ` ${FOREIGN.slice('chrome-extension://'.length)} ,`
    try {
      const s2 = await start()
      const e = await connect(s2.port, FOREIGN)
      expect((await e.next()).type).toBe('hello')
    } finally {
      if (prev === undefined) delete process.env.MDR_EXTENSION_ID
      else process.env.MDR_EXTENSION_ID = prev
    }
  })

  it('5th connection replaces the oldest unpaired one (close 4000)', async () => {
    const s = await start()
    const first = await connect(s.port)
    const firstClosed = new Promise<number>((r) => first.ws.once('close', (code) => r(code)))
    for (let i = 0; i < 3; i++) await connect(s.port)
    const fifth = await connect(s.port)
    expect((await fifth.next()).type).toBe('hello')
    expect(await firstClosed).toBe(4000)
  })

  it('closes the socket with 1009 on a frame over 16 MiB', async () => {
    const s = await start()
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    const code = new Promise<number>((r) => e.ws.once('close', (c) => r(c)))
    e.ws.send('x'.repeat(16 * 1024 * 1024 + 1))
    expect(await code).toBe(1009)
  })

  it('never sends req to an unpaired socket', async () => {
    const s = await start({ connectWaitMs: 150 })
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    e.ws.send(JSON.stringify({ type: 'welcome', paired: true }))
    await expect(s.call('get_doc', { docId: 'x' })).rejects.toMatchObject({ code: 'NOT_CONNECTED' })
    expect(e.msgs.some((m) => m.type === 'req')).toBe(false)
  })
  it('concurrent auth from two different keys while unpinned: exactly one pairs', async () => {
    const s = await start({ connectWaitMs: 150 })
    const a = await connect(s.port)
    const b = await connect(s.port)
    const ha = await a.next((m) => m.type === 'hello')
    const hb = await b.next((m) => m.type === 'hello')
    const [ka, kb] = await Promise.all([sendAuth(a, ha, s.port), sendAuth(b, hb, s.port)])
    const results = await Promise.all(
      [a, b].map((e) => e.next((m) => m.type === 'auth-ok' || m.type === 'reject')),
    )
    expect(results.filter((r) => r.type === 'auth-ok').length).toBe(1)
    expect(results.filter((r) => r.type === 'reject').length).toBe(1)
    expect(lastIdentity.pinned.length).toBe(1)
    const winner = results[0].type === 'auth-ok' ? ka : kb
    expect(lastIdentity.pinned[0]).toBe(winner.extKey)
  })

  it('outside the pairing window an unpinned identity rejects', async () => {
    const t0 = 1_000_000
    let t = t0
    const s = await start({ connectWaitMs: 150, now: () => t })
    t = t0 + PAIR_WINDOW_MS + 60_000
    const e = await connect(s.port)
    const hello = await e.next((m) => m.type === 'hello')
    await sendAuth(e, hello, s.port)
    expect((await e.next((m) => m.type === 'reject')).code).toBe('DENIED')
    expect(lastIdentity.pinned).toEqual([])
    expect(AUTH_DEADLINE_MS).toBe(10_000)
  })

  it('a connection that never authenticates is closed after the deadline', async () => {
    const s = await start({ authDeadlineMs: 100 })
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    await closed(e.ws)
  })
})
