import { describe, it, expect, vi } from 'vitest'
import {
  generateBridgeKeyPair, exportPublicKey, importPublicKey, keyId, newNonce, authPayload, signPayload, verifyPayload,
} from '@md-reader/core/bridge-auth'
import { createBridge, PING_MS, DECIDE_HELLO_WAIT_MS, DECIDE_AUTH_WAIT_MS, type BridgeDeps, type WsLike, type ApprovedClient } from './bridge'

class FakeWs implements WsLike {
  readyState = 0
  sent: unknown[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) {}
  send(d: string) { this.sent.push(JSON.parse(d)) }
  close() { this.closed = true; this.readyState = 3; this.onclose?.() }
  recv(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) }) }
}

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) }

const srvPair = await generateBridgeKeyPair()
const srvPub = await exportPublicKey(srvPair.publicKey)
const srvKid = await keyId(srvPub)
const otherPair = await generateBridgeKeyPair()
const extPair = await generateBridgeKeyPair()
const extPub = await exportPublicKey(extPair.publicKey)
const PORT = 47821

function setup(opts: { openPorts?: number[]; approved?: ApprovedClient[] } = {}) {
  const open = new Set(opts.openPorts ?? [PORT])
  const sockets: FakeWs[] = []
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = []
  const deps = {
    connect: vi.fn((url: string) => {
      const ws = new FakeWs(url)
      sockets.push(ws)
      const port = Number(url.split(':').pop())
      queueMicrotask(() => {
        if (open.has(port)) { ws.readyState = 1; ws.onopen?.() } else { ws.onerror?.(); ws.onclose?.() }
      })
      return ws
    }),
    approved: vi.fn(async () => opts.approved ?? []),
    extKey: vi.fn(async () => ({ privateKey: extPair.privateKey, publicKey: extPub })),
    onUnpaired: vi.fn(async () => true),
    execute: vi.fn(async (req: { id: string }) => ({ type: 'res' as const, id: req.id, ok: true as const, result: { x: 1 } })),
    setTimer: (fn: () => void, ms: number) => { const t = { fn, ms, cleared: false }; timers.push(t); return t },
    clearTimer: (h: unknown) => { (h as { cleared: boolean }).cleared = true },
  }
  const bridge = createBridge(deps as unknown as BridgeDeps)
  return { bridge, deps, sockets, timers }
}
const SNONCE = newNonce()
const hello = { type: 'hello', protocol: 2, client: 'claude-code', serverKey: srvPub, nonce: SNONCE }
const approvedOk: ApprovedClient = { keyHash: srvKid, client: 'claude-code', at: 1, serverKey: srvPub }
const authOf = (ws: FakeWs) => ws.sent.find((m) => (m as { type: string }).type === 'auth') as { extKey: string; nonce: string; sig: string } | undefined
async function srvAuthOk(auth: { nonce: string }, signer: CryptoKey = srvPair.privateKey) {
  return { type: 'auth-ok', sig: await signPayload(signer, authPayload('srv', auth.nonce, await keyId(extPub), PORT)) }
}
async function pairedSetup() {
  const t = setup({ approved: [approvedOk] })
  await t.bridge.scan([PORT])
  t.sockets[0]!.recv(hello)
  await vi.waitFor(() => expect(authOf(t.sockets[0]!)).toBeTruthy())
  return t
}

describe('bridge v2', () => {
  it('scan opens connections for open ports only', async () => {
    const { bridge, deps } = setup({ openPorts: [47822] })
    const n = await bridge.scan([47821, 47822, 47823])
    expect(n).toBe(1)
    expect(deps.connect).toHaveBeenCalledWith('ws://127.0.0.1:47822')
    expect(bridge.conns().map((c) => c.port)).toEqual([47822])
  })

  it('second scan does not duplicate open connections', async () => {
    const { bridge, deps } = setup()
    await bridge.scan([PORT])
    await bridge.scan([PORT])
    expect(deps.connect).toHaveBeenCalledTimes(1)
  })

  it('(a) unapproved hello -> onUnpaired with keyId, no auth sent', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(deps.onUnpaired).toHaveBeenCalled())
    expect(deps.onUnpaired).toHaveBeenCalledWith({ port: PORT, client: 'claude-code', keyHash: srvKid, pinned: 'unknown' })
    expect(authOf(sockets[0]!)).toBeUndefined()
    expect(bridge.conns()[0]!.state).toBe('pending')
  })

  it('sanitizes client name', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv({ ...hello, client: '\u202EevilName\n' })
    await vi.waitFor(() => expect(deps.onUnpaired).toHaveBeenCalled())
    expect(bridge.conns()[0]!.client).toBe('evilName')
  })

  it('(b) decide allow stores serverKey and sends verifiable auth', async () => {
    const { bridge, sockets } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(bridge.conns()[0]!.keyHash).toBe(srvKid))
    const add = vi.fn(async () => {})
    const outcome = bridge.decide(PORT, true, add)
    await vi.waitFor(() => expect(authOf(sockets[0]!)).toBeTruthy())
    void outcome
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ keyHash: srvKid, client: 'claude-code', serverKey: srvPub }))
    const a = authOf(sockets[0]!)!
    expect(a.extKey).toBe(extPub)
    expect(sockets[0]!.sent).not.toContainEqual(expect.objectContaining({ type: 'welcome' }))
    const ok = await verifyPayload(await importPublicKey(extPub), authPayload('ext', SNONCE, srvKid, PORT), a.sig)
    expect(ok).toBe(true)
    expect(bridge.conns()[0]!.state).toBe('authing')
  })

  it('approved hello authenticates directly without pairing', async () => {
    const { bridge, sockets, deps } = await pairedSetup()
    expect(deps.onUnpaired).not.toHaveBeenCalled()
    expect(bridge.conns()[0]!.state).toBe('authing')
    expect(sockets[0]!.sent).not.toContainEqual(expect.objectContaining({ type: 'welcome' }))
  })

  it('(c) valid auth-ok -> paired, req executed; req before auth-ok ignored', async () => {
    const { bridge, sockets, deps } = await pairedSetup()
    const req = { type: 'req', id: 'r1', tool: 'list_docs', args: {} }
    sockets[0]!.recv(req)
    await flush()
    expect(deps.execute).not.toHaveBeenCalled()
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!))
    await vi.waitFor(() => expect(bridge.conns()[0]!.state).toBe('paired'))
    sockets[0]!.recv(req)
    await vi.waitFor(() => expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'res', id: 'r1', ok: true, result: { x: 1 } }))
    expect(deps.execute).toHaveBeenCalledTimes(1)
  })

  it('(c) auth-ok signed by another key -> closed, req not executed', async () => {
    const { bridge, sockets, deps } = await pairedSetup()
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!, otherPair.privateKey))
    await vi.waitFor(() => expect(sockets[0]!.closed).toBe(true))
    sockets[0]!.recv({ type: 'req', id: 'r1', tool: 'list_docs', args: {} })
    await flush()
    expect(deps.execute).not.toHaveBeenCalled()
    expect(bridge.conns()).toEqual([])
  })

  it('(d) approved client but different serverKey -> no auth, onUnpaired', async () => {
    const { bridge, sockets, deps } = setup({ approved: [{ ...approvedOk, serverKey: 'different' }] })
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(deps.onUnpaired).toHaveBeenCalled())
    expect(authOf(sockets[0]!)).toBeUndefined()
    expect(bridge.conns()[0]!.state).toBe('pending')
  })

  it('(f1) pinnedExt of another key + approved client -> no auth, onUnpaired pinned other', async () => {
    const { bridge, sockets, deps } = setup({ approved: [approvedOk] })
    await bridge.scan([PORT])
    sockets[0]!.recv({ ...hello, pinnedExt: 'f'.repeat(64) })
    await vi.waitFor(() => expect(deps.onUnpaired).toHaveBeenCalled())
    expect(deps.onUnpaired).toHaveBeenCalledWith({ port: PORT, client: 'claude-code', keyHash: srvKid, pinned: 'other' })
    expect(authOf(sockets[0]!)).toBeUndefined()
    expect(bridge.conns()[0]!.pinned).toBe('other')
  })

  it('(f2) onUnpaired false -> socket closed silently, no reject', async () => {
    const { bridge, sockets, deps } = setup()
    deps.onUnpaired.mockImplementation(async () => false)
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(sockets[0]!.closed).toBe(true))
    expect(bridge.conns()).toEqual([])
    expect(sockets[0]!.sent.some((m) => (m as { type: string }).type === 'reject')).toBe(false)
  })

  it('(f3) onUnpaired true -> stays pending', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(deps.onUnpaired).toHaveBeenCalled())
    await flush()
    expect(bridge.conns()[0]!.state).toBe('pending')
    expect(sockets[0]!.closed).toBe(false)
  })

  it('(f4) pinnedExt = own keyId -> pinned self', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv({ ...hello, pinnedExt: await keyId(extPub) })
    await vi.waitFor(() => expect(deps.onUnpaired).toHaveBeenCalledWith(expect.objectContaining({ pinned: 'self' })))
  })

  it('(f5) pinnedExt null -> pinned none', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv({ ...hello, pinnedExt: null })
    await vi.waitFor(() => expect(deps.onUnpaired).toHaveBeenCalledWith(expect.objectContaining({ pinned: 'none' })))
  })

  it('(f6) onUnpaired throws -> closed like false', async () => {
    const { bridge, sockets, deps } = setup()
    deps.onUnpaired.mockImplementation(async () => { throw new Error('x') })
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(sockets[0]!.closed).toBe(true))
    expect(bridge.conns()).toEqual([])
  })

  it('(e) hello v1 -> closed', async () => {
    const { sockets, deps } = setup()
    const { bridge } = { bridge: createBridge(deps as unknown as BridgeDeps) }
    await bridge.scan([PORT])
    sockets[0]!.recv({ type: 'hello', protocol: 1, client: 'c', pairKey: 'k'.repeat(32) })
    await vi.waitFor(() => expect(sockets[0]!.closed).toBe(true))
    expect(deps.onUnpaired).not.toHaveBeenCalled()
  })

  it('reject closes and drops', async () => {
    const { bridge, sockets } = await pairedSetup()
    sockets[0]!.recv({ type: 'reject', code: 'DENIED' })
    await vi.waitFor(() => expect(sockets[0]!.closed).toBe(true))
    expect(bridge.conns()).toEqual([])
  })

  it('decide deny rejects and closes', async () => {
    const { bridge, sockets } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(bridge.conns()[0]!.keyHash).toBe(srvKid))
    await bridge.decide(PORT, false)
    expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'reject', code: 'DENIED' })
    expect(sockets[0]!.closed).toBe(true)
  })

  it('execute throwing yields INTERNAL res; garbage ignored', async () => {
    const { bridge, sockets, deps } = await pairedSetup()
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!))
    await vi.waitFor(() => expect(bridge.conns()[0]!.state).toBe('paired'))
    deps.execute.mockRejectedValueOnce(new Error('boom'))
    sockets[0]!.onmessage?.({ data: 'not json' })
    sockets[0]!.recv({ type: 'req', id: 'r2', tool: 'list_docs', args: {} })
    await vi.waitFor(() => expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'res', id: 'r2', ok: false, error: { code: 'INTERNAL', message: 'boom' } }))
  })

  it('pings every PING_MS and stops on close', async () => {
    const { bridge, sockets, timers } = setup()
    await bridge.scan([PORT])
    const t = timers.find((x) => x.ms === PING_MS)!
    expect(t).toBeTruthy()
    t.fn()
    expect(sockets[0]!.sent).toContainEqual({ type: 'ping' })
    sockets[0]!.close()
    expect(t.cleared).toBe(true)
    expect(bridge.conns()).toEqual([])
  })

  it('revoke closes the matching connection only', async () => {
    const { bridge, sockets } = setup({ openPorts: [47821, 47822], approved: [approvedOk] })
    await bridge.scan([47821, 47822])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(bridge.conns()[0]!.keyHash).toBe(srvKid))
    bridge.revoke(srvKid)
    expect(sockets[0]!.closed).toBe(true)
    expect(sockets[1]!.closed).toBe(false)
  })

  it('concurrent scans open one socket per port', async () => {
    const { bridge, deps } = setup({ openPorts: [47821, 47822] })
    await Promise.all([bridge.scan([47821, 47822]), bridge.scan([47821, 47822]), bridge.scan([47821, 47822])])
    expect(deps.connect).toHaveBeenCalledTimes(2)
    expect(bridge.conns().length).toBe(2)
  })

  it('hello on a socket closed before hashing finishes is ignored', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    sockets[0]!.close()
    await new Promise((r) => setTimeout(r, 100))
    expect(deps.onUnpaired).not.toHaveBeenCalled()
    expect(authOf(sockets[0]!)).toBeUndefined()
  })

  it('decide with a mismatching keyHash does nothing', async () => {
    const { bridge, sockets } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(bridge.conns()[0]!.keyHash).toBe(srvKid))
    const add = vi.fn(async () => {})
    await bridge.decide(PORT, true, add, 'wrong')
    expect(add).not.toHaveBeenCalled()
    expect(authOf(sockets[0]!)).toBeUndefined()
    expect(bridge.conns()[0]!.state).toBe('pending')
  })
})

describe('bridge v2 double decide (13c)', () => {
  it('allow twice without await -> one auth, one add, valid auth-ok pairs', async () => {
    const { bridge, sockets } = setup()
    await bridge.scan([PORT])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(bridge.conns()[0]!.keyHash).toBe(srvKid))
    const add = vi.fn(async () => {})
    const p1 = bridge.decide(PORT, true, add)
    const p2 = bridge.decide(PORT, true, add)
    await vi.waitFor(() => expect(authOf(sockets[0]!)).toBeTruthy())
    await flush()
    expect(p1).toBe(p2)
    expect(add).toHaveBeenCalledTimes(1)
    expect(sockets[0]!.sent.filter((m) => (m as { type: string }).type === 'auth')).toHaveLength(1)
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!))
    await vi.waitFor(() => expect(bridge.conns()[0]!.state).toBe('paired'))
  })
})

async function pendingSetup() {
  const t = setup()
  await t.bridge.scan([PORT])
  t.sockets[0]!.recv(hello)
  await vi.waitFor(() => expect(t.bridge.conns()[0]!.keyHash).toBe(srvKid))
  return t
}

describe('bridge v2 decide outcome (21c2)', () => {
  it('deny -> denied with reject sent; deny with no entry -> denied', async () => {
    const { bridge, sockets } = await pendingSetup()
    await expect(bridge.decide(PORT, false)).resolves.toBe('denied')
    expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'reject', code: 'DENIED' })
    await expect(bridge.decide(PORT, false)).resolves.toBe('denied')
  })

  it('allow + auth-ok -> paired', async () => {
    const { bridge, sockets } = await pendingSetup()
    const p = bridge.decide(PORT, true, async () => {})
    await vi.waitFor(() => expect(authOf(sockets[0]!)).toBeTruthy())
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!))
    await expect(p).resolves.toBe('paired')
  })

  it('server reject -> rejected; socket closed -> rejected', async () => {
    const a = await pendingSetup()
    const p = a.bridge.decide(PORT, true, async () => {})
    await vi.waitFor(() => expect(authOf(a.sockets[0]!)).toBeTruthy())
    a.sockets[0]!.recv({ type: 'reject', code: 'DENIED' })
    await expect(p).resolves.toBe('rejected')

    const b = await pendingSetup()
    const q = b.bridge.decide(PORT, true, async () => {})
    await vi.waitFor(() => expect(authOf(b.sockets[0]!)).toBeTruthy())
    b.sockets[0]!.close()
    await expect(q).resolves.toBe('rejected')
  })

  it('no answer within DECIDE_AUTH_WAIT_MS -> rejected', async () => {
    const { bridge, sockets, timers } = await pendingSetup()
    const p = bridge.decide(PORT, true, async () => {})
    await vi.waitFor(() => expect(authOf(sockets[0]!)).toBeTruthy())
    const t = timers.find((x) => x.ms === DECIDE_AUTH_WAIT_MS && !x.cleared)!
    expect(t).toBeTruthy()
    t.fn()
    await expect(p).resolves.toBe('rejected')
    expect(t.cleared).toBe(true)
  })

  it('allow after entry dropped -> reconnects same port silently, paired, add once', async () => {
    const { bridge, sockets, deps } = await pendingSetup()
    sockets[0]!.close()
    expect(bridge.conns()).toEqual([])
    const add = vi.fn(async () => {})
    const p = bridge.decide(PORT, true, add, srvKid)
    await vi.waitFor(() => expect(sockets).toHaveLength(2))
    expect(sockets[1]!.url).toBe(`ws://127.0.0.1:${PORT}`)
    await vi.waitFor(() => expect(bridge.conns()).toHaveLength(1))
    sockets[1]!.recv(hello)
    await vi.waitFor(() => expect(authOf(sockets[1]!)).toBeTruthy())
    sockets[1]!.recv(await srvAuthOk(authOf(sockets[1]!)!))
    await expect(p).resolves.toBe('paired')
    expect(add).toHaveBeenCalledTimes(1)
    expect(deps.onUnpaired).toHaveBeenCalledTimes(1)
  })

  it('reconnect with a different key -> gone, no add, no auth', async () => {
    const { bridge, sockets } = await pendingSetup()
    sockets[0]!.close()
    const add = vi.fn(async () => {})
    const p = bridge.decide(PORT, true, add, srvKid)
    await vi.waitFor(() => expect(bridge.conns()).toHaveLength(1))
    const otherPub = await exportPublicKey(otherPair.publicKey)
    sockets[1]!.recv({ ...hello, serverKey: otherPub })
    await expect(p).resolves.toBe('gone')
    expect(add).not.toHaveBeenCalled()
    expect(authOf(sockets[1]!)).toBeUndefined()
  })

  it('reconnect without hello in DECIDE_HELLO_WAIT_MS -> gone', async () => {
    const { bridge, sockets, timers } = await pendingSetup()
    sockets[0]!.close()
    const add = vi.fn(async () => {})
    const p = bridge.decide(PORT, true, add, srvKid)
    await vi.waitFor(() => expect(bridge.conns()).toHaveLength(1))
    const t = timers.find((x) => x.ms === DECIDE_HELLO_WAIT_MS && !x.cleared)!
    expect(t).toBeTruthy()
    t.fn()
    await expect(p).resolves.toBe('gone')
    expect(add).not.toHaveBeenCalled()
    expect(sockets[1]!.closed).toBe(true)
  })

  it('concurrent allow -> same promise, one auth, one add', async () => {
    const { bridge, sockets } = await pendingSetup()
    const add = vi.fn(async () => {})
    const p1 = bridge.decide(PORT, true, add)
    const p2 = bridge.decide(PORT, true, add)
    expect(p1).toBe(p2)
    await vi.waitFor(() => expect(authOf(sockets[0]!)).toBeTruthy())
    await flush()
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!))
    await expect(p1).resolves.toBe('paired')
    expect(add).toHaveBeenCalledTimes(1)
    expect(sockets[0]!.sent.filter((m) => (m as { type: string }).type === 'auth')).toHaveLength(1)
  })

  it('decide landing while onHello still awaits sends at most one auth', async () => {
    const t = setup({ approved: [approvedOk] })
    await t.bridge.scan([PORT])
    t.sockets[0]!.recv(hello)
    const p = t.bridge.decide(PORT, true, async () => {}, srvKid)
    await vi.waitFor(() => expect(authOf(t.sockets[0]!)).toBeTruthy())
    await flush()
    t.sockets[0]!.recv(await srvAuthOk(authOf(t.sockets[0]!)!))
    await expect(p).resolves.toBe('paired')
    expect(t.sockets[0]!.sent.filter((m) => (m as { type: string }).type === 'auth')).toHaveLength(1)
  })

  it('auth timeout kills the connection; late auth-ok changes nothing', async () => {
    const { bridge, sockets, timers } = await pendingSetup()
    const p = bridge.decide(PORT, true, async () => {})
    await vi.waitFor(() => expect(authOf(sockets[0]!)).toBeTruthy())
    timers.find((x) => x.ms === DECIDE_AUTH_WAIT_MS && !x.cleared)!.fn()
    await expect(p).resolves.toBe('rejected')
    expect(sockets[0]!.closed).toBe(true)
    expect(bridge.conns()).toEqual([])
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!))
    await flush()
    expect(bridge.conns()).toEqual([])
  })

  it('no live entry + keyHash omitted -> gone, no connect-and-approve', async () => {
    const { bridge, sockets, deps } = await pendingSetup()
    sockets[0]!.close()
    const add = vi.fn(async () => {})
    await expect(bridge.decide(PORT, true, add)).resolves.toBe('gone')
    expect(deps.connect).toHaveBeenCalledTimes(1)
    expect(add).not.toHaveBeenCalled()
  })

  it('concurrent decide with a different keyHash -> gone, no extra add/auth', async () => {
    const { bridge, sockets } = await pendingSetup()
    const add = vi.fn(async () => {})
    const a = bridge.decide(PORT, true, add, srvKid)
    const b = bridge.decide(PORT, true, add, 'other-key')
    await expect(b).resolves.toBe('gone')
    await vi.waitFor(() => expect(authOf(sockets[0]!)).toBeTruthy())
    await flush()
    expect(add).toHaveBeenCalledTimes(1)
    expect(sockets[0]!.sent.filter((m) => (m as { type: string }).type === 'auth')).toHaveLength(1)
    sockets[0]!.recv(await srvAuthOk(authOf(sockets[0]!)!))
    await expect(a).resolves.toBe('paired')
  })
})
