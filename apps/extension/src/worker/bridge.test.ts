import { describe, it, expect, vi } from 'vitest'
import { textHash } from '@md-reader/core/bridge'
import { createBridge, PING_MS, type BridgeDeps, type WsLike, type ApprovedClient } from './bridge'

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
const PAIR_KEY = 'k'.repeat(32)

function setup(opts: { openPorts?: number[]; approved?: ApprovedClient[] } = {}) {
  const open = new Set(opts.openPorts ?? [47821])
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
    requestPairing: vi.fn(),
    execute: vi.fn(async (req: { id: string }) => ({ type: 'res' as const, id: req.id, ok: true as const, result: { x: 1 } })),
    setTimer: (fn: () => void, ms: number) => { const t = { fn, ms, cleared: false }; timers.push(t); return t },
    clearTimer: (h: unknown) => { (h as { cleared: boolean }).cleared = true },
  }
  const bridge = createBridge(deps as unknown as BridgeDeps)
  return { bridge, deps, sockets, timers }
}
const hello = { type: 'hello', protocol: 1, client: 'claude-code', pairKey: PAIR_KEY }

describe('bridge', () => {
  it('scan opens connections for open ports only', async () => {
    const { bridge, deps } = setup({ openPorts: [47822] })
    const n = await bridge.scan([47821, 47822, 47823])
    expect(n).toBe(1)
    expect(deps.connect).toHaveBeenCalledWith('ws://127.0.0.1:47822')
    expect(bridge.conns().map((c) => c.port)).toEqual([47822])
  })

  it('second scan does not duplicate open connections', async () => {
    const { bridge, deps } = setup()
    await bridge.scan([47821])
    await bridge.scan([47821])
    expect(deps.connect).toHaveBeenCalledTimes(1)
  })

  it('approved hello -> welcome paired:true', async () => {
    const keyHash = await textHash(PAIR_KEY)
    const { bridge, sockets, deps } = setup({ approved: [{ keyHash, client: 'claude-code', at: 1 }] })
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(sockets[0]!.sent).toContainEqual({ type: 'welcome', paired: true }))
    expect(bridge.conns()[0]!.state).toBe('paired')
    expect(deps.requestPairing).not.toHaveBeenCalled()
  })

  it('sanitizes client name', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv({ ...hello, client: '\u202EevilName\n' })
    await vi.waitFor(() => expect(deps.requestPairing).toHaveBeenCalled())
    expect(bridge.conns()[0]!.client).toBe('evilName')
    expect(deps.requestPairing.mock.calls[0]![0].client).toBe('evilName')
  })

  it('unknown hello -> welcome paired:false + requestPairing', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(deps.requestPairing).toHaveBeenCalled())
    const keyHash = await textHash(PAIR_KEY)
    expect(sockets[0]!.sent).toContainEqual({ type: 'welcome', paired: false })
    expect(deps.requestPairing).toHaveBeenCalledWith({ port: 47821, client: 'claude-code', keyHash })
    expect(bridge.conns()[0]!.state).toBe('pending')
    expect(JSON.stringify(deps.requestPairing.mock.calls)).not.toContain(PAIR_KEY)
  })

  it('decide allow calls add and welcomes paired', async () => {
    const { bridge, sockets } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(bridge.conns()[0]!.keyHash).not.toBe(''))
    await vi.waitFor(() => expect(sockets[0]!.sent).toContainEqual({ type: 'welcome', paired: false }))
    const add = vi.fn(async () => {})
    await bridge.decide(47821, true, add)
    const keyHash = await textHash(PAIR_KEY)
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ keyHash, client: 'claude-code', at: expect.any(Number) }))
    expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'welcome', paired: true })
    expect(bridge.conns()[0]!.state).toBe('paired')
  })

  it('decide deny rejects and closes', async () => {
    const { bridge, sockets } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(sockets[0]!.sent).toContainEqual({ type: 'welcome', paired: false }))
    await bridge.decide(47821, false)
    expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'reject', code: 'DENIED' })
    expect(sockets[0]!.closed).toBe(true)
  })

  it('req ignored while pending, executed when paired', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(sockets[0]!.sent).toContainEqual({ type: 'welcome', paired: false }))
    const req = { type: 'req', id: 'r1', tool: 'list_docs', args: {} }
    sockets[0]!.recv(req)
    await flush()
    expect(deps.execute).not.toHaveBeenCalled()
    await bridge.decide(47821, true, async () => {})
    sockets[0]!.recv(req)
    await vi.waitFor(() => expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'res', id: 'r1', ok: true, result: { x: 1 } }))
    expect(deps.execute).toHaveBeenCalledTimes(1)
  })

  it('execute throwing yields INTERNAL res; garbage ignored', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(sockets[0]!.sent).toContainEqual({ type: 'welcome', paired: false }))
    await bridge.decide(47821, true, async () => {})
    deps.execute.mockRejectedValueOnce(new Error('boom'))
    sockets[0]!.onmessage?.({ data: 'not json' })
    sockets[0]!.recv({ type: 'req', id: 'r2', tool: 'list_docs', args: {} })
    await vi.waitFor(() => expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'res', id: 'r2', ok: false, error: { code: 'INTERNAL', message: 'boom' } }))
  })

  it('pings every PING_MS and stops on close', async () => {
    const { bridge, sockets, timers } = setup()
    await bridge.scan([47821])
    const t = timers.find((x) => x.ms === PING_MS)!
    expect(t).toBeTruthy()
    t.fn()
    expect(sockets[0]!.sent).toContainEqual({ type: 'ping' })
    sockets[0]!.close()
    expect(t.cleared).toBe(true)
    expect(bridge.conns()).toEqual([])
  })

  it('revoke closes the matching connection only', async () => {
    const keyHash = await textHash(PAIR_KEY)
    const { bridge, sockets } = setup({ openPorts: [47821, 47822], approved: [{ keyHash, client: 'c', at: 1 }] })
    await bridge.scan([47821, 47822])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(bridge.conns()[0]!.keyHash).toBe(keyHash))
    bridge.revoke(keyHash)
    expect(sockets[0]!.closed).toBe(true)
    expect(sockets[1]!.closed).toBe(false)
  })

  it('concurrent scans open one socket per port', async () => {
    const { bridge, deps } = setup({ openPorts: [47821, 47822] })
    await Promise.all([bridge.scan([47821, 47822]), bridge.scan([47821, 47822]), bridge.scan([47821, 47822])])
    expect(deps.connect).toHaveBeenCalledTimes(2)
    expect(bridge.conns().length).toBe(2)
  })

  it('hello on a socket closed before textHash finishes is ignored', async () => {
    const { bridge, sockets, deps } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    sockets[0]!.close()
    await new Promise((r) => setTimeout(r, 100))
    expect(deps.requestPairing).not.toHaveBeenCalled()
    expect(sockets[0]!.sent).not.toContainEqual(expect.objectContaining({ type: 'welcome' }))
  })

  it('decide with a mismatching keyHash does nothing', async () => {
    const { bridge, sockets } = setup()
    await bridge.scan([47821])
    sockets[0]!.recv(hello)
    await vi.waitFor(() => expect(sockets[0]!.sent).toContainEqual({ type: 'welcome', paired: false }))
    const add = vi.fn(async () => {})
    await bridge.decide(47821, true, add, 'wrong')
    expect(add).not.toHaveBeenCalled()
    expect(sockets[0]!.sent).not.toContainEqual({ type: 'welcome', paired: true })
    expect(bridge.conns()[0]!.state).toBe('pending')
  })
})
