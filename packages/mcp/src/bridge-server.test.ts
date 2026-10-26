import { afterEach, describe, expect, it } from 'vitest'
import net from 'node:net'
import WebSocket from 'ws'
import { KNOWN_EXTENSION_IDS } from '@md-reader/core/bridge'
import { BridgeCallError, startBridgeServer, type BridgeServer } from './bridge-server'

const KEY = 'k'.repeat(43)
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

async function start(opts: { connectWaitMs?: number; ports?: number[] } = {}) {
  const ports = opts.ports ?? [await freePort()]
  const s = await startBridgeServer({ pairKey: KEY, client: 'test-client', ports, connectWaitMs: opts.connectWaitMs ?? 2000 })
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
const pairUp = async (port: number) => {
  const e = await connect(port)
  await e.next((m) => m.type === 'hello')
  e.ws.send(JSON.stringify({ type: 'welcome', paired: true }))
  return e
}

describe('bridge server', () => {
  it('sends hello with the right fields on connect', async () => {
    const s = await start()
    const e = await connect(s.port)
    expect(await e.next()).toEqual({ type: 'hello', protocol: 1, client: 'test-client', pairKey: KEY })
  })

  it('waits for welcome, then sends req and resolves on ok res', async () => {
    const s = await start()
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    const p = s.call('list_docs', {})
    e.ws.send(JSON.stringify({ type: 'welcome', paired: true }))
    const req = await e.next((m) => m.type === 'req')
    expect(req.tool).toBe('list_docs')
    expect(req.args).toEqual({})
    e.ws.send(JSON.stringify({ type: 'res', id: req.id, ok: true, result: { docs: [] } }))
    await expect(p).resolves.toEqual({ docs: [] })
  })

  it('welcome paired:false keeps the connection but does not pair', async () => {
    const s = await start({ connectWaitMs: 150 })
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    e.ws.send(JSON.stringify({ type: 'welcome', paired: false }))
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
      await expect(startBridgeServer({ pairKey: KEY, client: 'c', ports: [busy] })).rejects.toThrow('no free port')
    } finally {
      await new Promise((r) => blocker.close(r))
    }
  })

  it('a second paired connection replaces the first; pending call rejects NOT_CONNECTED', async () => {
    const s = await start()
    const a = await pairUp(s.port)
    const p = s.call('list_docs', {})
    const settled = p.catch((x) => x)
    await a.next((m) => m.type === 'req')
    const aClosed = closed(a.ws)
    const b = await pairUp(s.port)
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
    e.ws.send(JSON.stringify({ type: 'welcome', paired: false }))
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

  it('refuses the 5th simultaneous connection', async () => {
    const s = await start()
    for (let i = 0; i < 4; i++) await connect(s.port)
    await expect(connect(s.port)).rejects.toThrow(/503/)
  })

  it('never sends req to an unpaired socket', async () => {
    const s = await start({ connectWaitMs: 150 })
    const e = await connect(s.port)
    await e.next((m) => m.type === 'hello')
    e.ws.send(JSON.stringify({ type: 'welcome', paired: false }))
    await expect(s.call('get_doc', { docId: 'x' })).rejects.toMatchObject({ code: 'NOT_CONNECTED' })
    expect(e.msgs.some((m) => m.type === 'req')).toBe(false)
  })
})
