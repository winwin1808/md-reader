import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import type YProviderType from 'y-partyserver/provider'
import { bindRoom } from './bindRoom'
import type { SyncStatus } from '../../shared/collab'

type Handler = (...a: any[]) => void
class FakeProvider {
  static last: FakeProvider
  args: any[]
  handlers = new Map<string, Set<Handler>>()
  state: Record<string, unknown> = {}
  awareness = {
    clientID: 7,
    setLocalStateField: (k: string, v: unknown) => {
      this.state[k] = v
    },
    getLocalState: () => this.state,
  }
  destroy = vi.fn()
  disconnect = vi.fn()
  resolveConnect!: () => void
  rejectConnect!: (e: unknown) => void
  connect = vi.fn(
    () =>
      new Promise<void>((res, rej) => {
        this.resolveConnect = res
        this.rejectConnect = rej
      }),
  )
  constructor(...args: any[]) {
    this.args = args
    FakeProvider.last = this
  }
  on(e: string, h: Handler) {
    if (!this.handlers.has(e)) this.handlers.set(e, new Set())
    this.handlers.get(e)!.add(h)
  }
  off(e: string, h: Handler) {
    this.handlers.get(e)?.delete(h)
  }
  emit(e: string, a: unknown[]) {
    for (const h of [...(this.handlers.get(e) ?? [])]) h(...a)
  }
  count() {
    let n = 0
    for (const s of this.handlers.values()) n += s.size
    return n
  }
}

const mk = (url = 'https://x.workers.dev') => {
  const doc = new Y.Doc()
  const conn = bindRoom(
    doc,
    { serverUrl: url, roomId: 'r1', token: 'tok', name: 'Hao' },
    { Provider: FakeProvider as unknown as typeof YProviderType },
  )
  return { doc, conn, p: FakeProvider.last }
}

describe('bindRoom', () => {
  it('constructs provider and sets awareness', () => {
    const { doc, p } = mk()
    expect(p.args[0]).toBe('x.workers.dev')
    expect(p.args[1]).toBe('r1')
    expect(p.args[2]).toBe(doc)
    expect(p.args[3]).toMatchObject({ party: 'doc-room', params: { token: 'tok' }, connect: false })
    expect(p.connect).toHaveBeenCalledTimes(1)
    expect(p.args[3].protocol).toBeUndefined()
    const u = p.state.user as any
    expect(u.name).toBe('Hao')
    expect(u.color).toMatch(/^var\(--peer-/)
    expect(u.colorLight).toContain('color-mix')
    expect(JSON.stringify(p.state)).not.toContain('tok')
  })
  it('uses ws for http', () => {
    const { p } = mk('http://localhost:8787')
    expect(p.args[0]).toBe('localhost:8787')
    expect(p.args[3].protocol).toBe('ws')
  })
  it('status sequence', () => {
    const { conn, p } = mk()
    const seen: SyncStatus[] = []
    const un = conn.status$((s) => seen.push(s))
    p.emit('status', [{ status: 'connected' }])
    p.emit('synced', [true])
    p.emit('status', [{ status: 'disconnected' }])
    p.emit('status', [{ status: 'connected' }])
    p.emit('synced', [true])
    expect(seen).toEqual(['connecting', 'online', 'offline', 'connecting', 'online'])
    un()
    p.emit('status', [{ status: 'disconnected' }])
    expect(seen.length).toBe(5)
  })
  it('subscriber gets current status', () => {
    const { conn, p } = mk()
    p.emit('synced', [true])
    const seen: SyncStatus[] = []
    conn.status$((s) => seen.push(s))
    expect(seen).toEqual(['online'])
  })
  it('destroy', () => {
    const { conn, p, doc } = mk()
    const seen: SyncStatus[] = []
    conn.status$((s) => seen.push(s))
    conn.destroy()
    conn.destroy()
    expect(p.destroy).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['connecting', 'off'])
    expect(p.count()).toBe(0)
    expect(doc.isDestroyed).toBe(false)
  })
  it('connection-close while connecting -> offline, then recovers', () => {
    const { conn, p } = mk()
    const seen: SyncStatus[] = []
    conn.status$((s) => seen.push(s))
    p.emit('connection-close', [{}])
    p.emit('status', [{ status: 'connected' }])
    p.emit('synced', [true])
    expect(seen).toEqual(['connecting', 'offline', 'connecting', 'online'])
  })
  it('connection-error while connecting -> offline, then online', () => {
    const { conn, p } = mk()
    const seen: SyncStatus[] = []
    conn.status$((s) => seen.push(s))
    p.emit('connection-error', [{}])
    p.emit('synced', [true])
    expect(seen).toEqual(['connecting', 'offline', 'online'])
  })
  it('terminal close codes stop reconnecting and report the reason', () => {
    const cases: [number, SyncStatus][] = [
      [4410, 'revoked'],
      [4413, 'full'],
      [1009, 'full'],
    ]
    for (const [code, expected] of cases) {
      const { conn, p } = mk() as any
      ;(p as any).shouldConnect = true
      const seen: SyncStatus[] = []
      conn.status$((s: SyncStatus) => seen.push(s))
      p.emit('synced', [true])
      p.emit('connection-close', [{ code }])
      expect((p as any).shouldConnect).toBe(false)
      expect(seen).toEqual(['connecting', 'online', expected])
      p.emit('status', [{ status: 'disconnected' }])
      p.emit('status', [{ status: 'connected' }])
      p.emit('synced', [true])
      expect(seen).toEqual(['connecting', 'online', expected])
    }
  })
  it('1006 goes offline and reconnects', () => {
    const { conn, p } = mk()
    ;(p as any).shouldConnect = true
    const seen: SyncStatus[] = []
    conn.status$((s) => seen.push(s))
    p.emit('synced', [true])
    p.emit('connection-close', [{ code: 1006 }])
    p.emit('status', [{ status: 'disconnected' }])
    p.emit('status', [{ status: 'connected' }])
    p.emit('synced', [true])
    expect((p as any).shouldConnect).toBe(true)
    expect(seen).toEqual(['connecting', 'online', 'offline', 'connecting', 'online'])
  })
  it('non-terminal close (1006) keeps reconnecting', () => {
    const { p } = mk()
    ;(p as any).shouldConnect = true
    p.emit('connection-close', [{ code: 1006 }])
    expect((p as any).shouldConnect).toBe(true)
  })
  it('destroy before connect resolves disconnects afterwards', async () => {
    const { conn, p } = mk()
    const seen: SyncStatus[] = []
    conn.status$((s) => seen.push(s))
    conn.destroy()
    expect(p.disconnect).not.toHaveBeenCalled()
    p.resolveConnect()
    await Promise.resolve()
    await Promise.resolve()
    expect(p.disconnect).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['connecting', 'off'])
    expect(p.count()).toBe(0)
  })
  it('destroy before connect rejects is swallowed', async () => {
    const { conn, p } = mk()
    conn.destroy()
    p.rejectConnect(new Error('x'))
    await Promise.resolve()
    await Promise.resolve()
    expect(p.disconnect).toHaveBeenCalledTimes(1)
  })
})
