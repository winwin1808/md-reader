import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { YServer } from 'y-partyserver'
import { DocRoom, MAX_MESSAGE_BYTES, MAX_ROOM_BYTES, AWARENESS_STALE_MS } from './room'

function spyOnSuper(stub: boolean) {
  const spy = vi.spyOn(YServer.prototype as unknown as { handleMessage: (c: unknown, m: unknown) => void }, 'handleMessage')
  return stub ? spy.mockImplementation(() => undefined) : spy
}

function makeRoom(): DocRoom {
  const room = Object.create(DocRoom.prototype) as DocRoom
  room.droppedWrites = 0
  ;(room as unknown as { awarenessOwner: Map<number, string> }).awarenessOwner = new Map()
  ;(room as unknown as { lastSeen: Map<string, number> }).lastSeen = new Map()
  ;(room as unknown as { revoked: Set<string> }).revoked = new Set()
  Object.defineProperty(room, 'document', { value: new Y.Doc() })
  ;(room as unknown as { getConnections: () => unknown[] }).getConnections = () => []
  return room
}
const conn = (state: unknown) => ({ id: 'c', state, readyState: 1, send: () => undefined }) as never
function updateMsg(text = 'hi'): Uint8Array {
  const d = new Y.Doc()
  d.getText('t').insert(0, text)
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 0)
  syncProtocol.writeUpdate(e, Y.encodeStateAsUpdate(d))
  return encoding.toUint8Array(e)
}
function step1Msg(): Uint8Array {
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 0)
  syncProtocol.writeSyncStep1(e, new Y.Doc())
  return encoding.toUint8Array(e)
}
function awMsg(color: string): Uint8Array {
  const aw = new Awareness(new Y.Doc())
  aw.setLocalState({ user: { name: 'A', color } })
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 1)
  encoding.writeVarUint8Array(e, encodeAwarenessUpdate(aw, [aw.clientID]))
  return encoding.toUint8Array(e)
}

describe('DocRoom.handleMessage', () => {
  it('drops updates from view connections', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    room.handleMessage(conn({ role: 'view' }), updateMsg())
    expect(room.droppedWrites).toBe(1)
    expect(spy).not.toHaveBeenCalled()
    expect(room.document.getText('t').toString()).toBe('')
    spy.mockRestore()
  })
  it('applies updates from edit connections', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    room.handleMessage(conn({ role: 'edit' }), updateMsg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(room.droppedWrites).toBe(0)
    expect(room.document.getText('t').toString()).toBe('hi')
    spy.mockRestore()
  })
  it('lets view connections send step1', () => {
    const room = makeRoom()
    const spy = spyOnSuper(true)
    room.handleMessage(conn({ role: 'view' }), step1Msg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(room.droppedWrites).toBe(0)
    spy.mockRestore()
  })
  it.each(['view', 'edit'])('sanitizes awareness for %s', (role) => {
    const room = makeRoom()
    const spy = spyOnSuper(true)
    room.handleMessage(conn({ role }), awMsg('red;background:url(x)'))
    expect(spy).toHaveBeenCalledTimes(1)
    const buf = spy.mock.calls[0]![1] as Uint8Array
    const d = decoding.createDecoder(buf)
    expect(decoding.readVarUint(d)).toBe(1)
    const u = decoding.createDecoder(decoding.readVarUint8Array(d))
    decoding.readVarUint(u)
    decoding.readVarUint(u)
    decoding.readVarUint(u)
    expect(JSON.parse(decoding.readVarString(u)).user.color).toBe('var(--peer-1)')
    spy.mockRestore()
  })
  it('drops garbage without throwing', () => {
    const room = makeRoom()
    const spy = spyOnSuper(true)
    expect(() => room.handleMessage(conn({ role: 'edit' }), new Uint8Array([1, 255, 255, 255]))).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('treats missing state or role as read-only', () => {
    const room = makeRoom()
    expect(room.isReadOnly(conn(null))).toBe(true)
    expect(room.isReadOnly(conn({}))).toBe(true)
    expect(room.isReadOnly(conn({ role: 'edit' }))).toBe(false)
    room.handleMessage(conn(null), updateMsg())
    expect(room.droppedWrites).toBe(1)
  })
})

describe('DocRoom size caps (11f1)', () => {
  const closable = (state: unknown) => ({ id: 'c', state, close: vi.fn(), send: () => undefined })
  it('closes 1009 on an oversized binary message from an edit conn', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, new Uint8Array(MAX_MESSAGE_BYTES + 1))
    expect(c.close).toHaveBeenCalledWith(1009, 'too large')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('closes 1009 on an oversized string message', () => {
    const room = makeRoom()
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, 'x'.repeat(MAX_MESSAGE_BYTES + 1))
    expect(c.close).toHaveBeenCalledWith(1009, 'too large')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('closes 4413 when the room is already full', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = MAX_ROOM_BYTES
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, updateMsg())
    expect(c.close).toHaveBeenCalledWith(4413, 'room full')
    expect(room.droppedWrites).toBe(1)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('applies an update that merely crosses the cap when not yet full', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = MAX_ROOM_BYTES - 10
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, updateMsg('x'.repeat(20)))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(c.close).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('roomBytes resets to the real state size after compact', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    await room.onLoad()
    room.document.getText('t').insert(0, 'hello')
    ;(room as unknown as { roomBytes: number }).roomBytes = 50_000_000
    await room.onSave() // phòng rỗng + updates > 0 → compact
    const rb = (room as unknown as { roomBytes: number }).roomBytes
    expect(rb).toBe(Y.encodeStateAsUpdate(room.document).length)
  })
  it('accepts small updates while there is room', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = 100
    const spy = spyOnSuper(false)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, updateMsg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(c.close).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('still allows step1 when the room is full', () => {
    const room = makeRoom()
    ;(room as unknown as { roomBytes: number }).roomBytes = MAX_ROOM_BYTES
    const spy = spyOnSuper(true)
    const c = closable({ role: 'edit' })
    room.handleMessage(c as never, step1Msg())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(c.close).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('onLoad sets roomBytes from state and updates add to it', async () => {
    const d = new Y.Doc()
    d.getText('t').insert(0, 'hello')
    const st = fakeStorage({ snap: Y.encodeStateAsUpdate(d) })
    const room = makePurgeRoom(st)
    await room.onLoad()
    const before = (room as unknown as { roomBytes: number }).roomBytes
    room.document.getText('t').insert(0, 'more')
    expect((room as unknown as { roomBytes: number }).roomBytes).toBeGreaterThan(before)
  })
})

function fakeStorage(init: Record<string, unknown> = {}) {
  const m = new Map<string, unknown>(Object.entries(init))
  return {
    m,
    get: async (k: string) => m.get(k),
    put: async (k: string, v: unknown) => void m.set(k, v),
    delete: async (k: string) => m.delete(k),
    list: async (o: { prefix?: string } = {}) =>
      new Map([...m].filter(([k]) => k.startsWith(o.prefix ?? ''))),
    deleteAll: async () => void m.clear(),
    deleteAlarm: vi.fn(async function (this: { alarm: number | null }) {
      this.alarm = null
    }),
    alarm: null as number | null,
    getAlarm: async function (this: { alarm: number | null }) {
      return this.alarm
    },
    setAlarm: vi.fn(async function (this: { alarm: number | null }, t: number) {
      this.alarm = t
    }),
  }
}
function makePurgeRoom(storage = fakeStorage(), conns: Array<ReturnType<typeof fakeConn>> = []) {
  const room = makeRoom()
  Object.defineProperty(room, 'ctx', { value: { storage } })
  ;(room as unknown as { getConnections: () => unknown[] }).getConnections = () => conns
  ;(room as unknown as { queue: Promise<unknown> }).queue = Promise.resolve()
  ;(room as unknown as { stats: unknown }).stats = { updates: 0, bytes: 0 }
  return room
}
function fakeConn() {
  return { id: 'c', state: { role: 'edit' }, close: vi.fn(), setState: vi.fn(), send: () => undefined }
}
const ctxReq = () => ({ request: new Request('http://x/', { headers: { 'x-mdr-role': 'edit' } }) }) as never

describe('DocRoom.purge', () => {
  it('closes open connections with 4410 and leaves only the tombstone', async () => {
    const st = fakeStorage({ 'u:1': 'a', snap: 'b' })
    const c1 = fakeConn()
    const c2 = fakeConn()
    const room = makePurgeRoom(st, [c1, c2])
    await room.purge()
    expect(c1.close).toHaveBeenCalledWith(4410, 'deleted')
    expect(c2.close).toHaveBeenCalledWith(4410, 'deleted')
    expect([...st.m.keys()]).toEqual(['tombstone'])
  })
  it('closes new connections after purge', async () => {
    const room = makePurgeRoom()
    await room.purge()
    const c = fakeConn()
    room.onConnect(c as never, ctxReq())
    expect(c.close).toHaveBeenCalledWith(4410, 'deleted')
    expect(c.setState).not.toHaveBeenCalled()
  })
  it('ignores messages after purge', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    await room.purge()
    const spy = spyOnSuper(false)
    room.handleMessage(conn({ role: 'edit' }), updateMsg())
    room.handleMessage(conn({ role: 'edit' }), 'str')
    expect(spy).not.toHaveBeenCalled()
    expect([...st.m.keys()]).toEqual(['tombstone'])
    spy.mockRestore()
  })
  it('returns 410 for snapshot after purge and 204 for internal purge request', async () => {
    const st = fakeStorage({ 'u:1': 'a' })
    const room = makePurgeRoom(st)
    const r = await room.onRequest(
      new Request('http://x/parties/doc-room/r/purge', { method: 'POST', headers: { 'x-mdr-internal': '1' } }),
    )
    expect(r.status).toBe(204)
    expect([...st.m.keys()]).toEqual(['tombstone'])
    const s = await room.onRequest(
      new Request('http://x/parties/doc-room/r/snapshot', { headers: { 'x-mdr-internal': '1' } }),
    )
    expect(s.status).toBe(410)
  })
  it('a new DocRoom on tombstoned storage is purged', async () => {
    const st = fakeStorage({ tombstone: 1 })
    const room = makePurgeRoom(st)
    await room.onLoad()
    expect(room.document.getText('t').toString()).toBe('')
    const c = fakeConn()
    room.onConnect(c as never, ctxReq())
    expect(c.close).toHaveBeenCalledWith(4410, 'deleted')
  })
  it('purge after a queued persistUpdate leaves only the tombstone', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    const r = room as unknown as { persistUpdate: (u: Uint8Array) => Promise<void> }
    const d = new Y.Doc()
    d.getText('t').insert(0, 'x')
    const p = r.persistUpdate(Y.encodeStateAsUpdate(d))
    await room.purge()
    await p
    expect([...st.m.keys()]).toEqual(['tombstone'])
  })
  it('onSave and last-connection close after purge keep only the tombstone', async () => {
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    ;(room as unknown as { stats: unknown }).stats = { updates: 5, bytes: 1e9 }
    await room.purge()
    await room.onSave()
    const closeSpy = vi.spyOn(YServer.prototype as unknown as { onClose: () => Promise<void> }, 'onClose').mockResolvedValue(undefined)
    await room.onClose(fakeConn() as never, 1000, '', true)
    await (room as unknown as { queue: Promise<unknown> }).queue
    closeSpy.mockRestore()
    expect([...st.m.keys()]).toEqual(['tombstone'])
  })
})

describe('DocRoom revoke (11c)', () => {
  const reqWith = (h: Record<string, string>) => ({ request: new Request('http://x/', { headers: h }) }) as never
  const revokeReq = (prefix: unknown, internal = true) =>
    new Request('http://x/parties/doc-room/r/revoke', {
      method: 'POST',
      headers: internal ? { 'x-mdr-internal': '1' } : {},
      body: JSON.stringify({ prefix }),
    })

  it('revoke closes conns with the same prefix only', async () => {
    const st = fakeStorage()
    const a = { ...fakeConn(), state: { role: 'edit', prefix: 'abc' } }
    const b = { ...fakeConn(), state: { role: 'edit', prefix: 'xyz' } }
    const room = makePurgeRoom(st, [a, b])
    const r = await room.onRequest(revokeReq('abc'))
    expect(r.status).toBe(204)
    expect(a.close).toHaveBeenCalledWith(4410, 'revoked')
    expect(b.close).not.toHaveBeenCalled()
    expect(st.m.has('revoked:abc')).toBe(true)
  })
  it('rejects bad prefix with 400', async () => {
    const room = makePurgeRoom()
    expect((await room.onRequest(revokeReq(''))).status).toBe(400)
    expect((await room.onRequest(revokeReq('x'.repeat(33)))).status).toBe(400)
    expect((await room.onRequest(revokeReq(5))).status).toBe(400)
  })
  it('onConnect with revoked prefix closes 4410', async () => {
    const room = makePurgeRoom()
    await room.onRequest(revokeReq('abc'))
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-role': 'edit', 'x-mdr-prefix': 'abc' }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
    expect(c.setState).not.toHaveBeenCalled()
  })
  it('onConnect with past expiry closes 4410', () => {
    const room = makePurgeRoom()
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-role': 'edit', 'x-mdr-expires': String(Date.now() - 1000) }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
  })
  it('handleMessage closes and drops when state expired', () => {
    const room = makePurgeRoom()
    const spy = spyOnSuper(false)
    const c = { ...fakeConn(), state: { role: 'edit', expiresAt: Date.now() - 1 } }
    room.handleMessage(c as never, updateMsg())
    expect(spy).not.toHaveBeenCalled()
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
    spy.mockRestore()
  })
  it('revoked set is reloaded in onLoad', async () => {
    const room = makePurgeRoom(fakeStorage({ 'revoked:abc': 1 }))
    await room.onLoad()
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-role': 'edit', 'x-mdr-prefix': 'abc' }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
  })
  it('/revoke without x-mdr-internal does not revoke', async () => {
    const st = fakeStorage()
    const a = { ...fakeConn(), state: { role: 'edit', prefix: 'abc' } }
    const room = makePurgeRoom(st, [a])
    const r = await room.onRequest(revokeReq('abc', false))
    expect(r.status).toBe(404)
    expect(a.close).not.toHaveBeenCalled()
    expect(st.m.has('revoked:abc')).toBe(false)
  })
})

describe('DocRoom expiry alarm (11c T4)', () => {
  vi.spyOn(YServer.prototype as unknown as { onAlarm: () => Promise<void> }, 'onAlarm').mockResolvedValue(undefined)
  const reqWith = (h: Record<string, string>) => ({ request: new Request('http://x/', { headers: h }) }) as never
  const withState = (expiresAt?: number) => ({ ...fakeConn(), state: { role: 'view', expiresAt } })

  it('onAlarm closes only expired conns', async () => {
    const a = withState(Date.now() - 1)
    const b = withState(undefined)
    const room = makePurgeRoom(fakeStorage(), [a, b])
    await room.onAlarm()
    expect(a.close).toHaveBeenCalledWith(4410, 'expired')
    expect(b.close).not.toHaveBeenCalled()
  })
  it('onConnect with future expiry sets alarm; earlier existing alarm is kept', async () => {
    const sup = vi.spyOn(YServer.prototype as unknown as { onConnect: () => void }, 'onConnect').mockImplementation(() => undefined)
    const t = Date.now() + 60_000
    const st = fakeStorage()
    const room = makePurgeRoom(st)
    room.onConnect(fakeConn() as never, reqWith({ 'x-mdr-expires': String(t) }))
    await new Promise((r) => setTimeout(r, 0))
    expect(st.setAlarm).toHaveBeenCalledWith(t)

    const st2 = fakeStorage()
    st2.alarm = t - 1000
    const room2 = makePurgeRoom(st2)
    room2.onConnect(fakeConn() as never, reqWith({ 'x-mdr-expires': String(t) }))
    await new Promise((r) => setTimeout(r, 0))
    expect(st2.setAlarm).not.toHaveBeenCalled()
    sup.mockRestore()
  })
  it('onAlarm re-arms for the earliest future expiry', async () => {
    const t1 = Date.now() + 90_000
    const t2 = Date.now() + 30_000
    const st = fakeStorage()
    const room = makePurgeRoom(st, [withState(Date.now() - 1), withState(t1), withState(t2)])
    await room.onAlarm()
    expect(st.setAlarm).toHaveBeenCalledWith(t2)
  })
  it('unparsable x-mdr-expires closes 4410', () => {
    const room = makePurgeRoom()
    const c = fakeConn()
    room.onConnect(c as never, reqWith({ 'x-mdr-expires': 'abc' }))
    expect(c.close).toHaveBeenCalledWith(4410, 'revoked')
    expect(c.setState).not.toHaveBeenCalled()
  })
  it('purge deletes the alarm before deleteAll; onAlarm on a purged room does nothing', async () => {
    const a = withState(Date.now() - 1)
    const st = fakeStorage()
    const order: string[] = []
    st.deleteAlarm.mockImplementation(async () => void order.push('alarm'))
    const origDel = st.deleteAll
    st.deleteAll = async () => {
      order.push('all')
      await origDel()
    }
    const room = makePurgeRoom(st, [a])
    await room.purge()
    expect(order).toEqual(['alarm', 'all'])
    a.close.mockClear()
    await room.onAlarm()
    expect(a.close).not.toHaveBeenCalled()
    expect(st.setAlarm).not.toHaveBeenCalled()
  })
  it('purge still completes if deleteAlarm throws', async () => {
    const st = fakeStorage({ x: 1 })
    st.deleteAlarm.mockRejectedValue(new Error('boom'))
    const room = makePurgeRoom(st)
    await room.purge()
    expect(st.m.has('x')).toBe(false)
    expect(st.m.get('tombstone')).toBe(1)
  })
})

describe('DocRoom awareness ownership', () => {
  function awFor(id: number, state: unknown = { user: { name: 'A', color: 'var(--peer-1)' } }): Uint8Array {
    const inner = encoding.createEncoder()
    encoding.writeVarUint(inner, 1)
    encoding.writeVarUint(inner, id)
    encoding.writeVarUint(inner, 1)
    encoding.writeVarString(inner, JSON.stringify(state))
    const e = encoding.createEncoder()
    encoding.writeVarUint(e, 1)
    encoding.writeVarUint8Array(e, encoding.toUint8Array(inner))
    return encoding.toUint8Array(e)
  }
  const idsIn = (m: Uint8Array): number[] => {
    const d = decoding.createDecoder(m)
    decoding.readVarUint(d)
    const u = decoding.createDecoder(decoding.readVarUint8Array(d))
    const n = decoding.readVarUint(u)
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      out.push(decoding.readVarUint(u))
      decoding.readVarUint(u)
      decoding.readVarString(u)
    }
    return out
  }
  const cn = (id: string) => ({ id, state: { role: 'edit' }, readyState: 1, send: () => undefined }) as never
  const setup = () => {
    const room = makeRoom()
    const spy = spyOnSuper(false).mockImplementation(() => undefined)
    return { room, spy }
  }
  it('forwards owner, blocks others (state and null)', () => {
    const { room, spy } = setup()
    const a = cn('A'), b = cn('B')
    room.handleMessage(a, awFor(100))
    expect(spy).toHaveBeenCalledTimes(1)
    room.handleMessage(b, awFor(100))
    room.handleMessage(b, awFor(100, null))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  const seen = (room: DocRoom, id: string, t: number) =>
    (room as unknown as { lastSeen: Map<string, number> }).lastSeen.set(id, t)
  const ownerOf = (room: DocRoom, id: number) =>
    (room as unknown as { awarenessOwner: Map<number, string> }).awarenessOwner.get(id)
  it('transfers ownership when the old owner is silent over the stale window', () => {
    const { room, spy } = setup()
    room.handleMessage(cn('A'), awFor(100))
    seen(room, 'A', Date.now() - AWARENESS_STALE_MS - 1000)
    room.handleMessage(cn('B'), awFor(100))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(ownerOf(room, 100)).toBe('B')
    spy.mockRestore()
  })
  it('keeps ownership when the old owner was seen 60 s ago (throttled hidden tab)', () => {
    const { room, spy } = setup()
    room.handleMessage(cn('A'), awFor(100))
    seen(room, 'A', Date.now() - 60_000)
    room.handleMessage(cn('B'), awFor(100))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(ownerOf(room, 100)).toBe('A')
    spy.mockRestore()
  })
  it('does not claim an id with a malformed entry', () => {
    const { room, spy } = setup()
    const inner = encoding.createEncoder()
    encoding.writeVarUint(inner, 1)
    encoding.writeVarUint(inner, 200)
    encoding.writeVarUint(inner, 1)
    encoding.writeVarString(inner, '{bad')
    const e = encoding.createEncoder()
    encoding.writeVarUint(e, 1)
    encoding.writeVarUint8Array(e, encoding.toUint8Array(inner))
    room.handleMessage(cn('A'), encoding.toUint8Array(e))
    expect(ownerOf(room, 200)).toBeUndefined()
    spy.mockRestore()
  })
  it('rejects null removal for an unowned id and creates no owner', () => {
    const { room, spy } = setup()
    room.handleMessage(cn('A'), awFor(300, null))
    expect(spy).not.toHaveBeenCalled()
    expect(ownerOf(room, 300)).toBeUndefined()
    spy.mockRestore()
  })
  it('frees ids when owner closes', async () => {
    const { room, spy } = setup()
    const a = cn('A'), b = cn('B')
    room.handleMessage(a, awFor(100))
    await room.onClose(a, 1000, '', true).catch(() => undefined)
    room.handleMessage(b, awFor(100))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(idsIn(spy.mock.calls[1]![1] as Uint8Array)).toEqual([100])
    spy.mockRestore()
  })
  it('caps ids per connection', () => {
    const { room, spy } = setup()
    const a = cn('A')
    for (let i = 1; i <= 4; i++) room.handleMessage(a, awFor(i))
    room.handleMessage(a, awFor(5))
    expect(spy).toHaveBeenCalledTimes(4)
    spy.mockRestore()
  })
})

describe('DocRoom peer write guard (12a)', () => {
  function guarded() {
    const room = makeRoom()
    const r = room as unknown as { peerUndo: Y.UndoManager; installPeerGuard: () => void }
    const doc = room.document
    doc.getMap('meta').set('formatVersion', 2)
    doc.getMap('meta').set('actors', new Y.Map())
    doc.getText('source')
    doc.getArray('history')
    r.installPeerGuard()
    return { room, r, doc }
  }
  const link = { id: 'l', state: { role: 'edit', prefix: 'p' }, close: vi.fn(), send: () => undefined }
  it('reverts meta write by link connection and closes 4403', () => {
    const { r, doc } = guarded()
    const c = { ...link, close: vi.fn() }
    r.peerUndo.trackedOrigins.add(c)
    doc.transact(() => doc.getMap('meta').set('formatVersion', 99), c)
    expect(doc.getMap('meta').get('formatVersion')).toBe(2)
    expect(c.close).toHaveBeenCalledWith(4403, 'forbidden write')
  })
  it('reverts writes to an unknown root and closes 4403', () => {
    const { r, doc } = guarded()
    const c = { ...link, close: vi.fn() }
    r.peerUndo.trackedOrigins.add(c)
    doc.transact(() => {
      doc.getMap('other').set('a', 1)
      doc.getArray('other2').push([1])
    }, c)
    expect(doc.getMap('other').get('a')).toBeUndefined()
    expect(doc.getArray('other2').length).toBe(0)
    expect(c.close).toHaveBeenCalledWith(4403, 'forbidden write')
  })
  it('keeps source edits from link connection', () => {
    const { r, doc } = guarded()
    const c = { ...link, close: vi.fn() }
    r.peerUndo.trackedOrigins.add(c)
    doc.transact(() => doc.getText('source').insert(0, 'ok'), c)
    expect(doc.getText('source').toString()).toBe('ok')
    expect(c.close).not.toHaveBeenCalled()
  })
  it('does not filter owner connection', () => {
    const { doc } = guarded()
    const c = { id: 'o', state: { role: 'edit', prefix: '' }, close: vi.fn() }
    doc.transact(() => doc.getMap('meta').set('formatVersion', 3), c)
    expect(doc.getMap('meta').get('formatVersion')).toBe(3)
    expect(c.close).not.toHaveBeenCalled()
  })
})

describe('DocRoom pre-apply link filter (14a)', () => {
  function server() {
    const room = makeRoom()
    const doc = room.document
    doc.getMap('meta').set('formatVersion', 2)
    doc.getMap('meta').set('actors', new Y.Map())
    doc.getText('source').insert(0, 'hello')
    doc.getArray('history')
    ;(room as unknown as { installPeerGuard: () => void }).installPeerGuard()
    return { room, doc }
  }
  function peerOf(doc: Y.Doc, fn: (p: Y.Doc) => void, clientID?: number): Uint8Array {
    const p = new Y.Doc()
    Y.applyUpdate(p, Y.encodeStateAsUpdate(doc))
    if (clientID !== undefined) p.clientID = clientID
    let u: Uint8Array = new Uint8Array()
    p.on('update', (x: Uint8Array) => (u = x))
    p.transact(() => fn(p))
    return u
  }
  const wrap = (u: Uint8Array, inner = 2) => {
    const e = encoding.createEncoder()
    encoding.writeVarUint(e, 0)
    encoding.writeVarUint(e, inner)
    encoding.writeVarUint8Array(e, u)
    return encoding.toUint8Array(e)
  }
  const linkConn = () => ({ id: 'l', state: { role: 'edit', prefix: 'p' }, close: vi.fn(), send: () => undefined })

  it('(a) meta.formatVersion write is not applied nor forwarded, closes 4403', () => {
    const { room, doc } = server()
    const spy = spyOnSuper(true)
    const c = linkConn()
    const u = peerOf(doc, (p) => p.getMap('meta').set('formatVersion', 99))
    room.handleMessage(c as never, wrap(u))
    expect(spy).not.toHaveBeenCalled()
    expect(doc.getMap('meta').get('formatVersion')).toBe(2)
    expect(c.close).toHaveBeenCalledWith(4403, 'forbidden write')
    spy.mockRestore()
  })
  it('(b) forging a struct with the owner clientID to set actors[owner] is blocked', () => {
    const { room, doc } = server()
    const spy = spyOnSuper(true)
    const owner = [...doc.store.clients.keys()][0]
    const c = linkConn()
    const u = peerOf(doc, (p) => (p.getMap('meta').get('actors') as Y.Map<string>).set(String(owner), 'Evil'), owner)
    room.handleMessage(c as never, wrap(u))
    expect(spy).not.toHaveBeenCalled()
    expect(c.close).toHaveBeenCalledWith(4403, 'forbidden write')
    spy.mockRestore()
  })
  it('(c) valid web flow: source edit + own actors entry passes (update and step2)', () => {
    const { room, doc } = server()
    const spy = spyOnSuper(true)
    const c = linkConn()
    const u = peerOf(doc, (p) => {
      p.getText('source').insert(5, ' world')
      p.getText('source').delete(0, 1)
      ;(p.getMap('meta').get('actors') as Y.Map<string>).set(String(p.clientID), 'Bob')
    })
    room.handleMessage(c as never, wrap(u, 1))
    room.handleMessage(c as never, wrap(peerOf(doc, (p) => p.getText('source').insert(0, 'z'), undefined)))
    expect(c.close).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
  it('clientID ownership survives a DO restart (same prefix ok, other prefix 4403)', async () => {
    const storage = fakeStorage()
    const mk = () => {
      const r = makePurgeRoom(storage)
      ;(r as unknown as { installPeerGuard: () => void }).installPeerGuard()
      return r
    }
    const r1 = mk()
    await r1.onLoad()
    const doc1 = r1.document
    doc1.getMap('meta').set('actors', new Y.Map())
    doc1.getText('source').insert(0, 'hello')
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc1))
    let u: Uint8Array = new Uint8Array()
    peer.on('update', (x: Uint8Array) => (u = x))
    peer.getText('source').insert(0, 'a')
    const spy = spyOnSuper(false)
    const c1 = linkConn()
    r1.handleMessage(c1 as never, wrap(u))
    expect(c1.close).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 0))
    expect(storage.m.get('owner:' + peer.clientID)).toBe('p')
    // restart: new room over the same storage, doc state reloaded from persisted updates
    const r2 = mk()
    r2.document.getMap('meta').set('actors', new Y.Map())
    Y.applyUpdate(r2.document, Y.encodeStateAsUpdate(doc1))
    await r2.onLoad()
    peer.getText('source').insert(0, 'b')
    const c2 = linkConn()
    r2.handleMessage(c2 as never, wrap(u))
    expect(c2.close).not.toHaveBeenCalled()
    const c3 = { ...linkConn(), state: { role: 'edit', prefix: 'other' } }
    r2.handleMessage(c3 as never, wrap(u))
    expect(c3.close).toHaveBeenCalledWith(4403, 'forbidden write')
    spy.mockRestore()
  })
  it('owner connection (no prefix) is not filtered', () => {
    const { room, doc } = server()
    const spy = spyOnSuper(true)
    const c = { id: 'o', state: { role: 'edit', prefix: '' }, close: vi.fn(), send: () => undefined }
    room.handleMessage(c as never, wrap(peerOf(doc, (p) => p.getMap('meta').set('formatVersion', 3))))
    expect(spy).toHaveBeenCalled()
    expect(c.close).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('DocRoom 15b', () => {
  it('awareness cursor over the byte cap is dropped even when under the char cap', () => {
    const room = makeRoom()
    const spy = spyOnSuper(true)
    const inner = encoding.createEncoder()
    encoding.writeVarUint(inner, 1)
    encoding.writeVarUint(inner, 7)
    encoding.writeVarUint(inner, 1)
    const cursor = { anchor: 'ệ'.repeat(600) }
    expect(JSON.stringify(cursor).length).toBeLessThan(1024)
    encoding.writeVarString(inner, JSON.stringify({ user: { name: 'A', color: 'var(--peer-1)' }, cursor }))
    const e = encoding.createEncoder()
    encoding.writeVarUint(e, 1)
    encoding.writeVarUint8Array(e, encoding.toUint8Array(inner))
    room.handleMessage(conn({ role: 'edit' }), encoding.toUint8Array(e))
    const buf = spy.mock.calls[0]![1] as Uint8Array
    const d = decoding.createDecoder(buf)
    decoding.readVarUint(d)
    const u = decoding.createDecoder(decoding.readVarUint8Array(d))
    decoding.readVarUint(u)
    decoding.readVarUint(u)
    decoding.readVarUint(u)
    expect(JSON.parse(decoding.readVarString(u)).cursor).toBeUndefined()
    spy.mockRestore()
  })
  it('revoking a prefix removes its owner: records only', async () => {
    const st = fakeStorage({ 'owner:1': 'P', 'owner:2': 'Q', 'owner:3': 'P' })
    const room = makePurgeRoom(st)
    ;(room as unknown as { clientOwners: Map<number, string> }).clientOwners = new Map([[1, 'P'], [2, 'Q'], [3, 'P']])
    const r = await room.onRequest(
      new Request('http://x/parties/doc-room/r/revoke', {
        method: 'POST',
        headers: { 'x-mdr-internal': '1' },
        body: JSON.stringify({ prefix: 'P' }),
      }),
    )
    expect(r.status).toBe(204)
    expect([...st.m.keys()].filter((k) => k.startsWith('owner:'))).toEqual(['owner:2'])
    expect([...(room as unknown as { clientOwners: Map<number, string> }).clientOwners.keys()]).toEqual([2])
  })
})
